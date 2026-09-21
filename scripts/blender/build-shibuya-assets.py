"""Original DesignQR models. Run with Blender --background --python this-file --.

Only the tagged DesignQR authoring scene is rebuilt. Native Blender coordinates
are Z-up; helpers accept runtime X/Y/Z and map them to X/-Z/Y before Y-up export.
Ordinary npm builds consume the checked-in GLB and do not execute this script.
"""
import argparse
import json
import math
from pathlib import Path
import re
import sys

import bpy

REPO = Path(__file__).resolve().parents[2]
SCENE_NAME = "DesignQR Shibuya Assets"
PALETTE_SOURCE = REPO / "packages/designqr/src/designs/city/palette.ts"
VEHICLE_SOURCE = REPO / "packages/designqr/src/designs/city/vehicles.ts"
EXPORT_DIR = REPO / "packages/designqr/src/designs/city/assets"
AUTHOR_DIR = REPO / "assets/design-qr/shibuya"


def palette():
    text = PALETTE_SOURCE.read_text(encoding="utf-8")
    values = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", text))
    return {key: values[key] for key in ["eveningSky", "highRise", "blue", "gold", "bay", "navy", "charcoal", "coral", "ivory"]}


def srgb_linear(hex_value):
    values = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values]


class Model:
    def __init__(self, asset_id, scene, materials, metadata):
        self.asset_id, self.scene, self.materials = asset_id, scene, materials
        self.root = bpy.data.objects.new(asset_id, None)
        self.root["asset_id"] = asset_id
        self.root["designqr_owned"] = True
        scene.collection.objects.link(self.root)
        self.vertices, self.faces, self.roles = [], [], []
        self.metadata = {"id": asset_id, "root": asset_id, **metadata}

    def shape(self, vertices, faces, role):
        offset = len(self.vertices)
        self.vertices.extend((x, -z, y) for x, y, z in vertices)
        self.faces.extend(tuple(offset + i for i in face) for face in faces)
        self.roles.extend([role] * len(faces))

    def box(self, x, y, z, w, h, d, role):
        self.shape([(x + sx * w / 2, y + sy * h / 2, z + sz * d / 2)
                    for sx, sy, sz in [(-1,-1,-1), (1,-1,-1), (1,1,-1), (-1,1,-1), (-1,-1,1), (1,-1,1), (1,1,1), (-1,1,1)]],
                   [(0,3,2,1), (4,5,6,7), (0,4,7,3), (1,2,6,5), (0,1,5,4), (3,7,6,2)], role)

    def loft(self, sections, role):
        # Cross-sections: Z, half-width, lower Y, upper Y, roof inset.
        vertices = []
        for z, w, low, high, inset in sections:
            vertices.extend([(-w, low, z), (w, low, z), (w * inset, high, z), (-w * inset, high, z)])
        faces = [(3,2,1,0)]
        for s in range(len(sections) - 1):
            a, b = s * 4, (s + 1) * 4
            faces.extend((a + i, a + (i + 1) % 4, b + (i + 1) % 4, b + i) for i in range(4))
        end = (len(sections) - 1) * 4
        faces.append((end, end + 1, end + 2, end + 3))
        self.shape(vertices, faces, role)

    def cylinder(self, x, y, z, radius, height, role, segments=24, axis="y"):
        vertices = []
        for side in [-1, 1]:
            for i in range(segments):
                angle = i / segments * math.tau
                a, b = math.cos(angle) * radius, math.sin(angle) * radius
                vertices.append((x + (side * height / 2 if axis == "x" else a), y + (a if axis == "x" else side * height / 2), z + b))
        faces = [tuple(reversed(range(segments))), tuple(range(segments, segments * 2))]
        faces += [(i, (i + 1) % segments, (i + 1) % segments + segments, i + segments) for i in range(segments)]
        self.shape(vertices, faces, role)

    def node(self, name, position, **extras):
        obj = bpy.data.objects.new(name, None)
        self.scene.collection.objects.link(obj)
        obj.parent = self.root
        x, y, z = position
        obj.location = (x, -z, y)
        for key, value in extras.items():
            obj[key] = value
        return obj

    def finish(self, bevel=0):
        mesh = bpy.data.meshes.new(self.asset_id + "-geometry")
        mesh["designqr_owned"] = True
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(self.asset_id + "-body", mesh)
        self.scene.collection.objects.link(obj)
        obj.parent = self.root
        obj["part_id"] = "body"
        roles = sorted(set(self.roles))
        for role in roles:
            mesh.materials.append(self.materials[role])
        for poly, role in zip(mesh.polygons, self.roles):
            poly.material_index = roles.index(role)
        if bevel:
            modifier = obj.modifiers.new("Readable edge chamfers", "BEVEL")
            modifier.width = bevel
            modifier.segments = 1
        # Recalculate consistently after arbitrary loft/cylinder construction.
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.normal_update()
        # Open artwork/window quads have an authored front. Recalculation on
        # disconnected zero-volume faces can arbitrarily flip individual panels.
        open_normals = {face: face.normal.copy() for face in bm.faces if all(edge.is_boundary for edge in face.edges)}
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        for face, normal in open_normals.items():
            if face.normal.dot(normal) < 0:
                face.normal_flip()
        bm.to_mesh(mesh)
        bm.free()
        if self.metadata["kind"] == "sign":
            uv = mesh.uv_layers.new(name="Sign artwork")
            arc = self.metadata["arc"]
            for loop in mesh.loops:
                point = mesh.vertices[loop.vertex_index].co
                uv.data[loop.index].uv = (math.atan2(point.x, -point.y) / arc + .5, point.z + .5)
        self.metadata["nodes"] = [self.root.name] + [child.name for child in self.root.children]
        return self.metadata


