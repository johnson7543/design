"""Derive the Ebisubashi–Ebisu Tower product crop from audited horizontal data.

Run with the same Shapely environment as prepare-dotonbori-source.py. Landmark
spacing is an authored compact composition; source solids remain separate.
"""

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Polygon, box, mapping, shape
from shapely.affinity import translate


REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "assets/design-qr/dotonbori"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    source_path = ASSETS / "east-source-meshes.json"
    audit_path = REPO / "docs/designqr-package/cities/dotonbori/references/east-site-audit.json"
    bridge_path = ASSETS / "bridge-deck-study.json"
    source, audit, bridge = [json.loads(path.read_text()) for path in (source_path, audit_path, bridge_path)]
    if source["sourceAuditSha256"] != digest(audit_path) or bridge["sourceMeshSha256"] != digest(ASSETS / "source-meshes.json"):
        raise ValueError("Revalidate the source and bridge registration before reframing")
    east, north = bridge["registration"]["centerEastNorthM"]
    size, r = 144, math.sqrt(.5)
    half = size / 2
    frame = Polygon([(east + r * (x + z), north + r * (x - z))
                     for x, z in [(-half, -half), (half, -half), (half, half), (-half, half)]])
    coverage = box(*audit["coverageBoundsM"])
    if not coverage.covers(frame):
        raise ValueError("The rotated frame extends beyond the reviewed source area")
    crop = frame
    donki_id = audit["donki"]["sourceId"]
    offsets = {donki_id: [-80, 0]}
    donki = next(b for b in audit["buildings"] if b["sourceId"] == donki_id)
    donki_footprint = translate(shape(donki["footprint"]), xoff=-80)
    if not crop.covers(donki_footprint):
        raise ValueError("The complete Donki building must fit the compact tile")
    objects, omitted, displaced = [], [], []
    for building in audit["buildings"]:
        offset = offsets.get(building["sourceId"], [0, 0])
        footprint = translate(shape(building["footprint"]), xoff=offset[0], yoff=offset[1])
        area = footprint.intersection(crop).area
        if area >= 1:
            fraction = area / footprint.area
            record = {"sourceId": building["sourceId"], "auditLabel": building["auditLabel"],
                      "variationIndex": int(building["auditLabel"][1:]) - 1, "retainedFootprintAreaM2": area,
                      "retainedFootprintFraction": fraction, "translationEastNorthM": offset}
            if building != donki and footprint.intersects(donki_footprint.buffer(1)):
                displaced.append(record)
                continue
            # Small complete buildings remain. Only cropped remnants with both
            # little area and less than half their original footprint are omitted.
            (omitted if area < 40 and fraction < .5 else objects).append(record)

    def clipped(features, roads=False):
        result = []
        for feature in features:
            polygon = shape(feature).intersection(crop)
            if roads:
                polygon = polygon.difference(donki_footprint)
            if not polygon.is_empty:
                if polygon.geom_type not in ("Polygon", "MultiPolygon"):
                    raise ValueError("Unexpected clipped plan geometry")
                result.append(mapping(polygon))
        return result

    result = {
        "schema": "designqr-dotonbori-focus-layout", "version": 5,
        "sourceMeshSha256": digest(source_path), "sourceAuditSha256": digest(audit_path),
        "bridgeStudySha256": digest(bridge_path),
        "tileSizeM": size, "centerEastNorthM": [east, north], "rotationYRadians": math.pi / 4,
        "outlineEastNorthM": list(crop.exterior.coords),
        "landmarkOffsetsEastNorthM": offsets,
        "composition": "Bridge-centered 144 m miniature. Donki translates 80 m west as one complete source building; six displaced context parcels are omitted. Landmark dimensions and central street/canal geometry remain unchanged. Spacing is illustrative, not geographic.",
        "selectionRule": "After the recorded landmark translation and context clearance, retain at least 40 square metres OR half the original footprint. Complete small buildings remain; variation indices use stable source audit labels.",
        "edgeSelection": {"minimumRetainedAreaM2": 40, "minimumRetainedFraction": .5},
        "objects": objects,
        "omittedEdgeFragments": omitted,
        "displacedContext": displaced,
        "plan": {
            "roads": clipped([road["geometry"] for road in source["planReferences"]["roads"]], roads=True),
            "water": clipped([feature["geometry"] for feature in source["planReferences"]["mapFeatures"] if feature["layer"] == "WA"]),
        },
        "interpretation": "Authored compact landmark spacing. Source files retain geographic coordinates. Recorded translations preserve building shape/height and façade direction; bridge registration, rotation and scale remain uniform.",
    }
    (ASSETS / "focus-layout.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"buildings": len(objects), "omittedEdgeFragments": len(omitted), "tileSizeM": size, "areaM2": crop.area,
                      "cropBoundsM": crop.bounds}))


if __name__ == "__main__":
    build()
