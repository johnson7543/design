"""Author the Tokyo Tower miniature in Blender, then export the evaluated meshes.

blender --background --python scripts/blender/build-tokyo-tower.py -- --render
For manual mesh edits, open tower.blend and run export-tokyo-tower.py instead.
Metric helpers use Y up/+Z front; the editable Blender scene uses native Z up.
Construction elevations follow Miyaji's Tokyo Tower renovation drawing, Fig. 1.
Visitor deck names (150m / 250m) are not construction GL coordinates.
"""
import argparse
import json
import math
from pathlib import Path
import runpy
import subprocess
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets/design-qr/tokyo-tower"
TAG = "designqr_tower"
COLLECTIONS = {}
MATERIALS = {}
CUBE_FACES = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
LANDMARK_ZONES = [(4,40,29,25,48000),(25,33,20,54,42000),(54,21.5,14,84,34000),
                  (84,14,11,114,24000),(113,11.4,9,137,18000),(136,9.5,7.7,170,15000),
                  (175,7.5,5.6,210,12000),(211,5.8,4.7,243,10000),(255,3.7,1.3,300,12500)]
LANDMARK_POWER_BOOST = 3


def native(p):
    return Vector((p[0], -p[2], p[1]))


def linear(hex_value):
    values = [int(hex_value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


def material(role, glow=False):
    key = (role, glow)
    if key in MATERIALS:
        return MATERIALS[key]
    mat = bpy.data.materials.new(role + (" · luminous" if glow else ""))
    mat["palette_role"] = role
    mat["luminous"] = glow
    mat.diffuse_color = (*PALETTE[role], 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*PALETTE[role], 1)
    bsdf.inputs["Metallic"].default_value = .18 if role in ("orange", "white", "metal") else .08
    bsdf.inputs["Roughness"].default_value = .3 if role in ("glass", "window") else .48
    if glow:
        bsdf.inputs["Emission Color"].default_value = (*PALETTE[role], 1)
        bsdf.inputs["Emission Strength"].default_value = 7 if role in ("light", "sodium") else .22
    MATERIALS[key] = mat
    return mat


def mesh(name, assembly, points, faces, role="orange", glow=False):
    data = bpy.data.meshes.new(name)
    # Center each independently editable part; object transforms remain useful.
    points = [native(p) for p in points]
    center = sum(points, Vector()) / len(points)
    data.from_pydata([p - center for p in points], [], faces)
    normals = bmesh.new(); normals.from_mesh(data)
    bmesh.ops.recalc_face_normals(normals, faces=list(normals.faces))
    normals.to_mesh(data); normals.free()
    data.update()
    obj = bpy.data.objects.new(name, data)
    COLLECTIONS[assembly].objects.link(obj)
    obj.location = center
    obj[TAG] = True
    obj["assembly"] = assembly
    obj["part_id"] = name
    obj.data.materials.append(material(role, glow))
    return obj


def box(name, assembly, center, size, role="orange", glow=False, yaw=0):
    c, s = math.cos(yaw), math.sin(yaw)
    points = []
    for x in (-1, 1):
        for y in (-1, 1):
            for z in (-1, 1):
                dx, dz = x*size[0]/2, z*size[2]/2
                points.append((center[0]+dx*c+dz*s, center[1]+y*size[1]/2, center[2]-dx*s+dz*c))
    return mesh(name, assembly, points, CUBE_FACES, role, glow)


def beam(name, assembly, a, b, width, role="orange", depth=None, glow=False):
    a, b = Vector(a), Vector(b)
    direction = (b-a).normalized()
    right = direction.cross(Vector((0, 0, 1)))
    if right.length < .01:
        right = direction.cross(Vector((1, 0, 0)))
    right.normalize()
    front = right.cross(direction).normalized()
    center = (a+b)/2
    points = [center + right*x*width/2 + direction*y*(b-a).length/2 + front*z*(depth or width)/2
              for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    return mesh(name, assembly, points, CUBE_FACES, role, glow)


def profile(name, assembly, rings, role="orange", sides=8, center=(0, 0), phase=math.pi/8, square=False, glow=False):
    points = []
    for y, radius in rings:
        if square:
            cut = radius * .18
            outline = [(-radius+cut,-radius),(radius-cut,-radius),(radius,-radius+cut),(radius,radius-cut),
                       (radius-cut,radius),(-radius+cut,radius),(-radius,radius-cut),(-radius,-radius+cut)]
        else:
            outline = [(math.cos(phase+i*math.tau/sides)*radius, math.sin(phase+i*math.tau/sides)*radius) for i in range(sides)]
        points.extend((x+center[0], y, z+center[1]) for x,z in outline)
    faces = [tuple(reversed(range(sides)))]
    for level in range(len(rings)-1):
        for i in range(sides):
            j = (i+1)%sides
            faces.append((level*sides+i,level*sides+j,(level+1)*sides+j,(level+1)*sides+i))
    faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    return mesh(name, assembly, points, faces, role, glow)


def band(y):
    # Seven alternating bands above the Main Deck, ending in orange at the tip.
    return "white" if y >= 130 and int((y-130)/29)%2 == 1 else "orange"


def turn(p, side):
    a = side*math.pi/2
    return (p[0]*math.cos(a)+p[2]*math.sin(a),p[1],-p[0]*math.sin(a)+p[2]*math.cos(a))


def structure():
    # Four open box trusses, rather than a single rod at each corner.
    # Trace of the contractor's elevation: broad feet, a low arch, four
    # braced bays across the lower body, and a neck below the 120m deck floor.
    # Heights/widths between the published GL anchors remain visual estimates.
    levels = [(3,43,7.5),(12,38.9,7.2),(25,32.8,6.3),(40,26.8,5.6),
              (53,21.7,4.8),(66,17.6,4.1),(79,14.7,3.5),(91,12.8,3.0),
              (101,11.8,2.6),(110,11.2,2.3),(116.5,10.8,2.0)]
    for sx in (-1,1):
        for sz in (-1,1):
            def nodes(level):
                y, half, thick = levels[level]
                return [(sx*(half-dx*thick),y,sz*(half-dz*thick)) for dx,dz in [(0,0),(1,0),(1,1),(0,1)]]
            for level in range(len(levels)-1):
                low, high = nodes(level),nodes(level+1)
                for corner in range(4):
                    key = f"leg-{sx}-{sz}-{level}-{corner}"
                    nxt=(corner+1)%4
                    beam(key+"-chord","legs",low[corner],high[corner],.9 if level>4 else 1.35)
                    beam(key+"-belt","legs",high[corner],high[nxt],.36)
                    beam(key+"-web-a","legs",low[corner],high[nxt],.34)
                    beam(key+"-web-b","legs",low[nxt],high[corner],.34)
                if level%2==0:
                    box(f"leg-{sx}-{sz}-{level}-gusset","legs",low[0],(2.1,1.8,1.6))
            profile(f"footing-{sx}-{sz}","legs",[(0,7.0),(2,7.0),(3.3,5.7)],"paving",center=(sx*40,sz*40),square=True)
            box(f"footlight-{sx}-{sz}","legs",(sx*40,3.5,sz*40),(7,.28,7),"light",True)

    # Arches and double-layer cross braces are open all the way through.
    for side in range(4):
        for step in range(16):
            def arch(t, upper):
                return turn(((t-.5)*80,3+math.sin(t*math.pi)*(37 if upper else 32),40-math.sin(t*math.pi)*13.2),side)
            for upper in (False,True):
                beam(f"arch-{side}-{step}-{upper}","legs",arch(step/16,upper),arch((step+1)/16,upper),.85)
            beam(f"arch-web-{side}-{step}","legs",arch(step/16,False),arch((step+1)/16,True),.38)
        for level in range(3,len(levels)-1):
            y0,w0,_=levels[level]; y1,w1,_=levels[level+1]
            a,b=turn((-w0,y0,w0),side),turn((w0,y0,w0),side)
            c,d=turn((-w1,y1,w1),side),turn((w1,y1,w1),side)
            beam(f"lower-cross-a-{side}-{level}","lattice",a,d,.75)
            beam(f"lower-cross-b-{side}-{level}","lattice",b,c,.75)
            beam(f"lower-belt-{side}-{level}","lattice",c,d,.7)
            mid=(Vector(a)+Vector(d))/2
            box(f"lower-joint-{side}-{level}","lattice",mid,(1.25,1.9,1.25))
            # Secondary subdivision gives the lower silhouette its fine steel weave.
            top=(Vector(c)+Vector(d))/2; bottom=(Vector(a)+Vector(b))/2
            beam(f"secondary-a-{side}-{level}","lattice",bottom,c,.3)
            beam(f"secondary-b-{side}-{level}","lattice",bottom,d,.3)
            beam(f"secondary-post-{side}-{level}","lattice",bottom,top,.35)
            # The real lower tower has intermediate posts and multiple bays,
            # not an empty arch followed by only a single giant X per face.
            for fraction in (-.5,.5):
                beam(f"lower-inner-post-{side}-{level}-{fraction}","lattice",
                     turn((w0*fraction,y0,w0),side),turn((w1*fraction,y1,w1),side),.48)
            for panel in range(4):
                lo,hi=-1+panel*.5,-.5+panel*.5
                beam(f"lower-bay-a-{side}-{level}-{panel}","lattice",turn((w0*lo,y0,w0),side),turn((w1*hi,y1,w1),side),.31)
                beam(f"lower-bay-b-{side}-{level}-{panel}","lattice",turn((w0*hi,y0,w0),side),turn((w1*lo,y1,w1),side),.31)
    upper=[(131.5,9.4),(145,8.9),(158,8.2),(171,7.5),(184,6.8),(197,6.1),(210,5.6),(217,5.2),(234,4.8),(252.65,3.5)]
    for level in range(len(upper)-1):
        y0,w0=upper[level];y1,w1=upper[level+1]
        for side in range(4):
            a,b=turn((-w0,y0,w0),side),turn((w0,y0,w0),side)
            c,d=turn((-w1,y1,w1),side),turn((w1,y1,w1),side)
            paint=band((y0+y1)/2)
            beam(f"upper-chord-{level}-{side}","lattice",a,c,.8,paint)
            beam(f"upper-belt-{level}-{side}","lattice",c,d,.5,band(y1))
            beam(f"upper-cross-a-{level}-{side}","lattice",a,d,.5,paint)
            beam(f"upper-cross-b-{level}-{side}","lattice",b,c,.5,paint)
            middle=(Vector(a)+Vector(d))/2
            beam(f"upper-secondary-{level}-{side}","lattice",(Vector(a)+Vector(b))/2,(Vector(c)+Vector(d))/2,.24,paint)
            box(f"upper-joint-{level}-{side}","lattice",middle,(1.1,1.25,1.1),paint)
            if level%2==0:
                beam(f"antenna-boom-{level}-{side}","lattice",turn((0,y1,w1),side),turn((0,y1,w1+3),side),.35,paint)
                box(f"antenna-receiver-{level}-{side}","lattice",turn((0,y1+1,w1+3),side),(1,2.4,.6),"white",yaw=side*math.pi/2)
    # Visible bolted splice plates and floodlight housings.
    for side in range(4):
        for i,(y,w,_) in enumerate(levels[1:]):
            p=turn((w,y,w),side)
            box(f"splice-{side}-{i}","legs",p,(2.0,1.6,1.4))
            for offset in (-.55,.55):
                box(f"bolt-{side}-{i}-{offset}","legs",(p[0]+offset,p[1],p[2]+.75),(.25,.25,.18),"metal")
            if i%2==0:
                box(f"uplight-housing-{side}-{i}","legs",turn((w-1,y+.8,w-1),side),(1.9,.9,1.4),"metal")
                box(f"uplight-lens-{side}-{i}","legs",turn((w-1,y+1.3,w-1),side),(1.5,.15,1.05),"light",True)


def decks():
    # Construction GL: H11 floor 120m; the enclosure is about 30m across.
    # Preserve both occupied storeys and the flared underside in the silhouette.
    profile("main-deck-undercroft","main-deck",[(110.3,10.7),(116.8,14.3),(117.4,14.7)],square=True)
    profile("main-deck-shell","main-deck",[(117.4,14.6),(128.9,14.6)],"glass",square=True)
    profile("main-deck-lower-cornice","main-deck",[(117.3,14.7),(118,15.1),(118.4,15.1)],"orange",square=True)
    profile("main-deck-waist","main-deck",[(122.6,14.9),(123.3,14.9)],"orange",square=True)
    profile("main-deck-roof","main-deck",[(128.9,15.3),(129.4,15.3),(130.4,13.1)],"metal",square=True)
    profile("main-deck-roof-light","main-deck",[(128.8,15.35),(129.1,15.35)],"light",square=True,glow=True)
    for side in range(4):
        for storey in range(2):
            y=120.0+storey*5.6
            for pane in range(16):
                x=(pane-7.5)*1.44
                key=f"main-deck-window-{side}-{storey}-{pane}"
                box(key,"main-deck",turn((x,y,14.78),side),(1.22,4.3,.20),"window" if (pane+storey)%6==0 else "glass",(pane+storey)%6==0,yaw=side*math.pi/2)
                beam(key+"-mullion","main-deck",turn((x-.69,y-2.3,14.94),side),turn((x-.69,y+2.3,14.94),side),.17,"metal")
        for x in (-12.1,12.1):
            beam(f"main-corner-column-{side}-{x}","main-deck",turn((x,117.2,14.7),side),turn((x,129.1,14.7),side),.55,"white")
        for x in range(-12,13,3):
            beam(f"main-bracket-{side}-{x}","main-deck",turn((x*.71,111.3,10.9),side),turn((x,117.4,14.7),side),.5)
        beam(f"main-roof-rail-{side}","main-deck",turn((-11.5,132.5,12.1),side),turn((11.5,132.5,12.1),side),.22,"white")
        for x in range(-12,13,3):
            beam(f"main-roof-post-{side}-{x}","main-deck",turn((x,131.3,12.1),side),turn((x,132.5,12.1),side),.17,"white")
    # Rounded Top Deck and stacked antenna maintenance collars match the reference silhouette.
    # H23 / upper observation floor is GL+223.5m in the construction drawing.
    profile("top-deck-bowl","top-deck",[(215.8,4.9),(217.8,6.7),(219,7.1)],"white",sides=16)
    profile("top-deck-shell","top-deck",[(219,6.8),(226.4,6.8)],"glass",sides=16)
    for i in range(32):
        a=i*math.tau/32
        box(f"top-deck-window-{i}","top-deck",(math.sin(a)*6.85,222.7,math.cos(a)*6.85),(1.06,5.9,.24),"window" if i%6==0 else "glass",i%6==0,yaw=a)
        beam(f"top-deck-mullion-{i}","top-deck",(math.sin(a+.095)*6.99,219.3,math.cos(a+.095)*6.99),(math.sin(a+.095)*6.99,226.2,math.cos(a+.095)*6.99),.22,"white")
    profile("top-deck-roof","top-deck",[(226.4,7.3),(227.1,7.3),(228.1,5.3)],"metal",sides=16)
    profile("top-deck-tiara","top-deck",[(227.1,7.4),(227.4,7.4)],"light",sides=16,glow=True)
    profile("antenna-service-platform","antenna",[(231.5,6),(232.5,6)],"white",sides=16)
    for i in range(16):
        a=i*math.tau/16
        beam(f"antenna-platform-post-{i}","antenna",(math.sin(a)*5.8,232.5,math.cos(a)*5.8),(math.sin(a)*5.8,233.9,math.cos(a)*5.8),.16,"white")
    profile("antenna-platform-rail","antenna",[(233.7,5.9),(233.9,5.9)],"white",sides=16)
    profile("antenna-transmitter-cowl","antenna",[(242.6,4.5),(244,6),(251,6),(252.65,3.2)],"orange",sides=16)
    for i in range(6):
        y=244.3+i*1.1
        profile(f"antenna-transmitter-rib-{i}","antenna",[(y,6.15),(y+.22,6.15)],"white" if i<3 else "orange",sides=16)
    # Open antenna support, with braced bays up to the ST support. The old
    # solid tapered needle omitted the photographed steelwork entirely.
    mast=[(252.65,2.5),(260,2.5),(269,2.2),(278,1.9),(287,1.6),(296,1.3),(304,1.05),(312.6,.72)]
    for i,((y0,w0),(y1,w1)) in enumerate(zip(mast,mast[1:])):
        for side in range(4):
            a,b=turn((-w0,y0,w0),side),turn((w0,y0,w0),side)
            c,d=turn((-w1,y1,w1),side),turn((w1,y1,w1),side)
            paint=band((y0+y1)/2)
            beam(f"antenna-mast-chord-{i}-{side}","antenna",a,c,.28,paint)
            beam(f"antenna-mast-belt-{i}-{side}","antenna",c,d,.18,band(y1))
            beam(f"antenna-mast-web-a-{i}-{side}","antenna",a,d,.16,paint)
            beam(f"antenna-mast-web-b-{i}-{side}","antenna",b,c,.16,paint)
    profile("antenna-st-support","antenna",[(312.6,.62),(325.5,.4),(331.8,.22)],"orange",sides=8)
    for i in range(7):
        y=313+i*2.0
        profile(f"antenna-st-collar-{i}","antenna",[(y,.85-i*.05),(y+.22,.85-i*.05)],"orange",sides=8)
    profile("antenna-beacon","antenna",[(331.8,.52),(333,.18)],"orange",sides=8,glow=True)


def access():
    for x in (-1.9,1.9):
        box(f"lift-guide-{x}","access",(x,68,0),(.4,104,3.5),"metal")
    box("lift-core","access",(0,68,0),(3,104,3),"glass")
    # The upper observation deck is served through the central tower spine,
    # visible behind the open lattice in the elevation and official photos.
    box("upper-lift-core","access",(0,177.5,0),(2.4,92,2.4),"glass")
    for x in (-1.5,1.5):
        beam(f"upper-lift-guide-{x}","access",(x,131.5,0),(x,223.5,0),.35,"metal")
    for i in range(18):
        y=132+i*5
        beam(f"upper-lift-spine-{i}","access",(-1.5,y,1.5),(1.5,min(y+5,223.5),1.5),.19,band(y))
        beam(f"upper-lift-belt-{i}","access",(-1.5,y,1.5),(1.5,y,1.5),.2,band(y))
    for i in range(24):
        y=18+i*4.25; sign=1 if i%2==0 else -1
        a=(-3.7*sign,y,4.7);b=(3.7*sign,y+4.25,4.7)
        for z in (3.55,5.85):
            beam(f"stair-stringer-{i}-{z}","access",(a[0],a[1],z),(b[0],b[1],z),.28)
            beam(f"stair-handrail-{i}-{z}","access",(a[0],a[1]+1.1,z),(b[0],b[1]+1.1,z),.13,"light")
        for j in range(12):
            t=j/12
            box(f"stair-tread-{i}-{j}","access",(a[0]+(b[0]-a[0])*t,y+4.25*t,4.7),(.67,.16,2.5),"metal")
            if j%3==0:
                beam(f"stair-baluster-{i}-{j}","access",(a[0]+(b[0]-a[0])*t,y+4.25*t,5.85),(a[0]+(b[0]-a[0])*t,y+4.25*t+1.1,5.85),.11,"orange")
        box(f"stair-landing-{i}","access",(b[0],y+4.25,4.7),(2.5,.24,3.2),"orange")


def setting():
    profile("island","base",[(-3,159),(-1,160),(0,158)],"ground",square=True)
    profile("forecourt","base",[(.02,71),(.45,71),(.6,70)],"paving",square=True)
    # Extra receiving vertices preserve local uplight falloff and steel shadows
    # in the vertex bake; the entire paving surface also participates in the QR.
    grid=[(x,.602,z) for z in range(-60,61,5) for x in range(-60,61,5)]
    grid_faces=[(z*25+x,(z+1)*25+x,(z+1)*25+x+1,z*25+x+1) for z in range(24) for x in range(24)]
    mesh("lit-forecourt-surface","base",grid,grid_faces,"paving")
    box("entry-walk","base",(0,.18,111),(28,.3,88),"paving")
    box("foot-town","base",(0,7,0),(64,14,51),"metal")
    box("foot-town-roof","base",(0,14.7,0),(66,1.4,54),"paving")
    box("foot-town-penthouse","base",(-10,16.8,-4),(29,3.2,18),"metal")
    for side in range(4):
        yaw=side*math.pi/2
        facade=26 if side%2==0 else 32.5
        for y in (1.2,5.0,9.5,13.8):
            box(f"foot-town-cornice-{side}-{y}","base",turn((0,y,facade),side),(53,.55,.75),"paving",yaw=yaw)
        for i in range(13):
            x=(i-6)*4
            for y in (3.0,7.3,11.6):
                box(f"base-window-{side}-{i}-{y}","base",turn((x,y,facade+.1),side),(3.3,2.8,.3),"window" if i%4 else "glass",i%4!=0,yaw=yaw)
            box(f"base-pier-{side}-{i}","base",turn((x-1.9,7.5,facade+.4),side),(.55,13,1.4),"paving",yaw=yaw)
        for i in range(7):
            box(f"roof-vent-{side}-{i}","base",turn(((i-3)*3.5,15.7,21),side),(1.8,1.1,2.6),"metal",yaw=yaw)
    box("entry-canopy","base",(0,5.5,33),(30,.65,13),"paving")
    box("entry-canopy-light","base",(0,5.13,37.5),(27,.15,.65),"light",True)
    for x in (-13,13):
        box(f"entry-column-{x}","base",(x,2.65,37),(.65,5.3,.65),"metal")
    # Preserve the shared logo anchor at the front of Foot Town.
    box("logo-panel","base",(0,10.4,26.4),(14,6.2,.5),"sky")
    for x in range(-60,61,12):
        box(f"paving-joint-x-{x}","base",(x,.63,0),(.18,.03,138),"metal")
        box(f"paving-joint-z-{x}","base",(0,.63,x),(138,.03,.18),"metal")
    for side in (-1,1):
        for i in range(5):
            x=side*(88+(i%2)*14);z=-88+i*42
            profile(f"garden-bed-{side}-{i}","base",[(.05,12),(1.6,12)],"paving",center=(x,z),square=True)
            profile(f"garden-soil-{side}-{i}","base",[(1.6,11.2),(1.7,11.2)],"ground",center=(x,z),square=True)
            beam(f"tree-trunk-{side}-{i}","base",(x,1.6,z),(x,13,z),1.05,"metal")
            # Faceted broadleaf crowns: rounded tiers, not stacked boxes.
            for j,(dx,dz,h,r) in enumerate([(0,0,13,7.3),(-4,1,10,5.3),(3,-3,11,5.2)]):
                profile(f"tree-crown-{side}-{i}-{j}","base",[(h-r*.6,r*.35),(h-r*.25,r),(h+r*.4,r*.82),(h+r*.85,r*.2)],"foliage",sides=8,center=(x+dx,z+dz))
            bx=side*74
            box(f"bench-seat-{side}-{i}","base",(bx,1.3,z),(3.8,.45,9),"paving")
            for dz in (-3,3):
                box(f"bench-leg-{side}-{i}-{dz}","base",(bx,.6,z+dz),(2.8,1.2,.6),"metal")
            beam(f"lamp-post-{side}-{i}","base",(side*63,.6,z),(side*63,8,z),.42,"metal")
            profile(f"lamp-head-{side}-{i}","base",[(7.8,1.6),(8.3,1.1)],"light",center=(side*63,z),glow=True)
    for side in (-1,1):
        for i in range(5):
            box(f"walk-light-{side}-{i}","base",(side*15,.42,79+i*15),(.7,.35,5.5),"light",True)


def review_scene():
    scene=bpy.context.scene
    scene.name="Tokyo Tower · warm night"
    scene.unit_settings.system="METRIC"
    scene.world=bpy.data.worlds.new("Tokyo night")
    scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value=(*PALETTE["sky"],1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value=.45
    rig=bpy.data.collections.new("REVIEW · cameras and lights (not geometry)")
    scene.collection.children.link(rig)
    def lamp(name,at,target,role,power,size):
        data=bpy.data.lights.new(name,"AREA");data.energy=power;data.color=PALETTE[role];data.shape="DISK";data.size=size
        obj=bpy.data.objects.new(name,data);rig.objects.link(obj);obj.location=native(at)
        obj.rotation_euler=(native(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    lamp("Quiet city bounce",(90,90,150),(0,70,0),"light",95000,200)
    lamp("Moon fill",(-120,280,-160),(0,130,0),"white",210000,190)
    # The operator publishes 180 Landmark Light fixtures. Positions here are
    # an authored arrangement matching the photographed bands, not a survey.
    rig["reference"]="https://www.tokyotower.co.jp/lightup/"
    for zone,(y,w,target_w,target_y,power) in enumerate(LANDMARK_ZONES):
        for side in range(4):
            for index in range(5):
                across=(index-2)/2
                at=turn((across*w*.94,y,w+2.4),side)
                target=turn((across*target_w*.9,target_y,target_w),side)
                key=f"landmark-{zone}-{side}-{index}"
                data=bpy.data.lights.new(key,"SPOT");data.energy=power*LANDMARK_POWER_BOOST;data.color=PALETTE["sodium"]
                data.spot_size=math.radians(67);data.spot_blend=.7;data.shadow_soft_size=.8
                direction=(native(target)-native(at)).normalized()
                obj=bpy.data.objects.new(key,data);rig.objects.link(obj)
                # Put the emitter beyond its opaque lens/housing, so the
                # physical fixture cannot shadow its own upward beam.
                obj.location=native(at)+direction*.9
                obj.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
                obj["landmark_fixture"]=True
                box(key+"-housing","legs" if zone<5 else "lattice",at,(1.05,.65,1.15),"metal",yaw=side*math.pi/2)
                box(key+"-lens","legs" if zone<5 else "lattice",(at[0],at[1]+.36,at[2]),(.8,.12,.85),"sodium",True,yaw=side*math.pi/2)
    for name,at,target,scale in [("Hero night",(430,295,600),(0,138,0),470),("Front elevation",(0,166.5,750),(0,166.5,0),370),
                                 ("Deck detail",(110,157,168),(0,124,0),85),("Base detail",(180,100,235),(0,37,0),170)]:
        data=bpy.data.cameras.new(name);data.type="ORTHO";data.ortho_scale=scale;data.clip_end=3000
        obj=bpy.data.objects.new(name,data);rig.objects.link(obj);obj.location=native(at)
        obj.rotation_euler=(native(target)-obj.location).to_track_quat('-Z','Y').to_euler()
        if name=="Hero night":scene.camera=obj
    scene.render.engine="CYCLES"
    scene.cycles.samples=48;scene.cycles.use_denoising=True
    scene.render.resolution_x=1100;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.view_settings.view_transform="AgX"
    scene.render.image_settings.file_format="PNG"
    scene.use_nodes=True
    nodes=scene.node_tree.nodes;nodes.clear()
    layers=nodes.new("CompositorNodeRLayers");glare=nodes.new("CompositorNodeGlare");glare.glare_type="FOG_GLOW";glare.quality="HIGH";glare.threshold=1.8
    output=nodes.new("CompositorNodeComposite")
    scene.node_tree.links.new(layers.outputs["Image"],glare.inputs["Image"]);scene.node_tree.links.new(glare.outputs["Image"],output.inputs["Image"])
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_perspective="CAMERA"
                area.spaces.active.clip_end=3000
    notes=bpy.data.texts.new("READ ME · authoring and QR export")
    notes.write("Tokyo Tower / DesignQR\n\nEditable Blender master, native Z-up metres.\nAll objects in the seven MODEL collections contribute their entire evaluated surface to the QR.\nREVIEW holds four cameras and the light rig: 180 warm Landmark spots plus two environment fills.\nThe rig is baked with Cycles for the web player. Positions/power are interpreted, not surveyed.\n\nAfter manual edits: run scripts/blender/export-tokyo-tower.py in this file.\nDo not rerun the build script unless intentionally regenerating the original model.\nMaterial slots carry palette_role and luminous metadata.\nConstruction GL anchors: 333 m tip; Main Deck floor 120 m; Top Deck floor 223.5 m; H27 252.65 m.\nThe visitor labels 150m / 250m are not construction coordinates.\nSee docs/designqr-package/cities/tokyo-tower/proportions-reference.md for the contractor elevation and limits.\n")
    scene["proportion_reference"]="https://www.miyaji-eng.co.jp/technology/newsletter/media/28/no28-p064-070.pdf#page=2"
    scene["construction_main_deck_floor_m"]=120.0
    scene["construction_top_deck_floor_m"]=223.5


def relight_existing():
    """Reapply the authored brighter rig without rebuilding or moving geometry."""
    bpy.ops.wm.open_mainfile(filepath=str(ASSETS/"tower.blend"))
    fixtures=[obj for obj in bpy.data.objects if obj.get("landmark_fixture")]
    if len(fixtures)!=180:raise RuntimeError("Expected the existing 180-fixture Landmark rig")
    for obj in fixtures:
        zone=int(obj.name.split("-")[1])
        obj.data.energy=LANDMARK_ZONES[zone][4]*LANDMARK_POWER_BOOST
        obj.data.color=PALETTE["sodium"]
    for name,power in [("Quiet city bounce",95000),("Moon fill",210000)]:
        bpy.data.objects[name].data.energy=power
    for mat in bpy.data.materials:
        if mat.get("luminous") and mat.get("palette_role") in ("light","sodium"):
            mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value=7
    scene=bpy.context.scene
    scene.world.node_tree.nodes["Background"].inputs[1].default_value=.45
    scene["night_treatment"]="Brilliant warm Landmark Light; 3x floodlight power with soft city/moon fill"


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--render",action="store_true")
    parser.add_argument("--relight",action="store_true",help="Update only saved light powers and emission; preserve manual geometry edits")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    # Read the executable semantic palette; do not duplicate derived RGB values.
    result=subprocess.check_output(["node","--experimental-strip-types","--input-type=module","-e",
        "import {TOKYO_TOWER_PALETTE as p} from './packages/designqr/src/designs/city/tokyo-tower-palette.ts'; process.stdout.write(JSON.stringify(p))"],cwd=ROOT,text=True)
    PALETTE={key:linear(value) for key,value in json.loads(result).items()}
    if args.relight:
        relight_existing()
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        for assembly in ("legs","lattice","main-deck","top-deck","antenna","access","base"):
            collection=bpy.data.collections.new("MODEL · "+assembly);bpy.context.scene.collection.children.link(collection);COLLECTIONS[assembly]=collection
        structure();decks();access();setting();review_scene()
    ASSETS.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/"tower.blend"),compress=True)
    runpy.run_path(str(ROOT/"scripts/blender/export-tokyo-tower.py"),run_name="__main__")
    if args.render:
        bpy.context.scene.render.filepath=str(ASSETS/"blender-night.png")
        bpy.ops.render.render(write_still=True)