def vehicle_specs():
    text = VEHICLE_SOURCE.read_text(encoding="utf-8")
    values = re.findall(r"(sedan|taxi|van|bus):\s*\{\s*width:\s*([.\d]+),\s*length:\s*([.\d]+),\s*height:\s*([.\d]+)", text)
    if len(values) != 4:
        raise ValueError("Cannot resolve authoritative runtime vehicle dimensions")
    return {kind: {"width": float(w), "length": float(length), "height": float(h)} for kind, w, length, h in values}


def build_vehicle(kind, spec, scene, materials, wheel_mesh):
    w, length, h = spec["width"], spec["length"], spec["height"]
    tall = kind in ("van", "bus")
    radius = .0046 if kind == "bus" else .004 if kind == "van" else .0036
    model = Model("vehicle-" + kind, scene, materials, {"kind": "vehicle", "dimensions": [w, h, length],
        "forward": "+Z", "ground": 0, "wheelRadius": radius, "wheelWidth": .0026,
        "wheelbase": length * .62, "track": w, "paintRole": "vehicle-body"})
    model.loft([(-length*.50, w*.40, .004, .011, .97), (-length*.40, w*.50, .004, .013, .98),
                (length*.39, w*.50, .004, .013, .98), (length*.50, w*.40, .005, .011, .94)], "vehicle-body")
    rear, front = (-.42, .38) if tall else (-.29, .22)
    model.loft([(length*rear, w*.44, .012, .013, .95), (length*(rear+.10), w*.44, .012, h, .84),
                (length*(front-.10), w*.44, .012, h, .84), (length*front, w*.44, .012, .013, .95)], "vehicle-body")
    # Angled windscreen and backlight match the roof's sloped end faces.
    for end, lower, upper in [(-1, rear, rear+.10), (1, front, front-.10)]:
        model.shape([(-w*.36,.013,length*lower+end*.0002), (w*.36,.013,length*lower+end*.0002),
                     (w*.33,h-.001,length*upper+end*.0002), (-w*.33,h-.001,length*upper+end*.0002)], [(0,1,2,3) if end > 0 else (3,2,1,0)], "glass")
    window_count = 7 if kind == "bus" else 3 if tall else 2
    window_span = length * (front - rear - .22)
    for side in [-1, 1]:
        for i in range(window_count):
            z = length*(rear+.11) + (i+.5)/window_count*window_span
            # Slightly inset tops follow the trapezoidal cabin's flank.
            model.shape([(side*w*.438,.013,z-window_span/window_count*.39), (side*w*.438,.013,z+window_span/window_count*.39),
                         (side*w*.376,h-.0018,z+window_span/window_count*.39), (side*w*.376,h-.0018,z-window_span/window_count*.39)], [(3,2,1,0) if side > 0 else (0,1,2,3)], "glass")
            model.box(side*w*.498, .0105, z, .0006, .0007, .003, "metal")
        model.box(side*(w*.50+.0005), .0085, 0, .0008, .0012, length*.76, "metal")
        model.box(side*(w*.50+.001), .014, length*.16, .002, .0015, .0025, "vehicle-body")
        if kind == "bus":
            model.box(side*w*.499, .0115, 0, .0008, .0024, length*.90, "blue")
            model.box(side*w*.441, .017, length*.26, .0007, .013, .005, "glassLight")
        for axle in [-1, 1]:
            anchor = model.node(f"{kind}-wheel-{'l' if side < 0 else 'r'}-{'rear' if axle < 0 else 'front'}",
                                (side*w/2, radius, axle*length*.31), part_id="wheel")
            wheel = bpy.data.objects.new(anchor.name + "-mesh", wheel_mesh)
            scene.collection.objects.link(wheel)
            wheel.parent = anchor
            wheel.scale = (.0026 / 1.2, radius, radius)
            wheel["part_id"] = "wheel"
    for end in [-1, 1]:
        model.box(0, .0065, end*length*.498, w*.78, .0015, .001, "metal")
        model.box(0, .009, end*length*.502, w*.28, .0025, .0005, "ink")
        for side in [-1, 1]:
            model.box(side*w*.30, .011, end*length*.492, w*.20, .0026, .001, "light" if end > 0 else "coral")
    if kind == "taxi":
        model.box(0, h+.002, -.001, .0075, .003, .0035, "ivory")
        model.box(0, h+.002, .0009, .005, .0017, .0004, "gold")
        model.node("taxi-roof-sign", (0, h+.002, 0), part_id="roof-sign")
    if kind == "bus":
        model.box(0, h+.0014, -length*.13, w*.65, .0028, length*.25, "metal")
        model.box(0, h-.002, length*.40, w*.65, .002, .0006, "gold")
    return model.finish(.00035)


