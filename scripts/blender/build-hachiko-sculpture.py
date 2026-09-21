"""Author the reference-based seated Hachiko bronze in a dedicated Blender scene.

Run: blender --background --python scripts/blender/build-hachiko-sculpture.py
Coordinates passed to helpers are metres, Y-up, +Z toward the statue's face.
The city places this compact, palette-free mesh in Hachiko Square.
See docs/designqr-package/cities/shibuya/hachiko-square.md for references and accuracy boundaries.
"""
import hashlib
import json
import math
from pathlib import Path
import re

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[2]
SCENE_NAME = "DesignQR Hachiko Sculpture"
TAG = "designqr_hachiko"
OUT = REPO / "packages/designqr/src/designs/city/hachiko-sculpture-data.ts"


def native(p):
    return Vector((p[0], -p[2], p[1]))


def sphere(name, position, radii, material, tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=native(position))
    obj = bpy.context.object
    obj.name = name
    obj[TAG] = True
    obj.scale = (radii[0], radii[2], radii[1])
    obj.rotation_euler.x = tilt
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def tube(name, points, radii, material, segments=10):
    vertices, faces = [], []
    points = [native(p) for p in points]
    for i, p in enumerate(points):
        direction = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        side = direction.cross(Vector((1, 0, 0)))
        if side.length < .01:
            side = direction.cross(Vector((0, 1, 0)))
        side.normalize()
        up = direction.cross(side).normalized()
        for j in range(segments):
            angle = math.tau * j / segments
            vertices.append(p + radii[i] * (side * math.cos(angle) + up * math.sin(angle)))
    faces.append(tuple(reversed(range(segments))))
    for i in range(len(points) - 1):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple(range((len(points) - 1) * segments, len(points) * segments)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj[TAG] = True
    mesh.materials.append(material)
    return obj


def ear(name, side, folded, material):
    # Asymmetric ears are part of the bronze, not a generic symmetric Akita head.
    x = side * .125
    tip = (side * (.222 if folded else .169), 1.218 if folded else 1.308, .083)
    vertices = [(x - .067, 1.145, .025), (x + .067, 1.145, .025),
                (x + .06, 1.157, .188), (x - .06, 1.157, .188), tip,
                (tip[0], tip[1] - .028, .155)]
    faces = [(0, 3, 2, 1), (0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([native(p) for p in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj[TAG] = True
    mesh.materials.append(material)
    return obj


def main():
    previous = bpy.context.window.scene
    old = bpy.data.scenes.get(SCENE_NAME)
    if old and not old.get(TAG):
        raise RuntimeError("Refusing to replace an unowned Blender scene")
    if old:
        for obj in list(old.objects):
            if not obj.get(TAG):
                raise RuntimeError("An unowned object was added to the authoring scene")
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        if previous == old:
            previous = next(s for s in bpy.data.scenes if s != old)
            bpy.context.window.scene = previous
        bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new(SCENE_NAME)
    scene[TAG] = True
    bpy.context.window.scene = scene
    try:
        source = (REPO / "packages/designqr/src/designs/city/palette.ts").read_text(encoding="utf-8")
        swatches = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", source))
        materials = []
        for role, key in [("bronze", "charcoal"), ("recess", "navy")]:
            mat = bpy.data.materials.new("Hachiko " + role)
            mat[TAG] = True
            rgb = [int(swatches[key][i:i + 2], 16) / 255 for i in (1, 3, 5)]
            linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
            mat.diffuse_color = (*linear, 1)
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            bsdf.inputs["Base Color"].default_value = (*linear, 1)
            bsdf.inputs["Metallic"].default_value = .72
            bsdf.inputs["Roughness"].default_value = .54
            materials.append(mat)
        bronze, recess = materials
        parts = []
        def mass(name, p, r, tilt=0):
            parts.append(sphere(name, p, r, bronze, tilt))
        mass("Seated pelvis", (0, .254, -.288), (.216, .254, .29))
        mass("Sloping back and ribcage", (0, .525, -.135), (.198, .372, .229), .46)
        mass("Upright chest", (0, .664, .059), (.173, .295, .181), .12)
        mass("Thick neck ruff", (0, .886, .091), (.176, .262, .184), .10)
        mass("Akita skull", (0, 1.077, .151), (.176, .161, .18))
        mass("Broad cheek", (0, 1.012, .226), (.156, .105, .135))
        mass("Raised tapered muzzle", (0, 1.062, .337), (.107, .078, .14), -.12)
        mass("Lower jaw", (0, 1.008, .318), (.095, .043, .127))
        for side in [-1, 1]:
            mass("Folded hindquarter " + str(side), (side * .170, .187, -.276), (.110, .168, .222), .16)
            mass("Hind paw " + str(side), (side * .186, .043, -.065), (.086, .047, .152))
            mass("Shoulder " + str(side), (side * .135, .611, .123), (.084, .180, .102))
            parts.append(tube("Straight foreleg " + str(side),
                [(side * .136, .627, .146), (side * .137, .432, .161),
                 (side * .137, .194, .199), (side * .14, .066, .235)], [.07, .059, .044, .049], bronze, 16))
            mass("Front paw " + str(side), (side * .14, .045, .289), (.07, .044, .104))
            mass("Brow " + str(side), (side * .119, 1.117, .254), (.067, .038, .055), side * .15)
        parts += [ear("Upright right ear", -1, False, bronze), ear("Lowered left ear", 1, True, bronze)]
        parts.append(tube("Tail resting behind the haunches", [(0, .211, -.455), (-.028, .13, -.574),
            (-.092, .080, -.687), (-.15, .054, -.807), (-.218, .04, -.901), (-.259, .037, -.943)],
            [.077, .074, .068, .051, .029, .008], bronze, 16))
        # Preserve the editable anatomical masses in the .blend, independently
        # of the fused/decimated surface shipped to browsers.
        studies = bpy.data.collections.new("Editable anatomical studies")
        scene.collection.children.link(studies)
        for obj in parts:
            copy = obj.copy()
            copy.data = obj.data.copy()
            studies.objects.link(copy)
        studies.hide_viewport = True
        studies.hide_render = True
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        dog = bpy.context.object
        dog.name = "Hachiko unified bronze"
        remesh = dog.modifiers.new("Fuse sculpted anatomy", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = .009
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth = dog.modifiers.new("Blend anatomical transitions", "SMOOTH")
        smooth.factor = .62
        smooth.iterations = 4
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        texture = bpy.data.textures.new("Hachiko cast bronze tool marks", type="CLOUDS")
        texture.noise_scale = .023
        texture.noise_depth = 1
        displace = dog.modifiers.new("Subtle cast fur surface", "DISPLACE")
        displace.texture = texture
        displace.strength = .012
        displace.mid_level = .5
        bpy.ops.object.modifier_apply(modifier=displace.name)
        decimate = dog.modifiers.new("Miniature mesh budget", "DECIMATE")
        decimate.ratio = min(1, 3500 / (len(dog.data.polygons) * 2))
        bpy.ops.object.modifier_apply(modifier=decimate.name)
        finished = [(dog, 0)]
        finished.append((sphere("Broad bronze nose", (0, 1.066, .451), (.083, .047, .036), recess), 1))
        for side in [-1, 1]:
            finished.append((sphere("Inset eye " + str(side), (side * .135, 1.096, .274), (.021, .014, .012), recess), 1))
            finished.append((tube("Mouth crease " + str(side), [(side * .07, 1.015, .426),
                (side * .099, 1.012, .352), (side * .125, 1.017, .270)], [.004, .005, .003], recess, 6), 1))
            for toe in [-1, 1]:
                finished.append((tube("Forepaw toe groove", [(side * .14 + toe * .021, .066, .382),
                    (side * .14 + toe * .021, .079, .343)], [.0027, .0018], recess, 5), 1))
        collar_points = [(.187 * math.cos(i * math.tau / 48), .854, .09 + .187 * math.sin(i * math.tau / 48)) for i in range(49)]
        finished.append((tube("Narrow collar", collar_points, [.010] * len(collar_points), bronze, 6), 0))
        positions, indices, face_roles = [], [], []
        # Scale height to the photo-interpreted 1.2 m sculpture, not the first
        # (1934) statue's often-quoted 1.62 m archival measurement.
        sculpture_scale = 1.2 / 1.308
        for obj, role in finished:
            obj.data.calc_loop_triangles()
            offset = len(positions) // 3
            for vertex in obj.data.vertices:
                p = obj.matrix_world @ vertex.co
                positions.extend(round(v * sculpture_scale * 10000) for v in (p.x, p.z, -p.y))
            for triangle in obj.data.loop_triangles:
                indices.extend(offset + v for v in triangle.vertices)
                face_roles.append(role)
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
        data = {"version": 1, "unitsPerMetre": 10000, "forward": "+Z", "heightMetres": 1.2,
            "authoringSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "positions": positions, "indices": indices, "faceRoles": face_roles}
        OUT.write_text("// Generated by scripts/blender/build-hachiko-sculpture.py. Do not hand-edit.\n"
            "// Original reference-based geometry; integer coordinates in 0.1 mm authoring units, Y-up, +Z forward.\n"
            "// Numeric precision is not surveyed accuracy. See docs/designqr-package/cities/shibuya/hachiko-square.md.\n"
            "export const HACHIKO_SCULPTURE_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")
        scene["model_contract"] = "1948 seated bronze; east-facing in city; photo-interpreted proportions"
        scene["references"] = "docs/designqr-package/cities/shibuya/hachiko-square.md"
        scene.unit_settings.system = "METRIC"
        bpy.ops.object.select_all(action="DESELECT")
        dog.select_set(True)
        bpy.context.view_layer.objects.active = dog
        for area in bpy.context.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_distance = 2.8
                area.spaces.active.region_3d.view_location = (0, .15, .65)
                area.spaces.active.shading.color_type = "MATERIAL"
        target = REPO / "assets/design-qr/shibuya/hachiko-sculpture.blend"
        bpy.ops.wm.save_as_mainfile(filepath=str(target), copy=True)
        print(json.dumps({"vertices": len(positions) // 3, "triangles": len(indices) // 3,
            "source": str(target), "runtime": str(OUT), "bytes": OUT.stat().st_size}))
    finally:
        bpy.context.window.scene = previous


if __name__ == "__main__":
    main()
