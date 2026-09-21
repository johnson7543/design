"""Export the complete bridge-centered square without modifying the source study.

Run prepare-dotonbori-focus.py first, then run this script in Blender. All
exports retain metric east/north/elevation coordinates; the player applies
the documented rigid rotation, recentering and uniform scale.
"""

import hashlib
import importlib.util
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "assets/design-qr/dotonbori"
OWNER = "designqr-dotonbori-focus"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    source_path, layout_path = ASSETS / "east-source-meshes.json", ASSETS / "focus-layout.json"
    source, layout = [json.loads(path.read_text(encoding="utf-8")) for path in (source_path, layout_path)]
    if layout["version"] != 5 or layout["sourceMeshSha256"] != digest(source_path):
        raise ValueError("Recompile the focus layout: source geometry changed")
    spec = importlib.util.spec_from_file_location("dotonbori_study", Path(__file__).with_name("build-dotonbori-study.py"))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    previous_scene = bpy.context.window.scene if bpy.context.window else None
    scene = bpy.data.scenes.new("DesignQR Dotonbori Canal Focus")
    scene["designqr_owner"] = OWNER
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene["focus_layout_sha256"] = digest(layout_path)
    palette = helper.read_palette()
    roles = {"source-wall": "ivory", "source-roof": "highRise", "lod1-unresolved": "coral", "authoring-cut": "gold"}
    materials = [helper.make_material("focus-" + role, palette[swatch]) for role, swatch in roles.items()]
    for material in materials:
        material["designqr_owner"] = OWNER
    east, north = layout["centerEastNorthM"]
    r, half = math.sqrt(.5), layout["tileSizeM"] / 2
    center = Vector((east, north, 0))
    planes = [(center + Vector((dx * half, dy * half, 0)), Vector((dx, dy, 0)))
              for dx, dy in [(r, r), (-r, -r), (r, -r), (-r, r)]]
    selected = {obj["sourceId"]: obj for obj in layout["objects"]}
    objects, inventory = [], []
    try:
        for record in source["objects"]:
            if record["id"] not in selected:
                continue
            obj = helper.source_object(record, scene.collection, materials)
            offset = Vector((*selected[record["id"]]["translationEastNorthM"], 0))
            for vertex in obj.data.vertices:
                vertex.co += offset
            obj["presentation_translation_east_north_m"] = list(offset)[:2]
            obj["designqr_owner"] = OWNER
            obj.data["designqr_owner"] = OWNER
            obj.name = record["auditLabel"] + " canal focus " + record["id"]
            obj["boundary_operation"] = "Clipped to complete canal square; gold faces are authoring sections"
            bm = bmesh.new()
            try:
                bm.from_mesh(obj.data)
                cuts = 0
                for point, normal in planes:
                    cut = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                        dist=1e-6, plane_co=point, plane_no=normal, clear_outer=True)
                    edges = [element for element in cut["geom_cut"] if isinstance(element, bmesh.types.BMEdge) and element.is_boundary]
                    if edges:
                        filled = bmesh.ops.holes_fill(bm, edges=edges, sides=0)
                        for face in filled["faces"]:
                            face.material_index = 3
                            cuts += 1
                boundary = [v for v in bm.verts if any(abs((v.co - point).dot(normal)) < 1e-5 for point, normal in planes)]
                # Diagonal intersections may differ by a float32 ULP. Weld
                # only boundary vertices within 0.01 mm; retain interior data.
                bmesh.ops.remove_doubles(bm, verts=boundary, dist=1e-5)
                bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-6)
                bmesh.ops.triangulate(bm, faces=list(bm.faces))
                bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() <= 5e-9], context="FACES_ONLY")
                # Removing a zero-area cut triangle can leave isolated wires.
                # These are clipping debris, not source surfaces or open walls.
                loose_edges = [edge for edge in bm.edges if not edge.link_faces]
                loose_edge_count = len(loose_edges)
                bmesh.ops.delete(bm, geom=loose_edges, context="EDGES")
                bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
                bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
                if not bm.faces or any(not edge.is_manifold for edge in bm.edges):
                    print(json.dumps({"label": record["auditLabel"], "nonManifold": [[list(v.co) for v in edge.verts] for edge in bm.edges if not edge.is_manifold]}))
                    raise ValueError("Focused building needs topology review: " + record["auditLabel"])
                if any((v.co - point).dot(normal) > 2e-5 for v in bm.verts for point, normal in planes):
                    raise ValueError("Focused building extends beyond the crop")
                retained = [Vector(p) + offset for p in record["vertices"] if all((Vector(p) + offset - point).dot(normal) < -2e-5 for point, normal in planes)]
                max_error = max((min((v.co - p).length for v in bm.verts) for p in retained), default=0)
                if max_error > 3e-5:
                    raise ValueError("An interior source vertex changed")
                bm.to_mesh(obj.data)
            finally:
                bm.free()
            obj.data.update()
            obj.data.calc_loop_triangles()
            objects.append(obj)
            inventory.append({"sourceId": record["id"], "auditLabel": record["auditLabel"], "lod": record["lod"],
                "variationIndex": selected[record["id"]]["variationIndex"],
                "translationEastNorthM": list(offset)[:2],
                "triangles": len(obj.data.loop_triangles), "authoringCutFaces": cuts, "nonManifoldEdges": 0,
                "removedLooseCutEdges": loose_edge_count,
                "retainedSourceVertices": len(retained), "retainedVertexMaxErrorM": max_error,
                "maximumHeightM": max(v.co.z for v in obj.data.vertices)})
        if len(objects) != len(selected):
            raise ValueError("Focus inventory differs from its layout")
        if bpy.context.window:
            bpy.context.window.scene = scene
        for obj in objects:
            obj.select_set(True)
        with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
            bpy.ops.export_scene.gltf(filepath=str(ASSETS / "dotonbori-focus.glb"), export_format="GLB",
                use_selection=True, use_active_scene=True, export_cameras=False, export_lights=False,
                export_materials="EXPORT", export_extras=True, export_texcoords=False, export_animations=False)
        bpy.data.libraries.write(str(ASSETS / "dotonbori-focus.blend"), {scene}, fake_user=True, compress=True)
        report = {
            "schema": "designqr-dotonbori-focus", "version": 5, "units": "metres",
            "gltfAxes": ["east", "source-height", "south"], "blenderVersion": bpy.app.version_string,
            "sourceMeshSha256": digest(source_path), "layoutSha256": digest(layout_path),
            "generatorSha256": digest(Path(__file__)), "sourceBuildingCount": len(source["objects"]),
            "focusedBuildingCount": len(objects), "triangleCount": sum(obj["triangles"] for obj in inventory),
            "glbBytes": (ASSETS / "dotonbori-focus.glb").stat().st_size, "glbSha256": digest(ASSETS / "dotonbori-focus.glb"),
            "blendSha256": digest(ASSETS / "dotonbori-focus.blend"),
            "materials": {material.name: {"role": role, "swatch": material["swatch"]} for role, material in zip(roles, materials)},
            "objects": inventory,
            "boundaryWeldToleranceM": 1e-5,
            "validation": "Closed building topology, crop coverage and retained source vertices verified. Not a site-accuracy certification.",
        }
        (ASSETS / "focus-manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({key: report[key] for key in ("focusedBuildingCount", "triangleCount", "glbBytes")}))
    finally:
        if bpy.context.window and previous_scene:
            bpy.context.window.scene = previous_scene
        # The editable focused file is separate. Leave the user's open scene,
        # source master, selection, materials and objects untouched.
        for obj in list(scene.objects):
            mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        bpy.data.scenes.remove(scene)
        for material in materials:
            if material.users == 0:
                bpy.data.materials.remove(material)


if __name__ == "__main__":
    build()
