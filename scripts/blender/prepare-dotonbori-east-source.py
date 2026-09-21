"""Audit the Ebisubashi–Ebisu Tower crop against the same Osaka/GSI sources.

Run in the GIS environment, passing the two hash-verified CityGML files.
The original 160 m source study and its labels remain independently reproducible.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from pyproj import Transformer
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

REPO = Path(__file__).resolve().parents[2]
REFERENCES = REPO / "docs/designqr-package/cities/dotonbori/references"
NS = {"b": "http://www.opengis.net/citygml/building/2.0", "g": "http://www.opengis.net/gml",
      "c": "http://www.opengis.net/citygml/2.0", "t": "http://www.opengis.net/citygml/transportation/2.0"}
DONKI = "bldg_62a12ed7-ad07-4a43-8a33-c8720026bbaa"


def build(source_dir):
    original = json.loads((REFERENCES / "site-audit.json").read_text())
    manifest = json.loads((REFERENCES / "source-manifest.json").read_text())
    for source in manifest["sourceFiles"]:
        if source["fileName"].endswith(".gml"):
            data = (source_dir / source["fileName"]).read_bytes()
            if len(data) != source["bytes"] or hashlib.sha256(data).hexdigest() != source["sha256"]:
                raise ValueError("CityGML differs from the source manifest")
    projection = Transformer.from_crs(6668, 6674, always_xy=True)
    east0, north0 = projection.transform(*original["originLongitudeLatitude"])

    def ring(node):
        numbers = list(map(float, node.text.split()))
        return [(*projection.transform(numbers[i + 1], numbers[i]), numbers[i + 2]) for i in range(0, len(numbers), 3)]

    def polygon(node):
        def local(pos):
            return [(e - east0, n - north0) for e, n, _ in ring(pos)]
        return Polygon(local(node.find("g:exterior/g:LinearRing/g:posList", NS)),
                       [local(p) for p in node.findall("g:interior/g:LinearRing/g:posList", NS)])

    size, east, north, r = 184, 46, 12, math.sqrt(.5)
    frame = Polygon([(east + r * (x + z), north + r * (x - z)) for x, z in
                     [(-size / 2, -size / 2), (size / 2, -size / 2), (size / 2, size / 2), (-size / 2, size / 2)]])
    labels = {b["sourceId"]: b["auditLabel"] for b in original["buildings"]}
    # Preserve the original bridge context alongside the eastward source data.
    # Presentation relocation belongs only to the derived focus layout.
    coverage = frame.union(box(-110, -110, 110, 110))
    buildings = []
    root = ET.parse(source_dir / "52350400_bldg_6697_op.gml").getroot()
    for b in root.findall(".//b:Building", NS):
        footprints = [polygon(p) for p in b.findall("b:lod0FootPrint//g:Polygon", NS)]
        if not footprints:
            continue
        footprint = unary_union(footprints)
        if not footprint.is_valid:
            raise ValueError("Invalid source footprint")
        source_id = b.get("{" + NS["g"] + "}id")
        if footprint.intersection(frame).area < 1 and source_id not in labels:
            continue
        heights = [height for p in b.findall("b:lod1Solid//g:posList", NS) for _, _, height in ring(p)]
        buildings.append({"sourceId": source_id, "footprint": mapping(footprint),
                          "centroidLocalMetres": list(footprint.centroid.coords[0]),
                          "footprintAreaM2": footprint.area,
                          "sourceMeasuredHeightM": float(b.findtext("b:measuredHeight", namespaces=NS)),
                          "lod": 2 if b.find("b:lod2Solid", NS) is not None else 1,
                          "creationDate": b.findtext("c:creationDate", namespaces=NS),
                          "lod1MinZM": min(heights), "lod1MaxZM": max(heights), "validFootprint": True})
    next_label = 74
    for b in sorted(buildings, key=lambda b: b["sourceId"]):
        if b["sourceId"] not in labels:
            labels[b["sourceId"]] = f"B{next_label:03}"
            next_label += 1
        b["auditLabel"] = labels[b["sourceId"]]
    buildings.sort(key=lambda b: b["auditLabel"])
    donki = next(b for b in buildings if b["sourceId"] == DONKI)
    if not frame.covers(shape(donki["footprint"])):
        raise ValueError("The complete Donki footprint must fit the crop")
    roads = []
    root = ET.parse(source_dir / "52350400_tran_6697_op.gml").getroot()
    for road in root.findall(".//t:Road", NS):
        for p in road.findall("t:lod1MultiSurface//g:Polygon", NS):
            footprint = polygon(p)
            if footprint.intersection(coverage).area > .001:
                heights = [h for pos in p.findall(".//g:posList", NS) for _, _, h in ring(pos)]
                roads.append({"sourceId": road.get("{" + NS["g"] + "}id"), "geometry": mapping(footprint),
                              "minSourceZ": min(heights), "maxSourceZ": max(heights)})
    result = {key: original[key] for key in ("originLongitudeLatitude", "originRole", "sourceBuildingCRS", "horizontalProjection", "axes")}
    result.update({"status": "source audit for the Ebisubashi–Ebisu Tower miniature; facade details separately interpreted",
                   "cropSizeM": size, "cropHalfExtentM": size / 2, "coverageBoundsM": [-110, -122, 182, 146],
                   "focusCenterEastNorthM": [east, north], "focusOutlineEastNorthM": list(frame.exterior.coords),
                   "selectionRule": "Union of the original bridge source inventory and east-canal crop; whole source solids retained without presentation relocation",
                   "buildingCount": len(buildings), "buildingLodCounts": dict(Counter(b["lod"] for b in buildings)),
                   "roadPolygonCount": len(roads), "buildings": buildings, "roadPolygons": roads,
                   "mapFeatures": original["mapFeatures"],
                   "mapFeatureEvidence": "Unclipped GSI tile geometries already recorded in site-audit.json; WA covers the complete canal segment",
                   "donki": {"sourceId": DONKI, "auditLabel": donki["auditLabel"],
                             "operatorStorePinLongitudeLatitude": [135.50267960, 34.66930430],
                             "registration": "Operator pin lies inside this LOD0 footprint. LOD2 store roof is 44.57 m; LOD1 includes the attraction envelope."}})
    path = REFERENCES / "east-site-audit.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"buildings": len(buildings), "roads": len(roads), "donki": result["donki"]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    build(parser.parse_args().source_dir)