def build_wheel(scene, materials):
    model = Model("wheel", scene, materials, {"kind": "wheel", "dimensions": [1.2, 2, 2], "axle": "+X"})
    model.cylinder(0, 0, 0, 1, 1, "ink", 8, "x")
    for side in [-1, 1]:
        model.cylinder(side*.54, 0, 0, .62, .12, "metal", 8, "x")
        model.cylinder(side*.605, 0, 0, .27, .015, "blue", 6, "x")
        # Two readable spokes make runtime wheel rotation visible without a rig.
        model.box(side*.612, .20, 0, .01, .65, .12, "ink")
    metadata = model.finish()
    model.root.location = (.12, 0, .004)
    model.root.scale = (.004, .004, .004)
    return metadata, model.root.children[0].data


def build_metro(scene, materials):
    w, length, h = .026, .076, .041
    body = Model("metro-carriage", scene, materials, {"kind": "metro", "dimensions": [w, h, length],
        "forward": "+Z", "ground": 0, "carSpacing": .081, "trackHeight": .106})
    body.loft([(-length*.5, w*.47, .007, .034, .96), (-length*.46, w*.50, .006, .037, .91),
               (length*.46, w*.50, .006, .037, .91), (length*.5, w*.47, .007, .034, .96)], "metal")
    for side in [-1, 1]:
        body.box(side*w*.5, .014, 0, .0006, .004, length*.98, "blue")
        for i in range(8):
            z = (i - 3.5)*.0082
            door = i in (1, 2, 5, 6)
            body.box(side*w*.502, .021 if door else .026, z, .0005, .023 if door else .013, .0065, "glassLight" if door else "glass")
            if door:
                body.box(side*w*.515, .023, z, .0005, .016, .0005, "metal")
        for axle in [-1, 1]:
            body.box(0, .004, axle*length*.29, w*.8, .006, .015, "ink")
            for dz in [-.0045, .0045]:
                body.cylinder(side*w*.42, .003, axle*length*.29+dz, .003, .003, "ink", 10, "x")
    for end in [-1, 1]:
        body.box(0, .010, end*(length/2+.001), .005, .003, .002, "roof")
        body.node("metro-coupler-" + ("front" if end > 0 else "rear"), (0, .010, end*length/2), part_id="coupler")
    for z in [-.019, .019]:
        body.box(0, .039, z, w*.65, .004, .017, "roof")
        body.box(0, .0411, z, w*.48, .0003, .012, "metal")
    metadata = body.finish()
    cab = Model("metro-cab", scene, materials, {"kind": "metro", "dimensions": [w, h, length], "forward": "+Z"})
    cab.box(0, .025, length*.504, w*.80, .017, .0006, "glass")
    cab.box(0, .025, length*.51, .0012, .017, .0005, "metal")
    cab.box(0, .0345, length*.51, w*.52, .0028, .0005, "gold")
    for side in [-1, 1]:
        cab.box(side*w*.31, .012, length*.511, .003, .0025, .0006, "gold")
    cab.node("metro-cab-end", (0, 0, length/2), part_id="cab")
    return [metadata, cab.finish()]


