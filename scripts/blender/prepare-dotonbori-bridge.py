"""Compile an explicitly incomplete bridge deck study from inspected records.

Uses the March 2008 completion drawing, not a competition proposal. The
longitudinal table and section F.H. differ, so this is not a finished pavement
surface. Main deck dimensions are published; plan registration and linear
interpolation are documented processing. No ramps or rails are inferred.
"""

import hashlib
import json
from pathlib import Path

import numpy as np


REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "assets/design-qr/dotonbori"
REFERENCE = REPO / "docs/designqr-package/cities/dotonbori/references"
ROAD_ID = "tran_70094e7f-0422-40c6-85d6-7e0b5c4efe55"


def build():
    source_path = ASSETS / "source-meshes.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    road = next(record for record in source["planReferences"]["roads"] if record["sourceId"] == ROAD_ID)
    outline = np.asarray(road["geometry"]["coordinates"][0])[:, :2]
    # Reviewed outer-arc vertices, retained verbatim in the registration report.
    arc = outline[(outline[:, 1] > -4) & (outline[:, 1] < 7.6) & ((outline[:, 0] < -4) | (outline[:, 0] > 13))]
    coefficients = np.linalg.lstsq(np.column_stack((2 * arc, np.ones(len(arc)))), (arc * arc).sum(axis=1), rcond=None)[0]
    center = coefficients[:2]
    radius = float(np.sqrt(coefficients[2] + center @ center))
    residuals = np.linalg.norm(arc - center, axis=1) - radius

    # Direction from two source street-edge pairs, not a guessed compass axis.
    north = np.mean([outline[2], outline[42]], axis=0)
    south_y = outline[14, 1]
    west_a, west_b = outline[23], outline[27]
    west_x = west_a[0] + (west_b[0] - west_a[0]) * (south_y - west_a[1]) / (west_b[1] - west_a[1])
    south = np.array([(west_x + outline[14, 0]) / 2, south_y])
    along = (north - south) / np.linalg.norm(north - south)
    across = np.array([along[1], -along[0]])

    # Transcribed from the drawing's 計画高 row, in O.P. metres. The different
    # 現況高 row is deliberately not treated as the completed surface.
    chainage = np.array([21.995, 25, 30, 35, 40, 45, 47.995])
    grade_op = np.array([6.027, 6.133, 6.267, 6.310, 6.267, 6.132, 6.021])
    stations = np.unique(np.round(np.concatenate((np.linspace(chainage[0], chainage[-1], 209), chainage, [35-np.sqrt(9**2-5.9**2),35+np.sqrt(9**2-5.9**2)])), 7))
    vertices, faces = [], []
    for station in stations:
        longitudinal = float(station - 35)
        half_width = max(5.9, float(np.sqrt(max(0, 9**2 - longitudinal**2))))
        elevation = float(np.interp(station, chainage, grade_op) - 1.3)
        for offset in (-half_width, 0, half_width):
            point = center + along * longitudinal + across * offset
            vertices.append([float(point[0]), float(point[1]), elevation])
    for i in range(len(stations) - 1):
        for side in (0, 1):
            a, b = i * 3 + side, (i + 1) * 3 + side
            faces.extend([[a, a + 1, b + 1], [a, b + 1, b]])

    record = {
        "schema": "designqr-dotonbori-bridge-study", "version": 1,
        "id": "ebisubashi-deck-dimension-study",
        "status": "Incomplete dimensional envelope; not finished pavement or complete bridge",
        "evidence": "published dimensions; source-plan registration; declared interpolation",
        "units": "metres", "axes": ["east", "north", "T.P. reference height"],
        "sourceMeshSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "drawing": {
            "title": "戎橋全体一般図（完成図）", "drawingDate": "2008-03", "page": 1,
            "originalUrl": "https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/siryou3.pdf",
            "retrievalUrl": "https://web.archive.org/web/20230805233636id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/siryou3.pdf",
            "sha256": "65466efe5c31d0850214651eabf8192ed46f2cb9091417e9bf3750fbb30fc5b1",
        },
        "registration": {
            "sourceRoadId": ROAD_ID, "method": "least-squares circle fit to selected outer-arc source vertices",
            "controlPointsM": arc.tolist(), "centerEastNorthM": center.tolist(),
            "fittedOuterRadiusM": radius, "radialRmsM": float(np.sqrt(np.mean(residuals**2))),
            "maxRadialResidualM": float(np.max(np.abs(residuals))),
            "drawingOuterRadiusAtSectionAM": 11.5,
            "radiusDiscrepancyM": radius - 11.5,
            "northStreetMidpointM": north.tolist(), "southStreetMidpointM": south.tolist(),
            "alongNorthUnitVector": along.tolist(),
            "limitation": "Residuals describe the map fit, not surveyed site accuracy. Source outline and drawing disagree in outer radius; published dimensions govern the deck shape.",
        },
        "dimensions": {
            "spanM": 26, "southChainageM": 21.995, "northChainageM": 47.995,
            "centerChainageM": 35, "centralDeckDiameterM": 18,
            "straightSectionOverallWidthM": 11.8, "straightSectionEffectiveWidthM": 11,
            "profileTable": [{"chainageM": float(s), "plannedHeightOPM": float(h)} for s,h in zip(chainage,grade_op)],
            "sectionAFinishedHeightOPM": 6.3410, "sectionBFinishedHeightOPM": 6.2919,
            "sectionAVersusCenterTableDifferenceM": .031,
        },
        "verticalOperation": "O.P. minus 1.3m, from Osaka port standard drawing 5-2-2; benchmark epoch/local vertical registration remains unverified",
        "surfaceOperation": "Main-deck plan is the union of the published 18m circle and 11.8m straight section across the 26m span. Linear interpolation between table levels. Crossfall, surfacing thickness and undersides are omitted.",
        "unresolved": ["31mm center elevation discrepancy between section A and the profile table", "crossfall and finished surface reconciliation", "ramp profiles and connections", "stair placement and finished tread levels", "rail and girder detailing", "benchmark epoch and local height registration"],
        "vertices": vertices, "triangles": faces,
    }
    (ASSETS / "bridge-deck-study.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"vertices": len(vertices), "triangles": len(faces), "registration": record["registration"]}, indent=2))


if __name__ == "__main__":
    build()
