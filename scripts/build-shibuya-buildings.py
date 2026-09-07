#!/usr/bin/env python3
"""Compile source-aligned Shibuya architecture; offline, no runtime map requests.

uv run --no-project --with shapely==2.1.2 --with pyproj==3.7.1 \
  --python /usr/bin/python3 scripts/build-shibuya-buildings.py --source-dir <dir>
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from pyproj import Transformer
from shapely.affinity import rotate
from shapely.geometry import Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
NS = {'g': 'http://www.opengis.net/gml', 'b': 'http://www.opengis.net/citygml/building/2.0'}
FILES = ['53393595_bldg_6697_op.gml', '53393596_bldg_6697_op.gml']
IDENTITIES = {
    'bldg_5f7ff4f3-a620-4fd0-a380-3ec46435cd27': 'qfront',
    'bldg_d47d8aa9-e4f5-4599-9d9a-bc129a12d6a8': 'magnet',
    'bldg_e6e4de58-1a37-4345-8795-6b759771ade6': 'sign-block',
    'bldg_6abf2261-478c-437a-93f4-8ba23d7b1cad': 'southwest-retail',
    'bldg_46f3cd1c-4dc8-4e7e-b30f-db8c8c31f776': 'department-store',
}
# The source groups the low Hachiko-frontage buildings under this ID. It is
# labelled as the station police box, NOT a surveyed station-entrance inventory.
STATION_FRONT = 'bldg_20234796-412f-494e-b712-f3f7d6e3197b'


def parts(g):
    if g.geom_type == 'Polygon':
        return [g] if g.area > 2 else []
    return [p for child in getattr(g, 'geoms', []) for p in parts(child)]


def rings(p):
    p = orient(p, sign=1)
    return [[[round(x, 4), round(z, 4)] for x, z in r.coords[:-1]] for r in [p.exterior, *p.interiors]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', required=True, type=Path)
    parser.add_argument('--preview', type=Path)
    args = parser.parse_args()
    road_path = ROOT / 'packages/designqr/src/designs/city/road-data.ts'
    road = json.loads(road_path.read_text().split(' = ', 1)[1].strip().removesuffix(';'))
    provenance = road['provenance']
    projection = Transformer.from_crs(6668, 6677, always_xy=True)
    origin = projection.transform(*provenance['originLonLat'])
    angle = provenance['rotationDegrees']
    clip = box(-77.6, -77.6, 77.6, 77.6)
    roads = unary_union([Polygon(p[0], p[1:]) for key in ['carriageways', 'sidewalks', 'islands'] for p in road[key]])
    # Preserve road data verbatim. Buildings move inward where separately sourced
    # datasets disagree; the road/sidewalk always wins, including every projection.
    land = clip.difference(roads.buffer(.45))
    railway = rotate(box(63, -160, 80, 160), angle, origin=(0, 0))
    entries, checksums = [], {}

    def ring(element):
        v = list(map(float, element.text.split()))
        result = []
        for i in range(0, len(v), 3):
            e, n = projection.transform(v[i + 1], v[i])
            e, s = e - origin[0], origin[1] - n
            a = math.radians(angle)
            result.append((e * math.cos(a) - s * math.sin(a), e * math.sin(a) + s * math.cos(a)))
        return result

    for filename in FILES:
        path = args.source_dir / filename
        checksums[filename] = hashlib.sha256(path.read_bytes()).hexdigest()
        for b in ET.parse(path).getroot().findall('.//b:Building', NS):
            source_id = b.get('{' + NS['g'] + '}id')
            elements = b.findall('b:lod0FootPrint//g:Polygon', NS)
            footprint_type = 'lod0FootPrint'
            if not elements:
                elements = b.findall('b:lod0RoofEdge//g:Polygon', NS)
                footprint_type = 'lod0RoofEdge'
            polygons = []
            for p in elements:
                exterior = p.find('g:exterior//g:posList', NS)
                if exterior is not None:
                    polygons.extend(parts(Polygon(ring(exterior), [ring(r) for r in p.findall('g:interior//g:posList', NS)]).buffer(0)))
            if not polygons:
                continue
            source = unary_union(polygons)
            if not source.intersects(clip):
                continue
            height = float(b.findtext('b:measuredHeight', '0', NS))
            if height <= 0 or height > 80:
                continue
            c = rotate(source, -angle, origin=(0, 0)).centroid
            station = source_id == STATION_FRONT
            # No invented buildings in Hachiko Square or along the rail corridor.
            if not station and (c.x > 55 or (c.x > -10 and c.y > 15)):
                continue
            kind = 'station-front' if station else IDENTITIES.get(source_id, 'retail')
            envelope = source.intersection(land.difference(railway)).buffer(-.12, join_style=2)
            for part_index, parcel in enumerate(sorted(parts(envelope), key=lambda p: -p.area)):
                if parcel.area < (30 if kind == 'retail' else 15):
                    continue
                # Tiny topological spikes cannot turn into facade needles. The
                # simplified contour is intersected with the safe source envelope.
                solid_parts = parts(parcel.buffer(-.45, join_style=2).simplify(.10, preserve_topology=True).intersection(parcel))
                if not solid_parts:
                    continue
                solid = max(solid_parts, key=lambda p: p.area)
                if solid.area < 20:
                    continue
                quality = {e.tag.split('}')[-1]: e.text for e in b.iter() if 'srcScaleLod' in e.tag or 'geometrySrcDesc' in e.tag}
                entries.append({'id': kind if kind != 'retail' and part_index == 0 else f'{source_id}-{part_index}',
                    'kind': kind, 'sourceId': source_id, 'file': filename, 'footprintType': footprint_type,
                    'sourceHeightMetres': height, 'sourceStoreys': b.findtext('b:storeysAboveGround', '', NS),
                    'sourceAreaMetres2': round(source.area, 3), 'retainedAreaMetres2': round(solid.area, 3),
                    'sourceQuality': quality, 'footprint': rings(solid), 'envelope': rings(parcel)})
    entries.sort(key=lambda e: (['qfront', 'magnet', 'sign-block', 'southwest-retail', 'department-store', 'station-front', 'retail'].index(e['kind']), e['id']))
    assert entries[0]['id'] == 'qfront' and entries[1]['id'] == 'magnet'
    for i, entry in enumerate(entries):
        p = Polygon(entry['envelope'][0], entry['envelope'][1:])
        assert p.difference(land.buffer(.001)).area < .001, entry['id']
        for other in entries[i + 1:]:
            assert p.intersection(Polygon(other['envelope'][0], other['envelope'][1:])).area < .001, (entry['id'], other['id'])
    data = {'provenance': {'dataset': provenance['dataset'], 'sourceCrs': provenance['sourceCrs'],
        'horizontalCrs': provenance['horizontalCrs'], 'originLonLat': provenance['originLonLat'],
        'rotationDegrees': angle, 'tileMetres': provenance['tileMetres'], 'sourceSha256': checksums,
        'roadSha256': hashlib.sha256(road_path.read_bytes()).hexdigest(), 'setbackMetres': .45,
        'note': 'Modified PLATEAU footprints; fixed QFRONT/MAGNET heights, interpreted facades and low Hachiko frontage. Not an as-built survey.'},
        'buildings': entries}
    target = ROOT / 'packages/designqr/src/designs/city/building-data.ts'
    target.write_text('// Generated by scripts/build-shibuya-buildings.py. Do not hand-edit.\n'
        '// Modified PLATEAU Shibuya 2025. See docs/design-qr/shibuya-architecture.md for attribution and limits.\n'
        'export const SHIBUYA_BUILDING_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
    print('Compiled', len(entries), 'source-aligned building masses')
    for e in entries:
        print(e['id'], e['sourceHeightMetres'], 'm;', e['retainedAreaMetres2'], 'm²')
    if args.preview:
        svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1440" viewBox="-82 -82 164 164"><rect x="-82" y="-82" width="164" height="164" fill="#e8ddcf"/>']
        for key, color in [('sidewalks', '#cddbe4'), ('carriageways', '#1f3a52')]:
            for polygon in road[key]:
                d = ''.join('M' + 'L'.join(f'{x},{z}' for x,z in r) + 'Z' for r in polygon)
                svg.append(f'<path d="{d}" fill="{color}" fill-rule="evenodd"/>')
        for i, e in enumerate(entries):
            d = ''.join('M' + 'L'.join(f'{x},{z}' for x,z in r) + 'Z' for r in e['footprint'])
            c = Polygon(e['footprint'][0]).representative_point()
            svg.append(f'<path d="{d}" fill="#809dca" stroke="#436ea4" stroke-width=".15"/><text x="{c.x}" y="{c.y}" font-size="2.2" fill="#1f3a52">{i}</text>')
        args.preview.write_text(''.join(svg) + '</svg>')


if __name__ == '__main__':
    main()
