#!/usr/bin/env python3
"""Compile the shared City road foundation from official PLATEAU CityGML.

uv run --no-project --with shapely==2.1.2 --with pyproj==3.7.1 \
  --python /usr/bin/python3 scripts/build-shibuya-road.py --source-dir <download-dir>

See docs/design-qr/shibuya-road-network.md for sources, licence, and limitations.
This is an offline authoring tool; players never fetch maps or require Python.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from pyproj import Transformer
from shapely import make_valid, set_precision
from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import substring, unary_union

ROOT = Path(__file__).resolve().parents[1]
NS = {'g': 'http://www.opengis.net/gml', 't': 'http://www.opengis.net/citygml/transportation/2.0'}
FILES = ['53393595_tran_6697_op.gml', '53393596_tran_6697_op.gml']
ORIGIN = [139.70055, 35.6595]
EXTENT = 160
ANGLE = 45
HACHIKO_THROUGH_LANES = 2
HACHIKO_NARROWING = {'length': 32, 'width': 5.2}
HACHIKO_STOPPING_BAY = {'start': 8, 'end': 30, 'width': 3.0}
HACHIKO_LANE_WIDTH = 3.5
MAIN_CARRIAGEWAY_WIDTH = 15
EAST_CARRIAGEWAY_WIDTH = 14
ARMS = [
    {'id': 'jingu', 'lanes': 4, 'points': [[9.3, -25], [11.6, -35], [15, -50], [19.5, -70], [23.7, -90], [24, -120]]},
    {'id': 'dogenzaka', 'lanes': 4, 'points': [[-39, -4.2], [-50, -5.9], [-65, -6.3], [-90, -3.5], [-120, -4]]},
    {'id': 'hachiko', 'lanes': HACHIKO_THROUGH_LANES * 2, 'points': [[-13.4, 25], [-16.2, 35], [-20.2, 50], [-23.8, 70], [-21.2, 90], [-19, 120]]},
    {'id': 'station-east', 'lanes': 4, 'points': [[30, 5.9], [45, 6.2], [60, 5.4], [80, 4.7], [110, 3.6]]},
    {'id': 'center-gai', 'lanes': 2, 'points': [[-23, -20], [-26, -26], [-36, -36], [-48, -47], [-61, -60]]},
]
CLIP = box(-79.2, -79.2, 79.2, 79.2)
projection = Transformer.from_crs(6668, 6677, always_xy=True)
origin = projection.transform(*ORIGIN)


def local(e, s):
    angle = math.radians(ANGLE)
    return (e * math.cos(angle) - s * math.sin(angle), e * math.sin(angle) + s * math.cos(angle))


def polygons(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry] if geometry.area > .005 else []
    return [p for child in getattr(geometry, 'geoms', []) for p in polygons(child)]


def coordinates(geometry):
    return [[[list(map(lambda v: round(v, 3), p)) for p in ring.coords[:-1]]
             for ring in [polygon.exterior, *polygon.interiors]] for polygon in polygons(geometry)]


def svg_path(geometry):
    return ' '.join('M' + 'L'.join(f'{x:.3f},{z:.3f}' for x, z in ring.coords) + 'Z'
                    for polygon in polygons(geometry) for ring in [polygon.exterior, *polygon.interiors])


def curb_lane_profiles(road, line, approach):
    """Fit a smooth through corridor around real curbs and across side openings.

    Parallel sections avoid transferring bends in the coarse arm hints into
    the paint. Tile cuts are missing curb observations, not road narrowing.
    """
    origin, end = line.coords[0], line.coords[-1]
    dx, dz = end[0] - origin[0], end[1] - origin[1]
    length = math.hypot(dx, dz)
    dx, dz = dx / length, dz / length
    raw = []
    for t in range(math.ceil(length)):
        x, z = origin[0] + dx * t, origin[1] + dz * t
        section = LineString([(x + dz * 35, z - dx * 35), (x - dz * 35, z + dx * 35)]).intersection(road)
        segments = [section] if section.geom_type == 'LineString' else list(section.geoms)
        segments = [s for s in segments if s.geom_type == 'LineString' and not s.is_empty]
        if not segments:
            break
        segment = min(segments, key=lambda s: s.distance(Point(x, z)))
        hits = sorted((((px - x) * -dz + (pz - z) * dx, px, pz) for px, pz in segment.coords))
        sides = []
        for side, hit in [(-1, hits[0]), (1, hits[-1])]:
            offset, px, pz = hit
            cut = max(abs(px), abs(pz)) > 79.19
            sides.append(None if cut else offset - side * .45)
        raw.append(sides)

    def complete(values):
        valid = [i for i, value in enumerate(values) if value is not None]
        if len(valid) < 8:
            raise ValueError(f'{approach} needs observed curbs on both sides of its through corridor.')
        for i, value in enumerate(values):
            if value is not None:
                continue
            before = max((j for j in valid if j < i), default=valid[0])
            after = min((j for j in valid if j > i), default=valid[-1])
            if before == after:
                other = min(valid, key=lambda j: abs(j - (before + (8 if i < before else -8))))
                slope = (values[before] - values[other]) / (before - other or 1)
                values[i] = values[before] + max(-.5, min(.5, slope)) * (i - before)
            else:
                values[i] = values[before] + (values[after] - values[before]) * (i - before) / (after - before)
        return values

    def window(values, radius, operation):
        return [operation(values[max(0, i - radius):i + radius + 1]) for i in range(len(values))]

    observed = [complete([p[side] for p in raw]) for side in range(2)]
    if approach == 'station-east':
        # Two side roads open into the north curb around the underpass. They
        # are access mouths, not additional width for the four through lanes.
        # Continue the approach width against the uninterrupted opposite curb;
        # genuine inward curb constraints can still narrow the corridor.
        approach_width = sum(right - left for left, right in zip(observed[0][:12], observed[1][:12])) / 12
        observed[0] = [max(left, right - approach_width) for left, right in zip(*observed)]
    sides = []
    for side in range(2):
        values = observed[side]
        inward, outward = (max, min) if side == 0 else (min, max)
        # Bridge the short outward recess at a side street. Inward curb
        # projections remain hard constraints on the whole lane corridor.
        bridged = window(window(values, 8, inward), 8, outward)
        safe = window(bridged, 5, inward)
        weights = [math.comb(10, j) for j in range(11)]
        smooth = [sum(safe[max(0, min(len(safe) - 1, i + j - 5))] * w for j, w in enumerate(weights)) / sum(weights)
                  for i in range(len(safe))]
        sides.append(smooth)
    return [(i, left, right) for i, (left, right) in enumerate(zip(*sides))]


def compile_surface_layout(data):
    """Fit reference-sized carriageways inside the source street reservation.

    Keep the source snapshot for reproducible building reservations. These
    compiled surfaces are shared by the ground mesh, paint and occupancy
    queries, so the added sidewalk also has a real curb and fixture clearance.
    """
    geometry = lambda key: set_precision(unary_union([Polygon(p[0], p[1:]) for p in data[key]]), .001)
    road, land, walks = (geometry(key) for key in ['carriageways', 'land', 'sidewalks'])
    arm = next(a for a in ARMS if a['id'] == 'station-east')
    a, b = [local(*p) for p in arm['points'][:2]]
    dx, dz = [(b[i] - a[i]) / math.dist(a, b) for i in range(2)]
    at = lambda t, offset: (a[0] + dx * t - dz * offset, a[1] + dz * t + dx * offset)
    observed_right = []
    for t in range(101):
        section = LineString([at(t, -35), at(t, 35)]).intersection(road)
        segments = [section] if section.geom_type == 'LineString' else list(section.geoms)
        segments = [s for s in segments if s.geom_type == 'LineString' and not s.is_empty]
        if not segments:
            break
        segment = min(segments, key=lambda s: s.distance(Point(at(t, 0))))
        endpoint = max(segment.coords, key=lambda p: (p[0] - a[0]) * -dz + (p[1] - a[1]) * dx)
        right = (endpoint[0] - a[0]) * -dz + (endpoint[1] - a[1]) * dx
        if max(map(abs, endpoint)) > 79.19 and len(observed_right) >= 2:
            right = observed_right[-1] + observed_right[-1] - observed_right[-2]
        observed_right.append(right)
    # Remove small survey-edge kinks from both sides of the underpass, not
    # just from its paint. An inward envelope keeps the source reservation.
    end = len(observed_right) - 1
    safe_right = [min(observed_right[max(0, t - 3):t + 4]) for t in range(end + 1)]
    weights = [math.comb(6, j) for j in range(7)]
    right_edge = [sum(safe_right[max(0, min(end, t + j - 3))] * w
                      for j, w in enumerate(weights)) / sum(weights) for t in range(end + 1)]
    edge = []
    for t, right in enumerate(right_edge):
        # Ease away from the existing corner only after the zebra and stop
        # bar. Keep the station-side curb in place and remove the wide apron
        # opposite it; never stretch the railway, parcels or crossing band.
        u = min(1, t / 12)
        blend = u * u * (3 - 2 * u)
        target = right - EAST_CARRIAGEWAY_WIDTH
        edge.append(at(t, -8 + (target + 8) * blend))
    strip = Polygon([at(0, -27), *edge, at(end, -27)]).simplify(.02, preserve_topology=True)
    # Sweep existing land towards the road, leaving the two transverse side
    # roads open. Their surveyed mouths interrupt the new curb naturally.
    extended = unary_union([translate(land, xoff=-dz * step / 2, yoff=dx * step / 2)
                            for step in range(25)])
    additions = road.intersection(strip).intersection(extended).simplify(.02, preserve_topology=True).intersection(road)
    reservation = unary_union([Polygon(c['paint']).buffer(1) for c in data['crossings']])
    if additions.intersects(reservation):
        raise ValueError('The east pavement extension must stay behind every crossing.')
    extensions = [additions]
    # The two local access roads must keep straight axes through the added
    # sidewalk, rather than inherit the stair-stepped land translation sweep.
    access_corridors = []
    through_corridor = Polygon(edge + [at(t, right) for t, right in reversed(list(enumerate(right_edge)))])
    for east, slope, width in [(48.2, -.043, 4.8), (80.15, -.012, 4.2)]:
        axis = LineString([local(east + slope * s, s) for s in [-100, 8]])
        corridor = axis.buffer(width / 2, cap_style=2)
        access_corridors.append(corridor)
        zone = Polygon([local(east - 7, -100), local(east + 9, -100),
                        local(east + 9, 0), local(east - 7, 0)])
        extensions.append(road.intersection(zone).difference(corridor).difference(through_corridor))
    station_edge_strip = Polygon([at(0, 35), *[at(t, right) for t, right in enumerate(right_edge)], at(end, 35)])
    extensions.append(road.intersection(station_edge_strip))
    corridors = {}
    for arm in ARMS[:3]:
        a, b = [local(*p) for p in arm['points'][:2]]
        dx, dz = [(b[i] - a[i]) / math.dist(a, b) for i in range(2)]
        at = lambda t, offset: (a[0] + dx * t - dz * offset, a[1] + dz * t + dx * offset)
        profiles = curb_lane_profiles(road, LineString([a, at(120, 0)]), arm['id'])
        edges = {-1: [], 1: []}
        influence_edges = {-1: [], 1: []}
        centers = []
        for t in range(-24, len(profiles)):
            _, left, right = profiles[max(0, t)]
            center = (left + right) / 2
            limit = {'hachiko': 20, 'dogenzaka': 12, 'jingu': 9}[arm['id']]
            for side in [-1, 1]:
                influence_edges[side].append(at(t, center + side * limit))
            if arm['id'] == 'hachiko':
                u = max(0, min(1, t / HACHIKO_NARROWING['length']))
                narrowing = HACHIKO_NARROWING['width'] * (1 - u * u * (3 - 2 * u))
                left = center - HACHIKO_THROUGH_LANES * HACHIKO_LANE_WIDTH - HACHIKO_STOPPING_BAY['width'] - .45
                right = center + HACHIKO_THROUGH_LANES * HACHIKO_LANE_WIDTH + narrowing + .45
                if t >= 0:
                    centers.append([t, center])
            else:
                left, right = center - MAIN_CARRIAGEWAY_WIDTH / 2, center + MAIN_CARRIAGEWAY_WIDTH / 2
            # Blend the narrower curbs into the central junction before the
            # zebra. Other crossing mouths remain protected below.
            u = max(0, min(1, (t + 24) / 10))
            blend = u * u * (3 - 2 * u)
            edges[-1].append(at(t, -40 + (left + 40) * blend))
            edges[1].append(at(t, 40 + (right - 40) * blend))
        influence = Polygon(influence_edges[-1] + list(reversed(influence_edges[1])))
        protected = unary_union([Polygon(c['paint']).buffer(1) for c in data['crossings'] if c['id'] != arm['id']]
            + [LineString([local(*p) for p in other['points']]).buffer(6 if other['id'] == 'center-gai' else 9)
               for other in ARMS if other['id'] != arm['id']])
        for side in [-1, 1]:
            strip = Polygon([at(-24, side * 42), *edges[side], at(len(profiles) - 1, side * 42)]).simplify(.02, preserve_topology=True)
            expanded = unary_union([translate(land, xoff=dz * side * step / 2, yoff=-dx * side * step / 2)
                                   for step in range(25)])
            extension = road.intersection(strip).intersection(influence).intersection(expanded).difference(protected)
            extensions.append(extension.simplify(.02, preserve_topology=True).intersection(road))
        if centers:
            corridors[arm['id']] = centers
    south_alley = LineString([local(-60, 54.5), local(-22, 62.9)]).buffer(2.2, cap_style=2)
    south_zone = Polygon([local(-60, 49), local(-34, 49), local(-34, 67), local(-60, 67)])
    extensions.append(road.intersection(south_zone).difference(south_alley))
    west_alley = LineString([local(-67.4, 0), local(-67.4 - 28 * 3.4 / 12, 28)]).buffer(1.9, cap_style=2)
    west_zone = Polygon([local(-80, 8), local(-63, 8), local(-63, 28), local(-80, 28)])
    extensions.append(road.intersection(west_zone).difference(west_alley))
    additions = set_precision(unary_union(extensions), .001)
    access_corridors.extend([south_alley, west_alley])
    additions = additions.difference(unary_union(access_corridors))
    # Round only the new pavement's projecting corners. Intersecting the
    # result with the additions preserves every original land reservation.
    rounded_land = land.union(additions).buffer(-1.5, quad_segs=4).buffer(1.5, quad_segs=4)
    additions = set_precision(additions.intersection(rounded_land).simplify(.02, preserve_topology=True).intersection(road), .001)
    surfaces = {'carriageways': road.difference(additions), 'sidewalks': walks.union(additions),
                'land': land.union(additions)}
    # The west alley's driveway crosses the source sidewalk. Continue its
    # straight local axis across that apron instead of leaving a broken mouth.
    west_apron_zone = Polygon([local(-75, 0), local(-63, 0), local(-63, 12), local(-75, 12)])
    west_apron = west_alley.intersection(walks).intersection(west_apron_zone).intersection(CLIP)
    surfaces['carriageways'] = surfaces['carriageways'].union(west_apron)
    surfaces['sidewalks'] = surfaces['sidewalks'].difference(west_apron)
    surfaces['land'] = surfaces['land'].difference(west_apron)
    crossings = []
    for crossing in data['crossings']:
        a, b = crossing['start'], crossing['end']
        center = [(a[i] + b[i]) / 2 for i in range(2)]
        dx, dz = [(b[i] - a[i]) / math.dist(a, b) for i in range(2)]
        section = LineString([(center[0] - dx * 45, center[1] - dz * 45),
                              (center[0] + dx * 45, center[1] + dz * 45)]).intersection(surfaces['carriageways'])
        segments = [section] if section.geom_type == 'LineString' else list(section.geoms)
        segment = min(segments, key=lambda s: s.distance(Point(center)))
        ends = sorted(segment.coords, key=lambda p: p[0] * dx + p[1] * dz)
        crossings.append({**crossing, 'start': ends[0], 'end': ends[-1]})
    data['surfaceLayout'] = {'referenceImage': 'plan/model/Shibuya-road-brid-eye-view.png',
        'eastCarriagewayWidthMetres': EAST_CARRIAGEWAY_WIDTH,
        'mainCarriagewayWidthMetres': MAIN_CARRIAGEWAY_WIDTH,
        'hachikoLaneWidthMetres': HACHIKO_LANE_WIDTH,
        'corridors': corridors, 'crossings': crossings,
        'pavementExtensions': coordinates(additions),
        'alleyAprons': coordinates(west_apron),
        **{key: coordinates(value) for key, value in surfaces.items()}}
    # Keep moving vehicles centered in the inner 3.5 m lanes. The source
    # paths used a 3 m offset; the south corridor now also follows its fitted
    # median instead of the coarse survey arm hint.
    arm = next(a for a in ARMS if a['id'] == 'hachiko')
    a, b = [local(*p) for p in arm['points'][:2]]
    dx, dz = [(b[i] - a[i]) / math.dist(a, b) for i in range(2)]
    centers = corridors['hachiko']
    routes = []
    for index, route in enumerate(data['vehicleRoutes']):
        source = LineString(route['points'])
        lane = source.parallel_offset(3 - HACHIKO_LANE_WIDTH / 2, 'left')
        points = []
        for distance in [*range(math.ceil(lane.length)), lane.length]:
            p = lane.interpolate(distance)
            t = (p.x - a[0]) * dx + (p.y - a[1]) * dz
            if -12 < t < len(centers) - 1:
                at = max(0, t)
                i, weight = math.floor(at), at % 1
                center = centers[i][1] + (centers[min(i + 1, len(centers) - 1)][1] - centers[i][1]) * weight
                offset = (p.x - a[0]) * -dz + (p.y - a[1]) * dx
                target = center + (1 if index else -1) * HACHIKO_LANE_WIDTH / 2
                u = min(1, (t + 12) / 12)
                shift = (target - offset) * u * u * (3 - 2 * u)
                p = Point(p.x - dz * shift, p.y + dx * shift)
            points.append((p.x, p.y))
        line = LineString(points)
        routes.append({'points': [[round(x, 3), round(z, 3)] for x, z in points],
                       'stopDistance': line.project(source.interpolate(route['stopDistance']))})
    data['surfaceLayout']['vehicleRoutes'] = routes
    # Reconstruct the rounded snapshot before painting, so containment agrees
    # with the exact coordinates that the installed player will consume.
    return [unary_union([Polygon(p[0], p[1:]) for p in data['surfaceLayout'][key]])
            for key in ['carriageways', 'sidewalks']]


def compile_markings(road, walks, crossings, corridors):
    """Reference-interpreted paint, independent of the surveyed road footprint.

    Japanese left-hand traffic: each arm's axis points OUT of the junction;
    positive perpendicular offsets are incoming lanes. Center-Gai is the
    pedestrian shopping entrance, not a fifth marked vehicle approach.
    """
    paint = {'paper': [], 'warmLight': [], 'coral': []}
    counts = {}
    zebra = unary_union([Polygon(c['paint']) for c in crossings])
    reservation = zebra.buffer(1.0)
    usable = road.buffer(-.20).difference(reservation)

    def add(kind, geometry, role='paper', clip=usable):
        # Remove redundant paint vertices to keep the installed player lean.
        # The 8 mm authoring tolerance applies ONLY to inferred paint, before
        # final exact surface clipping, never to the surveyed road / crossing.
        geometry = make_valid(geometry).simplify(.008, preserve_topology=True).intersection(clip)
        if geometry.is_empty:
            return
        paint[role].append(geometry)
        counts[kind] = counts.get(kind, 0) + len(polygons(geometry))

    for crossing in crossings:
        a, b = crossing['start'], crossing['end']
        length = math.dist(a, b)
        dx, dz = ((b[i] - a[i]) / length for i in range(2))
        band = Polygon(crossing['paint']).intersection(road)
        for step in range(math.ceil(length / .9)):
            t = step * .9 + .225
            x, z = a[0] + dx * t, a[1] + dz * t
            stripe = LineString([(x - dz * 7, z + dx * 7), (x + dz * 7, z - dx * 7)]).buffer(.225, cap_style=2)
            add('zebra', stripe, clip=band)

    # Match by junction topology, not by whichever arm looks widest on screen.
    # With Center-Gai pointing right in the reference, clockwise from the top:
    # Hachiko (upper-left), Dogenzaka (upper-right), Jingu (lower-right),
    # station-east (lower-left). Hachiko follows the requested two-way layout
    # with curb narrowing and a stopping bay. These are authored lane counts.
    plans = {
        'hachiko': {'reference': 'upper-left', 'incoming': HACHIKO_THROUGH_LANES,
                    'outgoing': HACHIKO_THROUGH_LANES, 'median': 0, 'pattern': 'two-way-with-stopping-bay'},
        'dogenzaka': {'reference': 'upper-right', 'incoming': 2, 'outgoing': 2, 'median': 0,
                      'pattern': 'uncoloured-curve'},
        'jingu': {'reference': 'lower-right', 'incoming': 2, 'outgoing': 2, 'median': 0,
                  'pattern': 'paired-colour-lanes'},
        'station-east': {'reference': 'lower-left', 'incoming': 3, 'outgoing': 1, 'median': -.28,
                         'pattern': 'single-colour-lane'},
    }
    approaches, curb_masks = [], []
    for arm in ARMS:
        if arm['id'] == 'center-gai':
            continue
        line = LineString([local(*p) for p in arm['points']])
        balanced = arm['id'] == 'hachiko'
        underpass = arm['id'] == 'station-east'
        smooth = balanced or underpass
        if smooth:
            a, b = line.coords[:2]
            length = math.dist(a, b)
            line = LineString([a, (a[0] + (b[0] - a[0]) / length * 120, a[1] + (b[1] - a[1]) / length * 120)])

        def frame(t):
            clamped = max(0, min(line.length, t))
            p = line.interpolate(clamped)
            before, after = line.interpolate(max(0, clamped - .25)), line.interpolate(min(line.length, clamped + .25))
            dx, dz = after.x - before.x, after.y - before.y
            norm = math.hypot(dx, dz)
            # Extrapolate short hatch strokes, rather than Shapely's negative
            # arclength convention (which would jump to the far tile edge).
            return p.x + (t - clamped) * dx / norm, p.y + (t - clamped) * dz / norm, dx / norm, dz / norm

        def at(t, offset):
            x, z, dx, dz = frame(t)
            return x - dz * offset, z + dx * offset

        def stroke(points, width=.15):
            return LineString(points).buffer(width / 2, cap_style=2, join_style=2)

        # Follow the real curved curb on each side instead of drawing a guessed
        # fixed-width rectangle through an arm that widens near the junction.
        profiles = []
        side_openings = {-1: math.inf, 1: math.inf}
        for t in range(math.ceil(line.length)):
            p = Point(at(t, 0))
            if not road.contains(p):
                break
            cross = LineString([at(t, -35), at(t, 35)]).intersection(road)
            segments = [cross] if cross.geom_type == 'LineString' else list(cross.geoms)
            segment = min(segments, key=lambda s: s.distance(p))
            x, z, dx, dz = frame(t)
            offsets = [(px - x) * -dz + (pz - z) * dx for px, pz in segment.coords]
            left, right = min(offsets) + .35, max(offsets) - .35
            # A side-street opening is not an extra-wide lane. Continue the
            # main lane guidance through it, but end the coloured curb surface.
            if profiles:
                previous = profiles[-1]
                for side, value, last in [(-1, left, previous[1]), (1, right, previous[2])]:
                    if abs(value - last) > 1.1:
                        side_openings[side] = min(side_openings[side], t)
                left = max(previous[1] - .28, min(previous[1] + .28, left))
                right = max(previous[2] - .28, min(previous[2] + .28, right))
            profiles.append((t, left, right))
        if len(profiles) < 5:
            raise ValueError(f'No continuous carriageway for {arm["id"]} paint.')

        curb_profiles = profiles
        if smooth:
            profiles = curb_lane_profiles(road, line, arm['id'])
        if balanced:
            # The two lanes each way share one fixed width. Bay and taper
            # space sit outside those lanes, rather than making them wider.
            profiles = []
            for t, center in corridors[arm['id']]:
                u = min(1, t / HACHIKO_NARROWING['length'])
                narrowing = HACHIKO_NARROWING['width'] * (1 - u * u * (3 - 2 * u))
                half = HACHIKO_THROUGH_LANES * HACHIKO_LANE_WIDTH
                profiles.append((t, center - half - HACHIKO_STOPPING_BAY['width'], center + half + narrowing))
        def lane_offset(profile, fraction):
            t, left, right = profile
            if balanced:
                distance = min(len(profiles) - 1, max(0, t))
                i, weight = math.floor(distance), distance % 1
                a = corridors[arm['id']][i][1]
                b = corridors[arm['id']][min(i + 1, len(profiles) - 1)][1]
                return a + (b - a) * weight + fraction * HACHIKO_THROUGH_LANES * HACHIKO_LANE_WIDTH
            if underpass:
                # Preserve the reference's three incoming / one outgoing split
                # across the measured corridor, even when its axis is off-centre.
                return (left + right) / 2 + fraction * (right - left) / 2
            return right * fraction if fraction >= 0 else -left * fraction

        def lane_point(profile, fraction):
            return at(profile[0], lane_offset(profile, fraction))

        plan = plans[arm['id']]
        median = plan['median']
        incoming = [median + (1 - median) * i / plan['incoming'] for i in range(plan['incoming'] + 1)]
        outgoing = [-1 + (1 + median) * i / plan['outgoing'] for i in range(plan['outgoing'] + 1)]
        def profile_at(t):
            if t < 0:
                # These two source axes start beyond the zebra. Extend their
                # approach-width paint back to it, without widening into the
                # junction or changing any surveyed surface.
                return (t, *profiles[0][1:])
            if smooth:
                t = min(len(profiles) - 1, max(0, t))
                i, weight = math.floor(t), t % 1
                a, b = profiles[i], profiles[min(i + 1, len(profiles) - 1)]
                return (t, a[1] + (b[1] - a[1]) * weight, a[2] + (b[2] - a[2]) * weight)
            return profiles[min(len(profiles) - 1, max(0, round(t)))]

        def path(start, end, fraction):
            if smooth:
                end = min(end, len(profiles) - 1)
                distances = [start, *range(math.floor(start) + 1, math.ceil(end)), end]
                return [lane_point(profile_at(t), fraction) for t in distances] if end > start else []
            before = [profile_at(t) for t in range(math.ceil(start), math.floor(min(-1, end)) + 1)]
            return [lane_point(p, fraction) for p in before + profiles if start <= p[0] <= end]

        def curb_path(begin, finish, side):
            return [at(t, profile_at(t)[1 if side < 0 else 2]) for t in range(begin, finish + 1)]

        detailed = arm['id'] in ('jingu', 'station-east')
        x, z, dx, dz = frame(0)
        crossing = next(c for c in crossings if c['id'] == arm['id'])
        paint_begin = math.floor(max((px - x) * dx + (pz - z) * dz for px, pz in crossing['paint'])) - 2 if detailed else 0

        # Keep stop bars parallel to the approach, behind the zebra, across
        # incoming lanes only. The plain curve has no stop bar in the reference.
        stop_candidates = [profile_at(t) for t in range(-4, 0)] + profiles if arm['id'] == 'station-east' else profiles
        stop = next((p for p in stop_candidates if usable.covers(stroke([
            lane_point(p, median + .015), lane_point(p, .985)], .45))), None)
        if stop is None:
            raise ValueError(f'No safe stop-line position for {arm["id"]}.')
        start = stop[0]
        has_stop = plan['pattern'] != 'uncoloured-curve'
        if has_stop:
            add('stop-bar', stroke([lane_point(stop, median + .015), lane_point(stop, .985)], .45))
        record = {'id': arm['id'], 'referencePosition': plan['reference'], 'pattern': plan['pattern'],
                  'stopMetres': start, 'hasStopBar': has_stop, 'incomingLanes': plan['incoming'],
                  'outgoingLanes': plan['outgoing'], 'medianFraction': median,
                  'islands': [], 'legends': [], 'colourAreas': []}
        if detailed or balanced:
            record.update({'symbols': [], 'arrows': [], 'guides': [], 'paintStartMetres': paint_begin})
        if balanced:
            record['basis'] = 'User-directed two-lanes-each-way layout with incoming curb narrowing and an opposite stopping bay.'
        if underpass:
            record['referenceImage'] = 'plan/qr/Shibuya-3D-qr-east-road.png'
        approaches.append(record)

        def band(kind, side, begin, finish, inner=None):
            finish = min(finish, side_openings[side] - 1, len(profiles) - 1)
            outer = path(begin, finish, side)
            if len(outer) < 2:
                return
            if kind == 'curb-stop-patch':
                # The stop patch occupies the shoulder OUTSIDE the white edge
                # line. Lane fractions describe the through corridor, whose
                # smoothed edge can sit well inside the actual curved curb.
                curb, boundary = [], []
                for t in [begin, *range(math.floor(begin) + 1, math.ceil(finish)), finish]:
                    x, z, dx, dz = frame(t)
                    section = LineString([at(t, -35), at(t, 35)]).intersection(road)
                    segments = [section] if section.geom_type == 'LineString' else list(section.geoms)
                    segment = min(segments, key=lambda s: s.distance(Point(x, z)))
                    offsets = [(px - x) * -dz + (pz - z) * dx for px, pz in segment.coords]
                    curb_offset = min(offsets) if side < 0 else max(offsets)
                    curb.append(at(t, curb_offset - side * .24))
                    boundary.append(at(t, lane_offset(profile_at(t), side) + side * .14))
                shape = Polygon(curb + list(reversed(boundary)))
            else:
                shape = Polygon(outer + list(reversed(path(begin, finish, inner))))
            # Colored approach surfaces reach the zebra; the ivory symbols and
            # guides still keep their wider safety reservation around it.
            add(kind, shape, 'coral', road.buffer(-.20).difference(zebra.buffer(.05)) if detailed else usable)
            record['colourAreas'].append({'kind': kind, 'side': side, 'startMetres': begin, 'endMetres': finish})

        # The coloured approaches are intentionally different. A curb
        # stop patch is NOT an entire red lane repeated on both sides.
        if plan['pattern'] == 'paired-colour-lanes':
            band('coloured-curb-lane', 1, paint_begin, start + 52, incoming[-2])
            band('coloured-curb-lane', -1, paint_begin, len(profiles) - 1, outgoing[1])
        elif plan['pattern'] == 'single-colour-lane':
            band('coloured-curb-lane', 1, paint_begin, len(profiles) - 1, incoming[-2])
            band('curb-stop-patch', -1, start + 2, start + 12)

        # Closed channelizing outlines and contained diagonal strokes. Exclude
        # their full envelope from lane guides, arrows and regulatory symbols.
        islands = []
        def island(kind, vertices, colour=False):
            points = [lane_point(profile_at(start + t), fraction) for t, fraction in vertices]
            lo, hi = min(t for t, _ in vertices), max(t for t, _ in vertices)
            hatch_shape(kind, points, lo, hi, colour)

        def hatch_shape(kind, points, lo, hi, colour=False):
            shape = Polygon(points).intersection(usable)
            if shape.is_empty:
                return
            islands.append(shape)
            entry = {'kind': kind, 'rings': coordinates(shape)}
            record['islands'].append(entry)
            if colour:
                add('coloured-taper', shape, 'coral')
            add('hatched-island-outline', shape.boundary.buffer(.085, join_style=2))
            x, z, dx, dz = frame(start + (lo + hi) / 2)
            def hatch_point(u, v):
                return (x + dx * u - dz * v, z + dz * u + dx * v)
            uv = [((px - x) * dx + (pz - z) * dz, (px - x) * -dz + (pz - z) * dx)
                  for p in polygons(shape) for px, pz in p.exterior.coords]
            # Phase the stripes against this island's actual transverse offset.
            # A curb wedge must not inherit the centre island's hatch origin.
            low, high = min(u - .5 * v for u, v in uv), max(u - .5 * v for u, v in uv)
            v0, v1 = min(v for _, v in uv) - 1, max(v for _, v in uv) + 1
            before_hatches = counts.get('island-hatch', 0)
            for phase in range(math.floor(low), math.ceil(high), 2):
                add('island-hatch', stroke([hatch_point(phase + .5 * v0, v0),
                    hatch_point(phase + .5 * v1, v1)], .22).intersection(shape.buffer(-.18)))
            entry['hatchCount'] = counts.get('island-hatch', 0) - before_hatches
            if entry['hatchCount'] < 3:
                raise ValueError(f'{arm["id"]} {kind} requires visible contained diagonal hatching.')

        if plan['pattern'] == 'paired-colour-lanes':
            end = min(start + 52, side_openings[1] - 1, len(profiles) - 1) - start
            if end > 17:
                # The thin nose starts beside the inner lane divider, not at
                # the curb. The triangle fans out toward the outer tile edge.
                island('outer-lane-taper', [(end - 12, incoming[-2] + .04),
                    (end, incoming[-2] + .04), (end, .97)])
        if balanced:
            end = HACHIKO_NARROWING['length']
            hatch_shape('curb-narrowing', curb_path(start, end, 1) + list(reversed(path(start, end, 1))), 0, end - start)
        lane_clip = usable.difference(unary_union(islands).buffer(.16))

        # Longer continuous guides on the plain curve. The other approaches
        # have interrupted centre guides and distinct asymmetric lane splits.
        def guide(fraction, begin, finish, dashed=False):
            finish = min(finish, len(profiles) - 1)
            entry = {'laneFraction': fraction, 'startMetres': begin, 'endMetres': finish, 'dashed': dashed}
            if smooth:
                entry['paths'] = []
            record['guides'].append(entry)
            for a, b in ([(t, min(t + 6, finish)) for t in range(math.ceil(begin), math.floor(finish), 11)]
                         if dashed else [(begin, finish)]):
                points = path(a, b, fraction)
                if len(points) > 1:
                    add('broken-divider' if dashed else 'solid-divider', stroke(points), clip=lane_clip)
                    if smooth:
                        entry['paths'].append(points)

        if balanced:
            guide(median, start, len(profiles) - 1)
            for fraction in outgoing[1:-1]:
                guide(fraction, start, len(profiles) - 1, True)
            for fraction in incoming[1:-1]:
                guide(fraction, start + .3, start + 18)
                guide(fraction, start + 21, len(profiles) - 1, True)
        elif arm['id'] == 'jingu':
            guide(median, paint_begin, len(profiles) - 1)
            guide(incoming[1], paint_begin, len(profiles) - 1)
            guide(outgoing[1], paint_begin, len(profiles) - 1, True)
        elif arm['id'] == 'station-east':
            guide(median, paint_begin, len(profiles) - 1)
            for fraction in incoming[1:-1]:
                guide(fraction, start, len(profiles) - 1)
        boundaries = [] if detailed or balanced else outgoing[1:-1] + [median] + incoming[1:-1]
        for fraction in boundaries:
            solid_end = len(profiles) - 1 if not has_stop else start + 37
            add('solid-divider', stroke(path(start if not has_stop else start + .3, solid_end, fraction)), clip=lane_clip)
            if has_stop:
                for t in range(round(solid_end + 3), len(profiles) - 3, 7):
                    add('broken-divider', stroke(path(t, t + 4, fraction)), clip=lane_clip)
        for side in [-1, 1]:
            if balanced and side == -1:
                bay = HACHIKO_STOPPING_BAY
                begin, end = bay['start'], bay['end']
                inner, outer = path(begin, end, side), curb_path(begin, end, side)
                outline = [inner[0], *outer, inner[-1]]
                separator = [lane_point(profile_at((begin + end) / 2), side),
                             at((begin + end) / 2, profile_at((begin + end) / 2)[1])]
                add('stopping-bay-outline', stroke(outline, .18))
                add('stopping-bay-divider', stroke(separator, .15))
                entry_paths = [path(t, min(t + 1.5, end), side) for t in range(begin, end, 3)]
                for points in entry_paths:
                    add('stopping-bay-entry', stroke(points, .18))
                for a, b in [(0, begin), (end, len(profiles) - 1)]:
                    add('edge-line', stroke(path(a, b, side), .18))
                record['stoppingBays'] = [{'side': side, 'startMetres': begin, 'endMetres': end,
                    'widthMetres': bay['width'], 'spaces': 2, 'rings': coordinates(Polygon(inner + list(reversed(outer)))),
                    'outline': outline, 'separator': separator, 'entryPaths': entry_paths}]
            else:
                # The incoming hatch already owns the narrowing edge.
                edge = path(HACHIKO_NARROWING['length'] if balanced else 0, side_openings[side] - 1, side)
                if len(edge) > 1:
                    add('edge-line', stroke(edge, .18))
            for begin, finish in [(0, 27), (34, 48)]:
                segment = ([at(p[0], p[1 if side < 0 else 2]) for p in curb_profiles
                            if begin <= p[0] <= min(finish, side_openings[side] - 1)] if smooth
                           else path(begin, min(finish, side_openings[side] - 1), side))
                if len(segment) > 1:
                    curb_masks.append(LineString(segment).buffer(1.3, cap_style=2))

        def lane_basis(distance, fraction, direction=1):
            if smooth:
                center = lane_point(profile_at(distance), fraction)
                before, after = lane_point(profile_at(distance - .5), fraction), lane_point(profile_at(distance + .5), fraction)
                dx, dz = after[0] - before[0], after[1] - before[1]
                length = math.hypot(dx, dz)
                dx, dz = dx / length * direction, dz / length * direction
                return lambda x, forward: (center[0] - dz * x - dx * forward, center[1] + dx * x - dz * forward)
            lateral = lane_offset(profile_at(distance), fraction)
            return lambda x, forward: at(distance - forward * direction, lateral + x * direction)

        def arrow(distance, fraction, turn=0, straight=True, direction=1):
            if distance + 4 >= len(profiles):
                return
            p = lane_basis(distance, fraction, direction)
            shape = stroke([p(0, -3.3), p(0, .4)], .19)
            if straight:
                shape = shape.union(stroke([p(0, .4), p(0, 2.4)], .19))
                shape = shape.union(Polygon([p(0, 3.2), p(-.48, 1.9), p(.48, 1.9)]))
            if turn:
                if detailed or balanced:
                    # A distinct left-facing head, not a tiny diagonal fin
                    # fused into the straight arrowhead. Combined arrows fork
                    # lower down the shaft, as in the lower-right reference.
                    y = -.4 if straight else 1.9
                    if not straight:
                        shape = shape.union(stroke([p(0, .3), p(0, y - 1.3)], .19))
                    shape = shape.union(stroke([p(0, y - 1.3), p(turn * .15, y - .45),
                        p(turn * .55, y), p(turn * .85, y)], .19))
                    shape = shape.union(Polygon([p(turn * 1.4, y), p(turn * .65, y - .6), p(turn * .65, y + .6)]))
                else:
                    shape = shape.union(stroke([p(0, .3), p(turn * .25, 1.25), p(turn * .83, 1.7)], .19))
                    shape = shape.union(Polygon([p(turn * 1.2, 2.0), p(turn * .55, 1.0), p(turn * .45, 2.0)]))
            add('direction-arrow', shape, clip=lane_clip)
            if detailed or balanced:
                record['arrows'].append({'distanceMetres': distance, 'laneFraction': fraction,
                                        'direction': direction, 'straight': straight, 'turn': turn})

        def no_u_turn(distance, fraction, direction=1):
            """Road marking 101: an OPEN right-hand hairpin above a separate X.

            x is the driver's left, forward points in that driver's direction.
            Rotating the whole glyph 180 degrees for outbound traffic preserves
            its handedness. It must never become '40', a closed oval, a mirrored
            hairpin, or a road-sign circle/slash.
            """
            p = lane_basis(distance, fraction, direction)
            hook = [(.62, -4), (.62, 3.1)] + [(.62 * math.cos(i * math.pi / 8),
                3.1 + .9 * math.sin(i * math.pi / 8)) for i in range(1, 9)] + [(-.62, -1.8)]
            body = stroke([p(*point) for point in hook], .18).union(Polygon([
                p(-.62, -3.5), p(-.95, -1.6), p(-.29, -1.6)]))
            cross = unary_union([stroke([p(-.8, -11), p(.8, -6)], .18),
                                 stroke([p(.8, -11), p(-.8, -6)], .18)])
            if not lane_clip.covers(body.union(cross)):
                raise ValueError(f'{arm["id"]}: the complete no-U-turn marking must fit its lane.')
            add('no-u-turn-arrow', body, clip=lane_clip)
            add('no-u-turn-cross', cross, clip=lane_clip)
            # Small semantic anchors let tests inspect actual compiled paint,
            # including its empty hook and the gap separating arrow from X.
            record['symbols'].append({'kind': 'no-u-turn', 'distanceMetres': distance,
                'laneFraction': fraction, 'direction': direction,
                'anchors': {name: p(*point) for name, point in {
                    'stem': (.62, 0), 'crown': (0, 4), 'arrowHead': (-.62, -2),
                    'cross': (0, -8.5), 'gap': (0, -5), 'openHook': (0, 0)}.items()}})

        # Only the small restriction-hours label is text. The large hairpins
        # in the reference are no-U-turn symbols, NOT speed-limit numerals.
        zero = [(-.28, -.43), (-.36, -.33), (-.36, .33), (-.28, .43),
                (.28, .43), (.36, .33), (.36, -.33), (.28, -.43), (-.28, -.43)]
        digits = {'0': [zero],
                  '8': [zero, [(-.36, 0), (.36, 0)]],
                  '2': [[(-.35, .30), (-.25, .43), (.25, .43), (.35, .30), (.30, .12),
                         (-.35, -.32), (-.35, -.43), (.36, -.43)]], '-': [[(-.25, 0), (.25, 0)]]}
        def legend(text, distance, fraction, height=10, direction=1):
            if distance + height / 2 >= len(profiles):
                return
            p = lane_basis(distance, fraction, direction)
            width = 2.1
            pitch = width / len(text)
            # Glyph x runs rightward on the page; lane_basis x is driver-left.
            # Negate x so neither the 2 nor the character order is mirrored.
            geometry = unary_union([stroke([p(-(i - (len(text) - 1) / 2 + x) * pitch, y * height)
                for x, y in line], .13) for i, digit in enumerate(text) for line in digits[digit]])
            # Do not retain unreadable fragments where a legend meets a hatch.
            if lane_clip.covers(geometry):
                add('road-legend', geometry, clip=lane_clip)
                record['legends'].append({'text': text, 'distanceMetres': distance, 'laneFraction': fraction,
                                          'direction': direction})

        if balanced:
            # The curb-side incoming lane permits straight and left travel.
            for a, b in zip(incoming[:-1], incoming[1:]):
                arrow(start + 10, (a + b) / 2, turn=1 if b == incoming[-1] else 0)
        elif arm['id'] == 'jingu':
            # Lower-right reference: two inbound arrows, a repeated straight
            # arrow farther out, and ONE reversed prohibition in the outbound
            # inner lane. The outbound coral lane has no arrow or prohibition.
            arrow(start + 10, (incoming[0] + incoming[1]) / 2)
            arrow(start + 10, (incoming[1] + incoming[2]) / 2, turn=1)
            arrow(start + 44, (incoming[0] + incoming[1]) / 2)
            no_u_turn(start + 40, (outgoing[1] + outgoing[2]) / 2, -1)
        elif arm['id'] == 'station-east':
            # Lower-left reference: left-only arrow in the coral lane, two
            # inbound prohibitions, then an oppositely oriented third one with
            # its hours label between the crossing and the outbound X.
            arrow(start + 6, (incoming[-2] + incoming[-1]) / 2, turn=1, straight=False)
            for a, b in zip(incoming[:-2], incoming[1:-1]):
                no_u_turn(start + 13, (a + b) / 2)
            no_u_turn(start + 31, (outgoing[0] + outgoing[1]) / 2, -1)
            legend('8-20', start + 13, (outgoing[0] + outgoing[1]) / 2, 1.6, -1)

    # One thin gold curb accent follows each selected native corner/edge.
    # Do not stack the former straight warning bars over these curved strips.
    corner_mask = unary_union(curb_masks + [Point(p).buffer(7.5) for c in crossings for p in [c['start'], c['end']]])
    curb = road.boundary.intersection(walks.buffer(.25)).intersection(corner_mask)
    add('curb-edge-accent', curb.buffer(.34, quad_segs=2), 'warmLight', walks.buffer(-.06))
    return {role: coordinates(unary_union(parts)) for role, parts in paint.items()}, {
        'method': 'Reference-interpreted approach paint and user-directed Hachiko curb layout; not lane-level survey or live traffic regulation.',
        'features': counts, 'approaches': approaches,
        'referenceImage': 'plan/model/Shibuya-road-brid-eye-view.png',
        'referenceOrientation': 'Center-Gai right; clockwise Hachiko upper-left, Dogenzaka upper-right, Jingu lower-right, station-east lower-left.',
        'sources': ['https://www.npa.go.jp/bureau/traffic/seibi2/kisei/mokuteki/mokuteki.html',
                    'https://www.nilim.go.jp/lab/bcg/siryou/tnn/tnn0848pdf/ks084812.pdf#page=35',
                    'https://center-gai.jp/about/data/'],
    }


def write_data(data, preview=None):
    def rounded(value):
        if isinstance(value, float): return round(value, 6)
        if isinstance(value, (list, tuple)): return [rounded(v) for v in value]
        if isinstance(value, dict): return {k: rounded(v) for k, v in value.items()}
        return value
    target = ROOT / 'packages/designqr/src/designs/city/road-data.ts'
    target.write_text('// Generated by scripts/build-shibuya-road.py. Do not hand-edit.\n'
        '// PLATEAU Shibuya 2025 (CC BY 4.0 compatible); modified. See shibuya-road-network.md.\n'
        '// Coordinates are metres, NOT claims of millimetre survey accuracy.\n'
        'export const SHIBUYA_ROAD_DATA = {\n' + ',\n'.join(
            '  ' + json.dumps(k) + ': ' + json.dumps(rounded(v), separators=(',', ':')) for k, v in data.items()) + '\n};\n')
    if preview:
        svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1440" viewBox="-82 -82 164 164">',
               '<rect x="-82" y="-82" width="164" height="164" fill="#cddbe4"/>']
        layers = [(data['surfaceLayout']['carriageways'], '#1f3a52'), (data['markings']['coral'], '#ea6157'),
                  (data['markings']['paper'], '#e8ddcf'), (data['markings']['warmLight'], '#eed883')]
        for rings, color in layers:
            for p in rings:
                svg.append(f'<path d="{svg_path(Polygon(p[0], p[1:]))}" fill="{color}" fill-rule="evenodd"/>')
        svg.append('</svg>')
        preview.write_text(''.join(svg))
    print(f'Wrote {target.relative_to(ROOT)}; paint: {data["markingInterpretation"]["features"]}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument('--source-dir', type=Path)
    inputs.add_argument('--from-snapshot', action='store_true', help='Compile pavement refinements and paint from the checked-in survey without fetching source files.')
    parser.add_argument('--preview', type=Path)
    args = parser.parse_args()
    if args.from_snapshot:
        source = (ROOT / 'packages/designqr/src/designs/city/road-data.ts').read_text()
        data = json.loads(source.split('export const SHIBUYA_ROAD_DATA = ', 1)[1].strip().removesuffix(';'))
        road, walks = compile_surface_layout(data)
        data['markings'], data['markingInterpretation'] = compile_markings(road, walks, data['surfaceLayout']['crossings'], data['surfaceLayout']['corridors'])
        for arm in data['arms']:
            arm['lanes'] = next(a['lanes'] for a in ARMS if a['id'] == arm['id'])
        write_data(data, args.preview)
        return
    surfaces = {'carriageways': [], 'sidewalks': [], 'islands': []}
    source_ids, checksums = [], {}

    def ring(element):
        values = list(map(float, element.text.split()))
        points = []
        # EPSG:6697 CityGML is latitude, longitude, height, NOT longitude first.
        for i in range(0, len(values), 3):
            e, n = projection.transform(values[i + 1], values[i])
            points.append(local(e - origin[0], origin[1] - n))
        return points

    for filename in FILES:
        path = args.source_dir / filename
        checksums[filename] = hashlib.sha256(path.read_bytes()).hexdigest()
        for road in ET.parse(path).getroot().findall('.//t:Road', NS):
            areas = road.findall('.//t:TrafficArea', NS) + road.findall('.//t:AuxiliaryTrafficArea', NS)
            lod = 3 if any(a.find('t:lod3MultiSurface', NS) is not None for a in areas) else 2
            used = False
            for area in areas:
                category = {'1000': 'carriageways', '1020': 'carriageways', '2000': 'sidewalks', '3000': 'islands'}.get(area.findtext('t:function', '', NS))
                surface = area.find(f't:lod{lod}MultiSurface', NS)
                if category is None or surface is None:
                    continue
                for polygon in surface.findall('.//g:Polygon', NS):
                    exterior = polygon.find('g:exterior//g:posList', NS)
                    if exterior is None:
                        continue
                    geometry = Polygon(ring(exterior), [ring(r) for r in polygon.findall('g:interior//g:posList', NS)])
                    if not geometry.is_valid:
                        geometry = geometry.buffer(0)
                    if geometry.area > .005 and geometry.intersects(CLIP):
                        surfaces[category].append(geometry.intersection(CLIP))
                        used = True
            if used:
                source_ids.append({'id': road.get('{' + NS['g'] + '}id'), 'file': filename, 'lod': lod,
                    'sourceScale': next((e.text for e in road.iter() if e.tag.endswith(f'}}srcScaleLod{lod}')), None)})

    # Close only sub-5 cm seams between adjoining survey surfaces; never smooth corners.
    surfaces = {k: unary_union(v).buffer(.025, join_style=2).buffer(-.025, join_style=2).intersection(CLIP)
                for k, v in surfaces.items()}
    road = surfaces['carriageways']
    land = CLIP.difference(road)
    walks = surfaces['sidewalks'].difference(road)

    # Trace of the five painted bands in a georeferenced GSI z18 aerial mosaic.
    # Coordinates below are mosaic pixels (tiles x232797..99, y103245..47 at 512 px).
    # Paint is approximate image interpretation, NOT a PLATEAU lane-level survey.
    traces = [
        ('jingu', [[938, 430], [1009, 447], [1001, 476], [930, 458]]),
        ('dogenzaka', [[806, 479], [836, 484], [825, 545], [795, 540]]),
        ('hachiko', [[850, 578], [945, 596], [939, 625], [845, 606]]),
        ('station-east', [[1000, 501], [1030, 504], [1023, 576], [994, 574]]),
        ('scramble', [[887, 480], [919, 464], [997, 565], [967, 582]]),
    ]
    mosaic_origin = [940.05930668, 524.78625803]
    metres_per_pixel = 40075016.68557849 * math.cos(math.radians(ORIGIN[1])) / 2**18 / 512
    crossings = []
    for name, pixels in traces:
        points = [local((x - mosaic_origin[0]) * metres_per_pixel, (y - mosaic_origin[1]) * metres_per_pixel) for x, y in pixels]
        # First / last stripe centres; consistent direction follows the long band.
        if name in ['jingu', 'hachiko']:
            start = tuple((points[0][i] + points[3][i]) / 2 for i in range(2))
            end = tuple((points[1][i] + points[2][i]) / 2 for i in range(2))
        else:
            start = tuple((points[0][i] + points[1][i]) / 2 for i in range(2))
            end = tuple((points[2][i] + points[3][i]) / 2 for i in range(2))
        length = math.dist(start, end)
        dx, dz = ((end[i] - start[i]) / length for i in range(2))
        width = Polygon(points).area / length
        center = tuple((start[i] + end[i]) / 2 for i in range(2))
        axis = LineString([(center[0] - dx * 40, center[1] - dz * 40), (center[0] + dx * 40, center[1] + dz * 40)])
        segments = axis.intersection(road)
        segments = [segments] if segments.geom_type == 'LineString' else list(segments.geoms)
        segment = min(segments, key=lambda s: s.distance(Point(center)))
        ends = list(segment.coords)
        # Orient the actual curb-to-curb axis to match the photo trace.
        if (ends[-1][0] - ends[0][0]) * dx + (ends[-1][1] - ends[0][1]) * dz < 0:
            ends.reverse()
        crossings.append({'id': name, 'paint': points, 'start': ends[0], 'end': ends[-1], 'width': width})

    # Fixed parcels are generated against the whole road + sidewalk reservation,
    # not just corner tests. Runtime QR variation must stay inside these parcels.
    reservation = unary_union([road, surfaces['sidewalks'], surfaces['islands']]).buffer(1.2)
    station_strip = rotate(box(54, -160, 80, 160), ANGLE, origin=(0, 0))
    buildable = box(-77.6, -77.6, 77.6, 77.6).difference(reservation.union(station_strip))
    buildable_land = buildable
    plots = []
    preferred = [(25, -54, 28, 22), (-61, -22, 20, 18)]
    for target_x, target_z, width, depth in preferred:
        options = []
        for x in range(-76, 77, 2):
            for z in range(-76, 77, 2):
                parcel = box(x - width / 2, z - depth / 2, x + width / 2, z + depth / 2)
                if buildable.covers(parcel) and (not plots or x < -30):
                    options.append(((x - target_x)**2 + (z - target_z)**2, parcel))
        if not options:
            raise ValueError(f'Landmark {len(plots)} no longer fits the source geometry; review its parcel.')
        parcel = min(options, key=lambda p: p[0])[1]
        plots.append(parcel)
        buildable = buildable.difference(parcel.buffer(1))
    for target_x, target_z in [(60, -67), (-23, -65), (-55, 62), (48, -29), (-46, -72), (20, -73),
                               (-17, -44), (-69, 68), (-28, 69), (69, -49), (-69, -1), (69, -15), (0, -73)]:
        options = []
        for width, depth in [(12, 14), (10, 12)]:
            for x in range(-72, 73, 2):
                for z in range(-70, 71, 2):
                    parcel = box(x - width / 2, z - depth / 2, x + width / 2, z + depth / 2)
                    if buildable.covers(parcel):
                        options.append(((x - target_x)**2 + (z - target_z)**2, parcel))
            if options:
                break
        if not options:
            break  # Density must fit the land, never expand a parcel into a street.
        parcel = min(options, key=lambda p: p[0])[1]
        plots.append(parcel)
        buildable = buildable.difference(parcel.buffer(1))

    centerline = LineString([local(*p) for p in [*reversed(ARMS[0]['points']), [4, -12], [-3, 2], [-10, 15], *ARMS[2]['points']]])
    routes = []
    for direction, stop in [(1, (10, -28)), (-1, (-14.2, 28))]:
        line = centerline if direction == 1 else LineString(list(centerline.coords)[::-1])
        lane = line.parallel_offset(3, 'right')
        routes.append({'points': list(lane.coords), 'stopDistance': lane.project(Point(local(*stop)))})

    data = {'provenance': {'dataset': 'plateau-13113-shibuya-ku-2025', 'sourceCrs': 'EPSG:6697',
        'horizontalCrs': 'EPSG:6677', 'originLonLat': ORIGIN, 'rotationDegrees': ANGLE,
        'tileMetres': EXTENT, 'sourceSha256': checksums, 'roads': source_ids},
        'carriageways': coordinates(road), 'sidewalks': coordinates(walks), 'land': coordinates(land),
        'islands': coordinates(surfaces['islands']), 'buildable': coordinates(buildable_land),
        'crossings': crossings, 'plots': [list(p.bounds) for p in plots], 'arms': ARMS, 'vehicleRoutes': routes}
    road, walks = compile_surface_layout(data)
    data['markings'], data['markingInterpretation'] = compile_markings(road, walks, data['surfaceLayout']['crossings'], data['surfaceLayout']['corridors'])
    write_data(data, args.preview)
    for c in crossings:
        print(f'{c["id"]}: curb-to-curb {math.dist(c["start"], c["end"]):.2f} m; paint width {c["width"]:.2f} m')


if __name__ == '__main__':
    main()
