"""Prepare verified Osaka CityGML surfaces for the Dotonbori reference master.

Run in a GIS Python environment with numpy, pyproj, shapely and mapbox-earcut.
This compiler preserves the source vertices; it does not invent facade detail,
ground elevations, bridge heights, or missing roofs. See docs/designqr-package/cities/dotonbori/sources.md.
"""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import mapbox_earcut
import numpy as np
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box, mapping, shape


REPO = Path(__file__).resolve().parents[2]
REFERENCE_DIR = REPO / "docs/designqr-package/cities/dotonbori/references"
OUTPUT_DIR = REPO / "assets/design-qr/dotonbori"
NS = {
    "b": "http://www.opengis.net/citygml/building/2.0",
    "g": "http://www.opengis.net/gml",
    "c": "http://www.opengis.net/citygml/2.0",
    "x": "http://www.w3.org/1999/xlink",
}
GML_ID = "{" + NS["g"] + "}id"
HREF = "{" + NS["x"] + "}href"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def prepare(source_dir, output_dir, audit_path, output_name):
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    manifest = json.loads((REFERENCE_DIR / "source-manifest.json").read_text(encoding="utf-8"))
    sources = [source for source in manifest["sourceFiles"] if source["fileName"].endswith(".gml")]
    for source in sources:
        path = source_dir / source["fileName"]
        if path.stat().st_size != source["bytes"] or sha256(path) != source["sha256"]:
            raise ValueError(f"Source does not match the reviewed manifest: {path}")

    projection = Transformer.from_crs(6668, 6674, always_xy=True)
    east0, north0 = projection.transform(*audit["originLongitudeLatitude"])

    def position_ring(node):
        raw = np.asarray([float(v) for v in node.text.split()], dtype=np.float64).reshape(-1, 3)
        east, north = projection.transform(raw[:, 1], raw[:, 0])
        ring = np.column_stack((east - east0, north - north0, raw[:, 2]))
        # CityGML rings repeat their first coordinate as a closing vertex.
        if np.linalg.norm(ring[0] - ring[-1]) < 1e-7:
            ring = ring[:-1]
        keep = [0] + [i for i in range(1, len(ring)) if np.linalg.norm(ring[i] - ring[i - 1]) >= 1e-7]
        ring = ring[keep]
        if len(ring) < 3:
            raise ValueError("Source ring has fewer than three distinct consecutive vertices")
        return ring

    selected = {item["sourceId"]: item for item in audit["buildings"]}
    building_file = next(source for source in sources if "_bldg_" in source["fileName"])
    document = ET.parse(source_dir / building_file["fileName"]).getroot()
    objects, all_surface_ids = [], set()
    diagnostics = {"sourcePolygons": 0, "polygonsWithHoles": 0, "maxTriangulationRelativeAreaError": 0.0,
                   "collinearBoundaryRetriangulations": 0}

    for building in document.findall(".//b:Building", NS):
        source_id = building.get(GML_ID)
        if source_id not in selected:
            continue
        record = selected[source_id]
        lod = record["lod"]
        solid = building.find(f"b:lod{lod}Solid", NS)
        if solid is None:
            raise ValueError(f"Reviewed LOD{lod} solid is absent: {source_id}")

        lookup = {node.get(GML_ID): node for node in building.iter() if node.get(GML_ID)}
        roles = {}
        for surface in building.findall("b:boundedBy/*", NS):
            role = surface.tag.rsplit("}", 1)[-1]
            for polygon in surface.findall(".//g:Polygon", NS):
                roles[polygon.get(GML_ID)] = role

        vertices, triangles, triangle_roles, polygon_records = [], [], [], []
        vertex_index = {}
        for member in solid.findall(".//g:surfaceMember", NS):
            reference = member.get(HREF)
            if reference:
                if not reference.startswith("#") or reference[1:] not in lookup:
                    raise ValueError(f"Unresolved solid surface {reference} on {source_id}")
                polygon = lookup[reference[1:]]
            else:
                polygon = member.find("g:Polygon", NS)
            if polygon is None or polygon.tag != "{" + NS["g"] + "}Polygon":
                raise ValueError(f"Unsupported solid member on {source_id}")

            polygon_id = polygon.get(GML_ID) or f"{source_id}-lod{lod}-surface-{len(polygon_records)}"
            if polygon_id in all_surface_ids:
                raise ValueError(f"Repeated source surface: {polygon_id}")
            all_surface_ids.add(polygon_id)
            rings = [position_ring(polygon.find("g:exterior/g:LinearRing/g:posList", NS))]
            rings.extend(position_ring(node) for node in polygon.findall("g:interior/g:LinearRing/g:posList", NS))
            points = np.vstack(rings)
            outer = rings[0]
            normal = np.cross(outer, np.roll(outer, -1, axis=0)).sum(axis=0)
            normal_length = float(np.linalg.norm(normal))
            if normal_length < 1e-9:
                raise ValueError(f"Degenerate source polygon: {polygon_id}")
            normal /= normal_length
            # Drop the dominant normal axis for stable 2D triangulation. The
            # returned mesh continues to use the original transformed 3D points.
            axes = [axis for axis in range(3) if axis != int(np.argmax(np.abs(normal)))]
            projected = np.ascontiguousarray(points[:, axes])
            ring_ends = np.cumsum([len(ring) for ring in rings], dtype=np.uint32)
            indices = mapbox_earcut.triangulate_float64(projected, ring_ends).reshape(-1, 3)
            planar_rings = [ring[:, axes] for ring in rings]
            region = Polygon(planar_rings[0], planar_rings[1:])
            if not region.is_valid or region.area <= 1e-10:
                raise ValueError(f"Invalid projected source polygon: {polygon_id}")
            # Preserve collinear source boundary vertices without zero-area
            # filler triangles. These vertices also belong to adjacent walls;
            # dropping them opens T-junctions after float32 export.
            rounded = np.round(projected, 7)
            if any(Polygon(rounded[t]).area < 1e-10 for t in indices):
                rounded_rings = [np.round(r, 7) for r in planar_rings]
                triangulation = constrained_delaunay_triangles(Polygon(rounded_rings[0], rounded_rings[1:]))
                lookup_2d = {tuple(p): i for i, p in enumerate(rounded)}
                indices = np.asarray([[lookup_2d[tuple(p)] for p in triangle.exterior.coords[:-1]]
                                      for triangle in triangulation.geoms], dtype=np.uint32)
                diagnostics["collinearBoundaryRetriangulations"] += 1
            area = sum(Polygon(projected[triangle]).area for triangle in indices)
            relative_error = abs(area - region.area) / region.area
            if relative_error > 1e-6:
                raise ValueError(f"Triangulation changes source area for {polygon_id}: {relative_error}")
            diagnostics["maxTriangulationRelativeAreaError"] = max(
                diagnostics["maxTriangulationRelativeAreaError"], relative_error
            )
            diagnostics["polygonsWithHoles"] += len(rings) > 1
            diagnostics["sourcePolygons"] += 1

            remap = []
            for point in points:
                key = tuple(round(float(v), 7) for v in point)
                if key not in vertex_index:
                    vertex_index[key] = len(vertices)
                    vertices.append(key)
                remap.append(vertex_index[key])
            role = roles.get(polygon.get(GML_ID), "SourceSurface")
            start = len(triangles)
            for a, b, c in indices:
                if np.dot(np.cross(points[b] - points[a], points[c] - points[a]), normal) < 0:
                    b, c = c, b
                triangles.append([remap[a], remap[b], remap[c]])
                triangle_roles.append(role)
            polygon_records.append({
                "sourceSurfaceId": polygon_id,
                "role": role,
                "triangleStart": start,
                "triangleCount": len(indices),
                "ringCount": len(rings),
                "maxNonplanarityM": float(np.max(np.abs((points - points[0]) @ normal))),
            })

        if not triangles:
            raise ValueError(f"No source triangles for {source_id}")
        coords = np.asarray(vertices)
        objects.append({
            "id": source_id,
            "auditLabel": record["auditLabel"],
            "evidence": "source-geometry",
            "lod": lod,
            "sourceFile": building_file["fileName"],
            "sourceSha256": building_file["sha256"],
            "sourceCreationDate": record["creationDate"],
            "surveyDate": None,
            "materialInterpretation": "neutral source-study roles; not surveyed facade colors",
            "boundsM": [coords.min(axis=0).tolist(), coords.max(axis=0).tolist()],
            "vertices": vertices,
            "triangles": triangles,
            "triangleRoles": triangle_roles,
            "surfaces": polygon_records,
        })

    objects.sort(key=lambda obj: obj["auditLabel"])
    if {obj["id"] for obj in objects} != set(selected):
        raise ValueError("Compiled inventory differs from the reviewed source crop")
    coordinates = np.asarray([point for obj in objects for point in obj["vertices"]])
    crop = box(*audit.get("coverageBoundsM", [-audit["cropHalfExtentM"], -audit["cropHalfExtentM"], audit["cropHalfExtentM"], audit["cropHalfExtentM"]]))
    plan_references = {
        "roads": [{**record, "geometry": mapping(shape(record["geometry"]).intersection(crop))} for record in audit["roadPolygons"]],
        "mapFeatures": [{**record, "geometry": mapping(shape(record["geometry"]).intersection(crop))} for record in audit["mapFeatures"]],
    }
    output = {
        "schema": "designqr-dotonbori-source-meshes",
        "version": 1,
        "status": "source study; detailed bridge and facades unresolved",
        "units": "metres",
        "axes": ["east", "north", "source-height"],
        "originLongitudeLatitude": audit["originLongitudeLatitude"],
        "originProjectedEastNorth": [east0, north0],
        "sourceCrs": "EPSG:6697",
        "horizontalProjection": "EPSG:6674",
        "verticalOperation": "none; source heights retained",
        "cropSizeM": audit["cropSizeM"],
        "boundaryOperation": "none; complete source features intersecting crop retained",
        "sourceAuditSha256": sha256(audit_path),
        "sources": sources,
        "boundsM": [coordinates.min(axis=0).tolist(), coordinates.max(axis=0).tolist()],
        "objects": objects,
        "planReferences": plan_references,
        "diagnostics": diagnostics,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    dump(output_dir / output_name, output)
    stats = {
        "buildings": len(objects),
        "lodCounts": dict(Counter(obj["lod"] for obj in objects)),
        "vertices": sum(len(obj["vertices"]) for obj in objects),
        "triangles": sum(len(obj["triangles"]) for obj in objects),
        "boundsM": output["boundsM"],
        **diagnostics,
    }
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--audit", type=Path, default=REFERENCE_DIR / "site-audit.json")
    parser.add_argument("--output-name", default="source-meshes.json")
    args = parser.parse_args()
    prepare(args.source_dir, args.output_dir, args.audit, args.output_name)
