"""Build a separate editable review from the actual runtime's metric snapshot.

Run export-dotonbori-waterfront.mjs --artwork first. Existing source masters and
the user's open scene are preserved. Runtime delivery remains procedural detail
plus the reviewed source GLBs, not this Blender review snapshot.
"""
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "assets/design-qr/dotonbori"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    source_path = ASSETS / "waterfront-review-meshes.json"
    data = json.loads(source_path.read_text())
    if data["schema"] != "designqr-dotonbori-waterfront-review" or data["version"] != 3:
        raise ValueError("Regenerate the waterfront snapshot with the current exporter")
    for name, expected in data["sources"].items():
        if digest(REPO / name) != expected:
            raise ValueError("Regenerate waterfront snapshot: " + name)
    window = bpy.context.window
    old_scene = bpy.context.scene
    scene = bpy.data.scenes.new("Dotonbori Waterfront Review")
    created, meshes, materials, images, cameras = [], [], [], [], []
    try:
        if window:
            window.scene = scene
        scene.unit_settings.system = "METRIC"
        scene["evidence"] = data["status"]
        scene["references"] = "docs/designqr-package/cities/dotonbori/sources.md"
        scene["runtime_snapshot_sha256"] = digest(source_path)
        for record in data["objects"]:
            positions, indices = record["positions"], record["triangles"]
            if not all(math.isfinite(n) for n in positions + record["colors"]):
                raise ValueError("Nonfinite geometry")
            mesh = bpy.data.meshes.new(record["id"])
            meshes.append(mesh)
            mesh.from_pydata([positions[i:i + 3] for i in range(0, len(positions), 3)], [],
                             [indices[i:i + 3] for i in range(0, len(indices), 3)])
            mesh.update()
            obj = bpy.data.objects.new(record["id"], mesh)
            obj["evidence"] = record["evidence"]
            obj["source_building"] = record.get("sourceBuilding", "")
            scene.collection.objects.link(obj)
            created.append(obj)
            attr = mesh.color_attributes.new(name="display_color", type="FLOAT_COLOR", domain="CORNER")
            values = []
            for loop in mesh.loops:
                i = loop.vertex_index * 3
                values.extend(record["colors"][i:i + 3] + [1])
            attr.data.foreach_set("color", values)
            mat = bpy.data.materials.new(record["id"] + " display")
            materials.append(mat)
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            nodes.clear()
            output = nodes.new("ShaderNodeOutputMaterial")
            emission = nodes.new("ShaderNodeEmission")
            if record.get("texture"):
                image = bpy.data.images.load(str(ASSETS / record["texture"]), check_existing=False)
                image.pack()
                images.append(image)
                paint = nodes.new("ShaderNodeTexImage")
                paint.image = image
                uv = mesh.uv_layers.new(name="UVMap")
                for loop in mesh.loops:
                    i = loop.vertex_index * 2
                    uv.data[loop.index].uv = record["uv"][i:i + 2]
            else:
                paint = nodes.new("ShaderNodeVertexColor")
                paint.layer_name = "display_color"
            mat.node_tree.links.new(paint.outputs["Color"], emission.inputs["Color"])
            mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
            mesh.materials.append(mat)
        camera = bpy.data.cameras.new("Dotonbori waterfront camera")
        cameras.append(camera)
        camera.type = "PERSP"
        camera.lens = 32
        camera.sensor_fit = "HORIZONTAL"
        camera_obj = bpy.data.objects.new(camera.name, camera)
        created.append(camera_obj)
        scene.collection.objects.link(camera_obj)
        def set_view(name):
            view = data["reviewViews"][name]
            camera_obj.location = view["eye"]
            camera_obj.rotation_euler = (Vector(view["target"]) - camera_obj.location).to_track_quat("-Z", "Y").to_euler()

        set_view("default")
        scene.camera = camera_obj
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 1400
        scene.render.resolution_y = 1100
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.film_transparent = True
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
        scene.render.filepath = str(ASSETS / "reviews/waterfront-axonometric.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        # The east oblique exposes B034's photographed ribbed fronts and signs.
        set_view("east")
        scene.render.filepath = str(ASSETS / "reviews/waterfront-night-east.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        set_view("default")
        scene.render.filepath = str(ASSETS / "reviews/waterfront-axonometric.png")
        blend_path = ASSETS / "dotonbori-waterfront.blend"
        bpy.data.libraries.write(str(blend_path), {scene}, fake_user=True, compress=True)
        result = {"schema": "designqr-dotonbori-waterfront-review", "version": 3,
                  "status": data["status"], "units": "metres", "axes": data["axes"],
                  "objectCount": len(data["objects"]),
                  "content": data["content"], "reviewViews": data["reviewViews"],
                  "triangleCount": sum(len(o["triangles"]) // 3 for o in data["objects"]),
                  "runtimeSnapshotSha256": digest(source_path), "generatorSha256": digest(Path(__file__)),
                  "blendSha256": digest(blend_path), "blendBytes": blend_path.stat().st_size,
                  "artwork": {name: digest(ASSETS / name) for name in ["glico-panel.png", "bridge-name.png", "night-signs.png", "generated-signs.png", "storefronts.png"]}}
        (ASSETS / "waterfront-review-manifest.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result))
    finally:
        if window:
            window.scene = old_scene
        bpy.data.scenes.remove(scene)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in meshes:
            bpy.data.meshes.remove(mesh)
        for mat in materials:
            bpy.data.materials.remove(mat)
        for image in images:
            bpy.data.images.remove(image)
        for camera in cameras:
            bpy.data.cameras.remove(camera)


if __name__ == "__main__":
    build()
