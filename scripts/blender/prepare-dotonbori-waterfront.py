"""Compile a reference-directed detail layer without changing surveyed solids.

Run with Shapely 2.1.2. S5/S9/S10/S13 in the city source ledger describe the
measurements and the explicitly interpreted tier widths, fittings and activity.
"""
import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.affinity import translate

REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "assets/design-qr/dotonbori"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    source = json.loads((ASSETS / "east-source-meshes.json").read_text())
    layout = json.loads((ASSETS / "focus-layout.json").read_text())
    bridge = json.loads((ASSETS / "bridge-deck-study.json").read_text())
    audit_path = REPO / "docs/designqr-package/cities/dotonbori/references/east-site-audit.json"
    audit = json.loads(audit_path.read_text())
    frame = Polygon(layout["outlineEastNorthM"])
    water = unary_union([shape(f["geometry"]) for f in source["planReferences"]["mapFeatures"] if f["layer"] == "WA"])
    selected = {b['sourceId'] for b in layout['objects']}
    buildings = unary_union([translate(shape(b['footprint']),
        xoff=layout['landmarkOffsetsEastNorthM'].get(b['sourceId'], [0, 0])[0],
        yoff=layout['landmarkOffsetsEastNorthM'].get(b['sourceId'], [0, 0])[1])
        for b in audit['buildings'] if b['sourceId'] in selected])
    # The published section gives a combined ~8 m bank, not individual tier
    # widths. The 2.2 m low strip is a photo-directed interpretation. Intersect
    # with actual available space: never put a promenade inside a source solid.
    lower = water.buffer(2.2, join_style="mitre").difference(water).difference(buildings).intersection(frame)
    upper = water.buffer(8, join_style="mitre").difference(water.buffer(2.2, join_style="mitre")).difference(buildings).intersection(frame)

    def polygons(geometry):
        parts = [geometry] if geometry.geom_type == "Polygon" else geometry.geoms
        return [mapping(p) for p in parts if p.geom_type == "Polygon" and p.area > .001]

    sections = []
    for east in range(-110, 123, 2):
        section = water.intersection(LineString([(east, -70), (east, 70)]))
        if section.is_empty:
            continue
        _, south, _, north = section.bounds
        sections.append([east, south, north])
    edges = []
    for side in [1, 2]:
        line = LineString([(e, s if side == 1 else n) for e, s, n in sections])
        clipped = line.intersection(frame.buffer(-.12))
        parts = [clipped] if clipped.geom_type == "LineString" else clipped.geoms
        edges.extend({"side": "south" if side == 1 else "north", "points": list(p.coords)} for p in parts if p.length > 1)
    if lower.intersection(water).area > 1e-7 or upper.intersection(buildings).area > 1e-7:
        raise ValueError("Waterfront details encroach on water or buildings")
    result = {
        "schema": "designqr-dotonbori-waterfront", "version": 3,
        "sourceMeshSha256": digest(ASSETS / "east-source-meshes.json"),
        "layoutSha256": digest(ASSETS / "focus-layout.json"),
        "generatorSha256": digest(Path(__file__)),
        "levelsM": {"water": .6, "lowerWalk": 1.05, "upperWalk": 1.95},
        "lowerWalk": polygons(lower), "upperWalk": polygons(upper),
        "bankEdges": edges, "channelSectionsM": sections,
        "bridge": {"centerEastNorthM": bridge["registration"]["centerEastNorthM"],
                   "alongNorth": bridge["registration"]["alongNorthUnitVector"],
                   "profile": [[p["chainageM"] - 35, p["plannedHeightOPM"] - 1.3] for p in bridge["dimensions"]["profileTable"]]},
        "boat": {"id": "doton", "lengthOverallM": 16.4, "lengthBetweenPerpendicularsM": 15.4,
                 "beamM": 3.6, "mouldedDepthM": .9, "draftM": .5},
        "interpretation": "S5/S11 standard bank levels converted O.P. minus 1.3 m; water is the range midpoint, not an observation. Photo-directed 2.2 m lower strip, upper strip bounded by source buildings and the published ~8 m bank. Local transitions/fittings remain interpreted. S13 DOTON drawing gives 16.4 m overall, 15.4 m between perpendiculars; current gallery lists length 15.4 m and 60 passengers. Activity is representative, not a traffic record.",
        "validation": {"waterOverlapM2": lower.intersection(water).area, "buildingOverlapM2": upper.intersection(buildings).area,
                       "lowerWalkAreaM2": lower.area, "upperWalkAreaM2": upper.area},
    }
    (ASSETS / "waterfront-layout.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["validation"]))


if __name__ == "__main__":
    build()