def build_landmarks(scene, materials):
    source_path = AUTHOR_DIR / "landmark-meshes.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    data_path = REPO / "packages/designqr/src/designs/city/building-data.ts"
    import hashlib
    if source["sourceSha256"] != hashlib.sha256(data_path.read_bytes()).hexdigest():
        raise RuntimeError("Run node scripts/blender/prepare-shibuya-landmarks.mjs before Blender export")
    by_swatch = {mat["swatch"]: role for role, mat in materials.items() if role != "vehicle-body"}
    assets = []
    for spec in source["models"]:
        metadata = {"kind": "building", "dimensions": [1.04, 1.08, 1.04],
                    "morphProxy": "footprint", "ground": 0, "sourceSha256": source["sourceSha256"]}
        if "logoPosition" in spec:
            metadata.update(logoAnchor="qfront-logo-anchor",
                            logoPosition=spec["logoPosition"], logoYaw=spec["logoYaw"])
        model = Model(spec["id"], scene, materials, metadata)
        positions = spec["positions"]
        for i, swatch in enumerate(spec["swatches"]):
            model.shape([positions[i*9+j:i*9+j+3] for j in (0, 3, 6)], [(0, 1, 2)], by_swatch[swatch])
        if "logoPosition" in spec:
            anchor = model.node("qfront-logo-anchor", spec["logoPosition"], part_id="logo-anchor")
            anchor.rotation_euler.z = spec["logoYaw"]
        assets.append(model.finish())
    return assets


