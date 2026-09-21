"""Validate the study GLB independently of Blender's exporter.

This checks data preservation, not survey accuracy or reconstruction completeness.
Uses only Python's standard library; run from any working directory.
"""

from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import struct


REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "assets/design-qr/dotonbori"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_glb(path):
    payload = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", payload)
    require((magic, version, length) == (b"glTF", 2, len(payload)), "Invalid GLB header")
    chunks, offset = {}, 12
    while offset < length:
        size, kind = struct.unpack_from("<II", payload, offset)
        require(offset + 8 + size <= length, "Truncated GLB chunk")
        require(kind not in chunks, "Repeated GLB chunk")
        chunks[kind] = payload[offset + 8:offset + 8 + size]
        offset += 8 + size
    return json.loads(chunks[0x4E4F534A]), chunks[0x004E4942]


def validate():
    source = json.loads((ASSETS / "source-meshes.json").read_text(encoding="utf-8"))
    manifest = json.loads((ASSETS / "study-manifest.json").read_text(encoding="utf-8"))
    require(manifest["sourceMeshSha256"] == digest(ASSETS / "source-meshes.json"), "Source mesh hash changed")
    require(manifest["sourceAuditSha256"] == digest(REPO / "docs/designqr-package/cities/dotonbori/references/site-audit.json"), "Audit hash changed")
    require(manifest["generatorSha256"] == digest(REPO / "scripts/blender/build-dotonbori-study.py"), "Regenerate with current authoring script")
    require(manifest["blenderValidationSha256"] == digest(ASSETS / "blender-validation.json"), "Blender validation changed")
    for kind, name in [("glb", "dotonbori-study.glb"), ("blend", "dotonbori-source.blend")]:
        require(manifest[kind + "Sha256"] == digest(ASSETS / name), f"{kind} hash changed")
        require(manifest[kind + "Bytes"] == (ASSETS / name).stat().st_size, f"{kind} byte count changed")

    document, binary = read_glb(ASSETS / "dotonbori-study.glb")
    require(document["asset"]["version"] == "2.0", "Unexpected glTF version")
    require(len(document["buffers"]) == 1 and "uri" not in document["buffers"][0], "External buffer dependency")
    for field in ("images", "textures", "animations", "cameras", "skins", "extensionsRequired"):
        require(not document.get(field), f"Unexpected study content: {field}")

    def accessor(index, asset=document, blob=binary):
        item = asset["accessors"][index]
        require("sparse" not in item and not item.get("normalized"), "Unsupported accessor layout")
        width = {"SCALAR": 1, "VEC3": 3}[item["type"]]
        code, component_size = {5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}[item["componentType"]]
        view = asset["bufferViews"][item["bufferView"]]
        require(view["buffer"] == 0, "Unexpected buffer")
        step = view.get("byteStride", width * component_size)
        local = item.get("byteOffset", 0)
        require(local + (item["count"] - 1) * step + width * component_size <= view["byteLength"], "Accessor exceeds buffer view")
        start = view.get("byteOffset", 0) + local
        return [struct.unpack_from("<" + code * width, blob, start + i * step) for i in range(item["count"])]

    palette = set(re.findall(r"#[0-9a-fA-F]{6}", (REPO / "packages/designqr/src/designs/city/palette.ts").read_text()))
    for material in document["materials"]:
        swatch = material["extras"]["swatch"]
        require(swatch in palette, "Material uses a color outside the City source palette")
        values = [int(swatch[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        expected = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values] + [1]
        actual = material["pbrMetallicRoughness"]["baseColorFactor"]
        require(max(abs(a - b) for a, b in zip(expected, actual)) < 1e-6, "Material color-space conversion differs")

    expected = {obj["id"]: obj for obj in source["objects"]}
    seen, vertices, triangles, cuts = set(), [], 0, 0
    extent = source["cropSizeM"] / 2
    precision_tolerance = 3e-5  # float32 storage tolerance, not physical accuracy
    for node in document["nodes"]:
        require(not any(key in node for key in ("matrix", "scale", "rotation", "translation", "children")), "Unexpected transform or hierarchy")
        metadata = node["extras"]
        source_id = metadata["id"]
        require(source_id in expected and source_id not in seen, "Unexpected or duplicate feature")
        seen.add(source_id)
        original = expected[source_id]
        for key in ("auditLabel", "lod", "sourceSha256", "sourceCreationDate"):
            require(metadata[key] == original[key], f"Source metadata differs: {key}")
        require(metadata["evidence"] == "source-geometry" and not metadata["facade_detail_verified"], "Study certainty mislabeled")
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            require(primitive.get("mode", 4) == 4, "Study primitive is not triangles")
            require(set(primitive["attributes"]) == {"POSITION", "NORMAL"}, "Unexpected vertex attributes")
            points = accessor(primitive["attributes"]["POSITION"])
            indices = [value[0] for value in accessor(primitive["indices"])]
            require(len(indices) % 3 == 0, "Incomplete triangle")
            require(all(0 <= index < len(points) for index in indices), "Triangle index out of range")
            for east, height, south in points:
                require(all(math.isfinite(v) for v in (east, height, south)), "Non-finite vertex")
                require(max(abs(east), abs(south)) <= extent + precision_tolerance, "Geometry escapes the crop")
                require(original["boundsM"][0][2] - precision_tolerance <= height <= original["boundsM"][1][2] + precision_tolerance, "Source height changed")
            role = document["materials"][primitive["material"]]["extras"]["palette_role"]
            for i in range(0, len(indices), 3):
                a, b, c = [points[index] for index in indices[i:i + 3]]
                u, v = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
                cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
                require(sum(x*x for x in cross) > 1e-16, f"Degenerate exported triangle on {metadata['auditLabel']}: {a}, {b}, {c}")
                if role == "authoring-cut":
                    require(any(all(abs(p[axis] - sign * extent) < precision_tolerance for p in (a,b,c)) for axis in (0,2) for sign in (-1,1)), "Cut face is not on the crop boundary")
                    cuts += 1
            triangles += len(indices) // 3
            vertices.extend(points)
    require(seen == set(expected), "Export omits source features")
    require(triangles == manifest["studyTriangleCount"], "Triangle count differs")
    require(len(document["scenes"]) == 1 and set(document["scenes"][0]["nodes"]) == set(range(len(seen))), "Scene node inventory differs")
    report = {
        "status": "pass", "claim": "asset data integrity; not a completed scene or a survey-accuracy assessment",
        "glbSha256": manifest["glbSha256"], "blendSha256": manifest["blendSha256"],
        "sourceBuildingCount": len(seen), "lodCounts": dict(Counter(obj["lod"] for obj in source["objects"])),
        "triangles": triangles, "authoringCutTriangles": cuts, "materialCount": len(document["materials"]),
        "gltfBoundsM": [[min(v[i] for v in vertices) for i in range(3)], [max(v[i] for v in vertices) for i in range(3)]],
        "checks": ["file and input hashes", "all source IDs and LODs", "finite metric coordinates and retained height range", "160m crop and boundary sections", "triangle indices and nondegenerate geometry", "palette and linear color conversion", "no external asset dependencies or guide geometry"],
    }
    bridge = json.loads((ASSETS / "bridge-deck-study.json").read_text(encoding="utf-8"))
    bridge_manifest = manifest["bridgeStudy"]
    bridge_path = ASSETS / "dotonbori-bridge-deck-study.glb"
    require(bridge_manifest["glbSha256"] == digest(bridge_path), "Bridge GLB hash changed")
    require(bridge_manifest["glbBytes"] == bridge_path.stat().st_size, "Bridge GLB byte count changed")
    require(bridge_manifest["sourceSha256"] == digest(ASSETS / "bridge-deck-study.json"), "Bridge input changed")
    require(bridge_manifest["generatorSha256"] == digest(REPO / "scripts/blender/prepare-dotonbori-bridge.py"), "Bridge generator changed")
    require(bridge["sourceMeshSha256"] == manifest["sourceMeshSha256"], "Bridge registration uses different map input")
    bridge_document, bridge_binary = read_glb(bridge_path)
    require(len(bridge_document["nodes"]) == 1 and len(bridge_document["meshes"]) == 1, "Bridge inventory differs")
    bridge_node = bridge_document["nodes"][0]
    require(bridge_node["extras"]["id"] == bridge["id"] and not bridge_node["extras"]["finished_surface_verified"], "Bridge study certainty mislabeled")
    require(not any(key in bridge_node for key in ("matrix", "scale", "rotation", "translation", "children")), "Bridge transform differs")
    # Compare each exported position to the float32 representation of its
    # compiled source point, with the documented glTF axis conversion.
    positions = {struct.unpack("<3f", struct.pack("<3f", e, h, -n)) for e,n,h in bridge["vertices"]}
    bridge_triangles = 0
    exported_positions = set()
    for primitive in bridge_document["meshes"][0]["primitives"]:
        points = accessor(primitive["attributes"]["POSITION"], bridge_document, bridge_binary)
        require(set(points).issubset(positions), "Bridge export changes source coordinates")
        exported_positions.update(points)
        indices = [value[0] for value in accessor(primitive["indices"], bridge_document, bridge_binary)]
        require(len(indices) % 3 == 0 and all(0 <= i < len(points) for i in indices), "Bridge index buffer invalid")
        for i in range(0, len(indices), 3):
            a,b,c = [points[k] for k in indices[i:i+3]]
            area_twice = (b[0]-a[0])*(c[2]-a[2]) - (b[2]-a[2])*(c[0]-a[0])
            require(abs(area_twice) > 1e-8, "Degenerate bridge triangle")
        bridge_triangles += len(indices) // 3
    require(exported_positions == positions, "Bridge export omits source vertices")
    require(bridge_triangles == bridge_manifest["triangles"] == len(bridge["triangles"]), "Bridge triangle count differs")
    report["bridgeStudy"] = {"status": "pass", "claim": "dimensional-study export integrity only", "triangles": bridge_triangles, "glbSha256": bridge_manifest["glbSha256"]}
    (ASSETS / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    validate()
