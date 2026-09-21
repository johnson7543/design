"""Bake the saved Blender light rig onto the full evaluated mesh with Cycles.

One temporary mesh allows all steel members to cast shadows on one another.
The editable objects are never joined or decimated. Return linear per-corner
radiance, keyed by original object and polygon, for complete surface export.
"""
import bpy


def bake_tower_lighting(objects, depsgraph):
    vertices=[];polygons=[];slots=[];materials=[];material_ids={};sources=[]
    for obj,_ in objects:
        evaluated=obj.evaluated_get(depsgraph);data=evaluated.to_mesh()
        try:
            offset=len(vertices)
            vertices.extend(evaluated.matrix_world@v.co for v in data.vertices)
            for poly in data.polygons:
                mat=data.materials[poly.material_index]
                if mat.name not in material_ids:
                    material_ids[mat.name]=len(materials);materials.append(mat)
                polygons.append(tuple(i+offset for i in poly.vertices));slots.append(material_ids[mat.name])
                sources.append((obj.name,poly.index))
        finally:
            evaluated.to_mesh_clear()
    mesh=bpy.data.meshes.new("TEMP · complete tower light bake")
    mesh.from_pydata(vertices,[],polygons);mesh.update()
    for mat in materials:mesh.materials.append(mat)
    for poly,slot in zip(mesh.polygons,slots):poly.material_index=slot
    attr=mesh.color_attributes.new(name="TowerNight",type="FLOAT_COLOR",domain="CORNER")
    mesh.color_attributes.active_color=attr
    target=bpy.data.objects.new(mesh.name,mesh);bpy.context.scene.collection.objects.link(target)
    previous=[(obj,obj.hide_render) for obj,_ in objects]
    scene=bpy.context.scene;old_samples=scene.cycles.samples
    try:
        for obj,_ in previous:obj.hide_render=True
        bpy.ops.object.select_all(action="DESELECT")
        target.select_set(True);bpy.context.view_layer.objects.active=target
        scene.cycles.samples=32
        print(f"Baking Landmark Light onto {len(mesh.loops)} complete surface corners",flush=True)
        bpy.ops.object.bake(type="COMBINED",target="VERTEX_COLORS",pass_filter={"DIRECT","INDIRECT","COLOR","DIFFUSE","EMIT"},use_clear=True)
        result={}
        for key,poly in zip(sources,mesh.polygons):
            result[key]=[tuple(max(0,float(c)) for c in attr.data[i].color[:3]) for i in poly.loop_indices]
        peak=max(c for colors in result.values() for rgb in colors for c in rgb)
        if peak<=0:raise RuntimeError("Cycles returned an empty light bake")
        print(f"Cycles night bake complete; peak linear radiance {peak:.3f}",flush=True)
        return result
    finally:
        scene.cycles.samples=old_samples
        for obj,hidden in previous:obj.hide_render=hidden
        bpy.data.objects.remove(target,do_unlink=True);bpy.data.meshes.remove(mesh)
