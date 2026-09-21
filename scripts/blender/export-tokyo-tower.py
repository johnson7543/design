"""Export every evaluated MODEL mesh from the saved editable Tokyo Tower scene.

blender --background assets/design-qr/tokyo-tower/tower.blend \
  --python scripts/blender/export-tokyo-tower.py

No sampling, decimation, visibility filtering, or replacement geometry. Polygon
triangulation followed by three quads per triangle preserves complete surfaces.
"""
import hashlib
import json
import runpy
from pathlib import Path

import bpy
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets/design-qr/tokyo-tower"
ASSEMBLIES = ["legs", "lattice", "main-deck", "top-deck", "antenna", "access", "base"]
ROLES = ["orange", "white", "light", "window", "sky", "horizon", "metal", "ground", "paving", "glass", "foliage", "sodium"]
SOURCE_EXPOSURE = 16


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangle_area(a, b, c):
    return (b-a).cross(c-a).length/2


def export():
    if not bpy.data.filepath or Path(bpy.data.filepath).resolve() != (ASSETS / "tower.blend").resolve():
        raise RuntimeError("Open assets/design-qr/tokyo-tower/tower.blend before exporting")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
    depsgraph=bpy.context.evaluated_depsgraph_get()
    parts=[];inventory=[];objects=[];source_polygons=0;area_total=0;quad_total=0
    for assembly in ASSEMBLIES:
        collection=bpy.data.collections.get("MODEL · "+assembly)
        if not collection: raise RuntimeError("Missing MODEL collection: "+assembly)
        objects.extend((obj,assembly) for obj in collection.all_objects if obj.type=="MESH")
    if len({obj.name for obj,_ in objects})!=len(objects):
        raise RuntimeError("Each mesh must belong to exactly one MODEL assembly")
    bake=runpy.run_path(str(ROOT/"scripts/blender/bake-tokyo-tower-light.py"))["bake_tower_lighting"]
    lighting=bake(objects,depsgraph)
    def average(*colors):return tuple(sum(c[i] for c in colors)/len(colors) for i in range(3))
    def encoded(rgb):
        # Static exposure/shoulder is applied only to source light, never QR ink.
        exposed=[max(0,c)*SOURCE_EXPOSURE for c in rgb]
        # Compress channels individually: floodlit orange can roll into golden
        # highlights instead of staying dark, saturated red at every intensity.
        return [round(c/(1+c)*4095) for c in exposed]
    for obj,assembly in sorted(objects,key=lambda item:item[0].name):
        evaluated=obj.evaluated_get(depsgraph)
        data=evaluated.to_mesh()
        try:
            coords=[evaluated.matrix_world@v.co for v in data.vertices]
            by_material={}
            for poly in data.polygons:
                points=[coords[i] for i in poly.vertices]
                triangle_indices=tessellate_polygon([points])
                triangles=[[points[i] for i in triangle] for triangle in triangle_indices]
                corner_light=lighting[(obj.name,poly.index)]
                area=sum(triangle_area(*tri) for tri in triangles)
                if area<=1e-10: raise RuntimeError(f"Zero-area source face: {obj.name}/{poly.index}")
                source_polygons+=1;area_total+=area
                quads=[];quad_light=[]
                # Keep affine quads intact. Split other polygons into complete
                # triangle fans so no concave or triangular surface is dropped.
                if len(points)==4:
                    quads=[points]
                    quad_light=[corner_light]
                else:
                    for (a,b,c),(ia,ib,ic) in zip(triangles,triangle_indices):
                        mid=(a+b+c)/3
                        quads.extend([[a,(a+b)/2,mid,(c+a)/2], [b,(b+c)/2,mid,(a+b)/2], [c,(c+a)/2,mid,(b+c)/2]])
                        ca,cb,cc=corner_light[ia],corner_light[ib],corner_light[ic]
                        ab,bc,ac,center=average(ca,cb),average(cb,cc),average(ca,cc),average(ca,cb,cc)
                        quad_light.extend([[ca,ab,center,ac],[cb,bc,center,ab],[cc,ac,center,bc]])
                out_area=sum(triangle_area(q[0],q[1],q[2])+triangle_area(q[0],q[2],q[3]) for q in quads)
                if abs(out_area-area)>max(1e-5,area*1e-5):
                    raise RuntimeError(f"Surface area changed at {obj.name}/{poly.index}")
                by_material.setdefault(poly.material_index,[]).extend(zip(quads,quad_light))
            for slot,lit_quads in sorted(by_material.items()):
                mat=data.materials[slot]
                role=mat.get("palette_role") if mat else None
                if role not in ROLES: raise RuntimeError(f"Missing palette_role on {obj.name} material {slot}")
                part_id=obj.get("part_id",obj.name)+(f"-material-{slot}" if len(by_material)>1 else "")
                vertices=[];indices=[];lookup={};colors=[]
                for quad,lights in lit_quads:
                    for rgb in lights:colors.extend(encoded(rgb))
                    for point in quad:
                        # Fixed precision = export tolerance, not survey accuracy.
                        p=tuple(round(v*1000) for v in (point.x,point.z,-point.y))
                        if p not in lookup:
                            lookup[p]=len(vertices)//3;vertices.extend(p)
                        indices.append(lookup[p])
                luminous=bool(mat.get("luminous",False))
                parts.append([part_id,ASSEMBLIES.index(assembly),ROLES.index(role),luminous,vertices,indices,colors])
                quad_total+=len(lit_quads)
                inventory.append({"id":part_id,"blenderObject":obj.name,"assembly":assembly,"materialRole":role,
                                  "luminous":luminous,"vertices":len(vertices)//3,"surfaces":len(lit_quads)})
        finally:
            evaluated.to_mesh_clear()
    if len({p[0] for p in parts})!=len(parts): raise RuntimeError("Duplicate part identifiers")
    geometry=json.dumps(parts,separators=(",",":"))
    lighting_info={"engine":"Cycles","samples":32,"colorUnits":4095,"exposure":SOURCE_EXPOSURE,"compression":"per-channel-reinhard",
                   "landmarkFixtures":sum(bool(o.get("landmark_fixture")) for o in bpy.data.objects),
                   "passes":["direct","indirect","diffuse","emission"],"reference":"warm Landmark Light; interpreted fixture placement"}
    data={"version":4,"unitsPerMetre":1000,"tileMetres":320,"assemblies":ASSEMBLIES,"roles":ROLES,"lighting":lighting_info,
          "blendSha256":digest(ASSETS/"tower.blend"),"geometrySha256":hashlib.sha256(geometry.encode()).hexdigest(),"parts":parts}
    header="// Generated from the evaluated Blender master by scripts/blender/export-tokyo-tower.py.\n"
    header+="// Complete surfaces; millimetre export precision does not imply measured accuracy.\n"
    header+="export type BlenderTowerPartData = [id: string, assembly: number, role: number, luminous: boolean, vertices: number[], quads: number[], cornerLight: number[]];\n"
    header+="export const TOKYO_TOWER_BLENDER_DATA: { version: number; unitsPerMetre: number; tileMetres: number; assemblies: string[]; roles: string[]; lighting: { engine: string; samples: number; colorUnits: number; exposure: number; compression: string; landmarkFixtures: number; passes: string[]; reference: string }; blendSha256: string; geometrySha256: string; parts: BlenderTowerPartData[] } = "
    (ROOT/"packages/designqr/src/designs/city/tokyo-tower-blender-data.ts").write_text(header+json.dumps(data,separators=(",",":"))+";\n")
    # Portable editing export; native .blend remains the authoring source.
    lines=["# Tokyo Tower Blender export. Metres, Y up. Complete evaluated surfaces."];offset=1
    for name,_,_,_,vertices,quads,_ in parts:
        lines.append("o "+name)
        for i in range(0,len(vertices),3): lines.append("v "+" ".join(str(n/1000) for n in vertices[i:i+3]))
        for i in range(0,len(quads),4): lines.append("f "+" ".join(str(n+offset) for n in quads[i:i+4]))
        offset+=len(vertices)//3
    (ASSETS/"tower.obj").write_text("\n".join(lines)+"\n")
    report={"version":4,"generator":"scripts/blender/export-tokyo-tower.py","master":"assets/design-qr/tokyo-tower/tower.blend","lighting":lighting_info,
            "blenderVersion":bpy.app.version_string,"blendSha256":data["blendSha256"],"geometrySha256":data["geometrySha256"],
            "objSha256":digest(ASSETS/"tower.obj"),"status":"Blender-authored reference interpretation; not a measured reconstruction",
            "units":"metres; Y up in runtime and OBJ, Z up in Blender","towerHeightM":333,"mainDeckHeightM":120,"topDeckHeightM":223.5,
            "heightDatum":"construction GL; deck values identify floor levels, not visitor labels",
            "visitorDeckLabels":{"main":"150m","top":"250m"},
            "proportionReference":"https://www.miyaji-eng.co.jp/technology/newsletter/media/28/no28-p064-070.pdf#page=2",
            "counts":{"objects":len(objects),"parts":len(parts),"sourcePolygons":source_polygons,"surfaces":quad_total},
            "sourceSurfaceAreaM2":round(area_total,5),"parts":inventory}
    (ASSETS/"part-inventory.json").write_text(json.dumps(report,indent=2)+"\n")
    print("TOKYO TOWER BLENDER EXPORT",json.dumps(report["counts"]),flush=True)


if __name__=="__main__": export()