def build(only=None):
    original_scene = bpy.context.window.scene if bpy.context.window else None
    previous = bpy.data.scenes.get(SCENE_NAME)
    if previous:
        if not previous.get("designqr_owned"):
            raise RuntimeError("An unrelated scene already uses the authoring name")
        if original_scene == previous:
            original_scene = next((s for s in bpy.data.scenes if s != previous), None)
            if bpy.context.window and original_scene:
                bpy.context.window.scene = original_scene
        owned_objects = list(previous.objects)
        owned_meshes = {obj.data for obj in owned_objects if obj.type == "MESH"}
        owned_materials = {mat for mesh in owned_meshes for mat in mesh.materials if mat}
        bpy.data.scenes.remove(previous)
        for obj in owned_objects:
            if obj.users == 0:
                bpy.data.objects.remove(obj)
        for mesh in owned_meshes:
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for material in owned_materials:
            if material.users == 0:
                bpy.data.materials.remove(material)
    scene = bpy.data.scenes.new(SCENE_NAME)
    scene["designqr_owned"] = True
    scene["asset_schema"] = "designqr-shibuya-assets/2"
    if bpy.context.window:
        bpy.context.window.scene = scene
    swatches = palette()
    roles = {"vehicle-body": "gold", "glass": "blue", "glassLight": "bay", "metal": "highRise", "ink": "navy",
             "light": "gold", "gold": "gold", "coral": "coral", "ivory": "ivory", "blue": "blue", "roof": "charcoal", "sky": "eveningSky"}
    materials = {}
    for role, swatch in roles.items():
        material = bpy.data.materials.new("designqr-" + role)
        material["palette_role"] = role
        material["designqr_owned"] = True
        material["swatch"] = swatches[swatch]
        material.diffuse_color = (*srgb_linear(swatches[swatch]), 1)
        material.use_nodes = True
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = material.diffuse_color
        shader.inputs["Roughness"].default_value = .65
        materials[role] = material
    specs = vehicle_specs()
    selected = [only] if only else list(specs)
    wheel, wheel_mesh = build_wheel(scene, materials)
    assets = [wheel] + [build_vehicle(kind, specs[kind], scene, materials, wheel_mesh) for kind in selected]
    if not only:
        assets += build_metro(scene, materials) + build_landmarks(scene, materials)
    # An editable showroom, independent of runtime placement and dimensions.
    for i, kind in enumerate(selected):
        bpy.data.objects["vehicle-"+kind].location.x = -.12 + i*.036
    for name, x in [("building-qfront", -.23), ("building-magnet", .20)]:
        if name in bpy.data.objects and bpy.data.objects[name] in scene.objects.values():
            obj = bpy.data.objects[name]
            obj.location = (x, .22, 0)
            obj.scale = (.20, .20, .32)
    for name in ["metro-carriage", "metro-cab"]:
        if name in scene.objects:
            scene.objects[name].location.y = -.085
    scene.view_settings.view_transform = "Standard"
    scene.unit_settings.system = "NONE"
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    AUTHOR_DIR.mkdir(parents=True, exist_ok=True)
    glb_path = EXPORT_DIR / "shibuya.glb"
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", use_active_scene=True,
            export_yup=True, export_extras=True, export_apply=True, export_animations=False,
            export_cameras=False, export_lights=False, export_materials="EXPORT", export_texcoords=True)
    bpy.data.libraries.write(str(AUTHOR_DIR / "shibuya-assets.blend"), {scene}, fake_user=True, compress=True)
    manifest = {"schema": "designqr-shibuya-assets", "version": 2, "blender": bpy.app.version_string,
        "authoringUp": "+Z", "runtimeUp": "+Y", "vehicleForward": "+Z", "assets": assets,
        "materials": {materials[role].name: {"role": role, "swatch": swatches[swatch]} for role, swatch in roles.items()},
        "provenance": "Original facades on modified PLATEAU Shibuya 2025 footprints; no reference media, external textures, or uploaded logos. See docs/designqr-package/cities/shibuya/architecture.md."}
    (EXPORT_DIR / "shibuya-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if bpy.context.window and original_scene:
        bpy.context.window.scene = original_scene
    print(json.dumps({"assets": [a["id"] for a in assets], "glb": str(glb_path), "bytes": glb_path.stat().st_size,
        "source": str(AUTHOR_DIR / "shibuya-assets.blend"), "original_scene": original_scene.name if original_scene else None}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["taxi", "sedan", "van", "bus"])
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    build(args.only)
