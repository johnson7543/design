import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute, Color, Group, Mesh, MeshBasicMaterial } from 'three';
import { SHIBUYA_ROAD_DATA } from '../src/designs/city/road-data.ts';
import { CITY_PAVEMENT_HEIGHT, SHIBUYA_CARRIAGEWAYS, SHIBUYA_CROSSWALKS, SHIBUYA_PAVEMENTS, SHIBUYA_ROAD_MARKINGS,
  SHIBUYA_SIGNAL_POSITIONS, SHIBUYA_STATION,
  cityOnCarriageway, cityPointInPolygon, citySurfaceDistance, citySurveyPoint, roadMetres } from '../src/designs/city/road-network.ts';
import { cityPavementFixtureFits, cityStreetFrame, isCityStreetApproachClear, SHIBUYA_CENTER_GAI_ENTRANCE,
  SHIBUYA_GUARDRAILS, SHIBUYA_STREET_LANTERNS, SHIBUYA_STREET_SIGNALS } from '../src/designs/city/street-layout.ts';
import { cityStreetSignalPhase, createShibuyaStreetFurniture, SHIBUYA_SIGNAL_DIMENSIONS } from '../src/designs/city/street-furniture.ts';
import { SHIBUYA_PALETTE as P } from '../src/designs/city/palette.ts';
import { ShibuyaScene } from '../src/renderer/webgl/ShibuyaScene.ts';

test('approach paint is clipped, left-driving, and absent from the shopping entrance', () => {
  const interpretation = SHIBUYA_ROAD_DATA.markingInterpretation;
  assert.equal(interpretation.approaches.length, 4);
  assert.ok(interpretation.approaches.every(a => a.id !== 'center-gai'));
  for (const [kind, expected] of Object.entries({ 'stop-bar': 3, 'coloured-curb-lane': 3,
    'curb-stop-patch': 1, 'hatched-island-outline': 2, 'stopping-bay-outline': 1 })) {
    assert.equal(interpretation.features[kind as keyof typeof interpretation.features], expected);
  }
  assert.equal(interpretation.features['direction-arrow'], 6);
  assert.equal(interpretation.features['no-u-turn-arrow'], 4);
  assert.equal(interpretation.features['no-u-turn-cross'], 4);
  assert.ok(interpretation.features['curb-edge-accent'] >= 5);
  assert.equal('tactile-warning' in interpretation.features, false, 'Do not double the curved curb accents with old straight bars.');
  for (const { role, polygons } of SHIBUYA_ROAD_MARKINGS) for (const polygon of polygons) {
    for (const p of polygon.rings.flat()) {
      const surfaces = role === 'warmLight' ? SHIBUYA_PAVEMENTS : SHIBUYA_CARRIAGEWAYS;
      assert.ok(citySurfaceDistance(p.x, p.z, surfaces) >= -roadMetres(.003), 'Paint escaped its source surface.');
    }
    if (role !== 'warmLight') for (const distance of [5, 10, 20, 30]) {
      assert.equal(cityPointInPolygon(cityStreetFrame('center-gai', distance).position, polygon), false);
    }
  }
});

test('bird’s-eye paint treatments follow the reference arms rather than repeating generic curb lanes', () => {
  const approaches = SHIBUYA_ROAD_DATA.markingInterpretation.approaches;
  const curve = approaches.find(a => a.id === 'dogenzaka')!;
  assert.equal(curve.referencePosition, 'upper-right');
  assert.equal(curve.pattern, 'uncoloured-curve');
  assert.equal(curve.hasStopBar, false);
  assert.deepEqual(curve.colourAreas, []); assert.deepEqual(curve.islands, []); assert.deepEqual(curve.legends, []);
  const coral = SHIBUYA_ROAD_MARKINGS.find(m => m.role === 'coral')!.polygons;
  for (const distance of [3, 8, 15, 25, 40]) {
    const f = cityStreetFrame('dogenzaka', distance);
    for (const metres of [-4, -2, 0, 2, 4]) {
      const p = { x: f.position.x + f.lateral.x * roadMetres(metres), z: f.position.z + f.lateral.z * roadMetres(metres) };
      assert.ok(coral.every(polygon => !cityPointInPolygon(p, polygon)), 'The plain curved approach was painted as a coloured lane.');
    }
  }
  const single = approaches.find(a => a.id === 'station-east')!;
  assert.equal(single.referencePosition, 'lower-left');
  assert.equal(single.incomingLanes, 3); assert.equal(single.outgoingLanes, 1);
  assert.equal(single.colourAreas.filter(c => c.kind === 'coloured-curb-lane').length, 1);
  assert.ok(single.colourAreas.some(c => c.kind === 'curb-stop-patch' && c.endMetres - c.startMetres === 10));
  assert.ok(single.colourAreas.every(c => c.kind !== 'narrow-curb-band'), 'East has a curb patch, not a continuous opposite coral strip.');
  assert.ok(single.legends.some(l => l.text === '8-20'));
  const frame = cityStreetFrame('station-east', 0);
  for (const [distance, shoulder, traffic] of [[0, -6.8, -4.7], [4, -6.5, -4.6], [6, -5.95, -4.25]]) {
    const at = (offset: number) => ({
      x: frame.position.x + roadMetres(distance * frame.forward.x + offset * frame.lateral.x),
      z: frame.position.z + roadMetres(distance * frame.forward.z + offset * frame.lateral.z),
    });
    assert.ok(coral.some(polygon => cityPointInPolygon(at(shoulder), polygon)),
      'The short stop patch must fill the curbside shoulder outside the white edge line.');
    assert.ok(coral.every(polygon => !cityPointInPolygon(at(traffic), polygon)),
      'The stop-area color must not enter the outgoing through lane.');
  }
  const paired = approaches.find(a => a.id === 'jingu')!;
  assert.equal(paired.referencePosition, 'lower-right');
  assert.equal(paired.colourAreas.filter(c => c.kind === 'coloured-curb-lane').length, 2);
  assert.deepEqual(paired.islands.map(i => i.kind), ['outer-lane-taper']);
  assert.deepEqual(approaches.flatMap(a => a.legends).map(l => l.text), ['8-20'],
    'The large reference glyphs are prohibitions, not repeated 40 speed limits.');
  for (const a of approaches) for (const island of a.islands) {
    assert.ok(island.hatchCount >= 3, `${a.id}: the curb and outer-lane wedges need stripes, not only an outline.`);
    for (const polygon of island.rings) for (const [x, z] of polygon.flat()) {
      assert.ok(citySurfaceDistance(roadMetres(x), roadMetres(z), SHIBUYA_CARRIAGEWAYS) > -roadMetres(.003));
    }
  }
});

test('Hachiko has two lanes each way, an incoming curb taper, and an opposite stopping bay', () => {
  const approach = SHIBUYA_ROAD_DATA.markingInterpretation.approaches.find(a => a.id === 'hachiko')!;
  assert.equal(approach.referencePosition, 'upper-left');
  assert.equal(approach.pattern, 'two-way-with-stopping-bay');
  assert.equal(approach.incomingLanes, 2); assert.equal(approach.outgoingLanes, 2);
  assert.equal(SHIBUYA_ROAD_DATA.arms.find(a => a.id === 'hachiko')!.lanes, 4);
  assert.equal(approach.medianFraction, 0); assert.equal(approach.hasStopBar, true);
  assert.deepEqual(approach.islands.map(i => i.kind), ['curb-narrowing']);
  assert.deepEqual(approach.colourAreas, []);
  assert.deepEqual(approach.legends, []); assert.deepEqual(approach.symbols, []);
  assert.deepEqual(approach.arrows!.map(a => [a.laneFraction, a.direction, a.straight, a.turn]),
    [[.25, 1, true, 0], [.75, 1, true, 1]], 'The incoming curb lane allows straight and left; the inner lane stays straight-only.');
  assert.ok(approach.arrows!.every(a => a.distanceMetres === approach.stopMetres + 10));
  const guides = approach.guides!;
  assert.deepEqual(guides.filter(g => g.laneFraction === 0).map(g => g.dashed), [false], 'Keep a continuous center divider.');
  assert.deepEqual(guides.filter(g => g.laneFraction < 0).map(g => [g.laneFraction, g.dashed]),
    [[-.5, true]], 'Two outgoing through lanes share one dashed divider.');
  assert.deepEqual(guides.filter(g => g.laneFraction === .5).map(g => g.dashed), [false, true],
    'The incoming divider transitions from solid near the stop bar to dashed farther away.');

  const frame = cityStreetFrame('hachiko', 0);
  const along = ([x, z]: number[]) => (x - frame.position.x / roadMetres(1)) * frame.forward.x
    + (z - frame.position.z / roadMetres(1)) * frame.forward.z;
  const lateral = ([x, z]: number[]) => x * frame.lateral.x + z * frame.lateral.z;
  const taper = approach.islands[0].rings[0][0];
  const taperWidth = (distance: number) => {
    const hits: number[] = [];
    for (let i = 0; i < taper.length; i++) {
      const a = taper[i], b = taper[(i + 1) % taper.length], start = along(a), end = along(b);
      if ((start < distance) === (end < distance)) continue;
      hits.push(lateral(a) + (lateral(b) - lateral(a)) * (distance - start) / (end - start));
    }
    assert.equal(hits.length, 2);
    return Math.max(...hits) - Math.min(...hits);
  };
  assert.ok(taperWidth(8) > 4 && taperWidth(24) < 1,
    'The excluded curb space must widen toward the projecting sidewalk, before the stop bar.');

  const bay = approach.stoppingBays![0];
  assert.equal(approach.stoppingBays!.length, 1);
  assert.equal(bay.side, -1); assert.equal(bay.spaces, 2);
  assert.ok(bay.startMetres > approach.stopMetres + 5);
  assert.ok(bay.endMetres - bay.startMetres >= 18 && bay.widthMetres >= 3);
  const paper = SHIBUYA_ROAD_MARKINGS.find(m => m.role === 'paper')!.polygons;
  for (const points of [bay.outline, bay.separator, ...bay.entryPaths]) {
    for (let i = 1; i < points.length; i++) {
      const p = { x: roadMetres((points[i - 1][0] + points[i][0]) / 2), z: roadMetres((points[i - 1][1] + points[i][1]) / 2) };
      assert.ok(paper.some(polygon => cityPointInPolygon(p, polygon)), 'The stopping bay lost its outline or access dashes.');
    }
  }
  for (const points of bay.entryPaths.slice(1, -1)) {
    const p = { x: roadMetres(points[0][0] - frame.lateral.x * bay.widthMetres / 2),
      z: roadMetres(points[0][1] - frame.lateral.z * bay.widthMetres / 2) };
    assert.ok(cityOnCarriageway(p.x, p.z));
    assert.ok(paper.every(polygon => !cityPointInPolygon(p, polygon)), 'Keep the stopping spaces clear of hatching and through-lane arrows.');
  }
  const coral = SHIBUYA_ROAD_MARKINGS.find(m => m.role === 'coral')!.polygons;
  for (const distance of [5, 15, 30, 45]) {
    const f = cityStreetFrame('hachiko', distance);
    for (let metres = -14; metres <= 14; metres += .5) {
      const p = { x: f.position.x + f.lateral.x * roadMetres(metres), z: f.position.z + f.lateral.z * roadMetres(metres) };
      assert.ok(coral.every(polygon => !cityPointInPolygon(p, polygon)), 'Use ordinary road paint for the taper and stopping bay.');
    }
  }
});

test('south-road dividers follow a smooth through corridor around the sidewalk projection', () => {
  const approach = SHIBUYA_ROAD_DATA.markingInterpretation.approaches.find(a => a.id === 'hachiko')!;
  const guides = approach.guides!.map(g => {
    assert.ok('paths' in g && Array.isArray(g.paths));
    return { ...g, paths: g.paths as number[][][] };
  });
  const median = guides.find(g => g.laneFraction === 0)!.paths[0];
  const paper = SHIBUYA_ROAD_MARKINGS.find(m => m.role === 'paper')!.polygons;
  const frame = cityStreetFrame('hachiko', 0);
  const inTile = (p: number[]) => Math.max(Math.abs(p[0]), Math.abs(p[1])) < 79;
  const heading = (a: number[], b: number[]) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const along = (p: number[]) => (p[0] - frame.position.x / roadMetres(1)) * frame.forward.x
    + (p[1] - frame.position.z / roadMetres(1)) * frame.forward.z;
  for (const guide of guides) for (const path of guide.paths) {
    for (const [i, point] of path.entries()) {
      if (i > 0 && inTile(point) && inTile(path[i - 1])) {
        // Sample inside each stroke; rounded flat caps may put their exact
        // endpoints just outside the polygon's boundary convention.
        const p = { x: roadMetres((point[0] + path[i - 1][0]) / 2), z: roadMetres((point[1] + path[i - 1][1]) / 2) };
        assert.ok(paper.some(polygon => cityPointInPolygon(p, polygon)), 'The lane guide was clipped into disconnected fragments.');
      }
      if (i > 0) assert.ok(along(point) > along(path[i - 1]), 'A divider folded back toward the crossing.');
      if (i > 0 && i < path.length - 1 && inTile(point)) {
        const turn = heading(point, path[i + 1]) - heading(path[i - 1], point);
        assert.ok(Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) < Math.PI / 180 * 4.25,
          'A lane divider inherited an abrupt curb or centerline kink.');
      }
    }
  }
  // The outer end is a map cut, so the remaining lanes keep their full width
  // instead of squeezing toward the visible slice of the carriageway.
  const outer = guides.find(g => g.laneFraction === -.5)!.paths;
  let widthSamples = 0;
  for (const p of outer.flat()) {
    const distance = along(p);
    if (distance < 50 || distance > 65) continue;
    const center = median.find(q => Math.abs(along(q) - distance) < .01)!;
    assert.ok(center);
    const offset = (p[0] - center[0]) * frame.lateral.x + (p[1] - center[1]) * frame.lateral.z;
    assert.ok(Math.abs(Math.abs(offset) - 3.5) < .02, 'South-road lanes must retain their 3.5 m width at the map cut.');
    widthSamples++;
  }
  assert.ok(widthSamples >= 5);
});

test('north and east prohibitions have open right-hand hairpins, separate X marks, and lane-specific directions', () => {
  const approaches = SHIBUYA_ROAD_DATA.markingInterpretation.approaches;
  const north = approaches.find(a => a.id === 'jingu')!, east = approaches.find(a => a.id === 'station-east')!;
  assert.deepEqual(north.symbols!.map(s => [s.direction, s.laneFraction]), [[-1, -.25]],
    'North has one outbound-inner prohibition, not one per lane.');
  assert.deepEqual(east.symbols!.map(s => [s.direction, s.laneFraction]), [[1, -.066667], [1, .36], [-1, -.64]],
    'East has two inbound prohibitions and one reversed outbound prohibition.');
  assert.deepEqual(north.arrows!.map(a => [a.straight, a.turn, a.laneFraction]),
    [[true, 0, .25], [true, 1, .75], [true, 0, .25]]);
  assert.deepEqual(east.arrows!.map(a => [a.straight, a.turn, a.laneFraction]), [[false, 1, .786667]]);
  assert.ok(north.arrows!.every(a => a.direction === 1) && east.arrows!.every(a => a.direction === 1));
  const paper = SHIBUYA_ROAD_MARKINGS.find(m => m.role === 'paper')!.polygons;
  const painted = ([x, z]: number[]) => paper.some(p => cityPointInPolygon({ x: roadMetres(x), z: roadMetres(z) }, p));
  for (const approach of [north, east]) for (const s of approach.symbols!) {
    assert.equal(s.kind, 'no-u-turn');
    const { stem, crown, arrowHead, cross, gap, openHook } = s.anchors;
    for (const anchor of [stem, crown, arrowHead, cross]) assert.ok(painted(anchor), `${approach.id}: missing symbol stroke.`);
    assert.equal(painted(gap), false, 'The X must stay separate from the U-turn arrow.');
    assert.equal(painted(openHook), false, 'The hairpin must be open, never a 0 or a sign circle.');
    const frame = cityStreetFrame(approach.id, s.distanceMetres);
    const longitudinal = (crown[0] - cross[0]) * frame.forward.x + (crown[1] - cross[1]) * frame.forward.z;
    assert.ok(longitudinal * s.direction < -12, 'Crown and X must rotate together to face their own traffic.');
    const handedness = (stem[0] - arrowHead[0]) * frame.lateral.x + (stem[1] - arrowHead[1]) * frame.lateral.z;
    assert.ok(handedness * s.direction > 1.1, 'Outbound symbols rotate; they must not mirror into left-hand U-turns.');
    // Check all four arms of the actual X, not merely its metadata or centre.
    const f = cityStreetFrame(approach.id, s.distanceMetres + 8.5 * s.direction);
    const axisLength = Math.hypot(crown[0] - cross[0], crown[1] - cross[1]);
    const glyphForward = { x: (crown[0] - cross[0]) / axisLength, z: (crown[1] - cross[1]) / axisLength };
    for (const left of [-.48, .48]) for (const forward of [-1.5, 1.5]) {
      const point = approach.id === 'station-east'
        ? [cross[0] + glyphForward.z * left + glyphForward.x * forward,
          cross[1] - glyphForward.x * left + glyphForward.z * forward]
        : [cross[0] + (f.lateral.x * left - f.forward.x * forward) * s.direction,
          cross[1] + (f.lateral.z * left - f.forward.z * forward) * s.direction];
      assert.ok(painted(point), 'A prohibition X lost a diagonal arm.');
    }
  }
  const hours = east.legends[0], outbound = east.symbols!.find(s => s.direction === -1)!;
  assert.equal(hours.direction, -1); assert.equal(hours.laneFraction, outbound.laneFraction);
  assert.ok(hours.distanceMetres < outbound.distanceMetres - 11, '8–20 precedes the outbound X, away from the U arrow.');
});

test('reference approach guides and coral surfaces keep their distinct crossing setbacks', () => {
  const approaches = SHIBUYA_ROAD_DATA.markingInterpretation.approaches;
  const north = approaches.find(a => a.id === 'jingu')!, east = approaches.find(a => a.id === 'station-east')!;
  assert.equal(north.stopMetres, 0); assert.equal(east.stopMetres, -4);
  assert.deepEqual(north.guides!.filter(g => g.dashed).map(g => g.laneFraction), [-.5],
    'The north outbound coral lane has a broken divider for the full approach.');
  assert.ok(north.guides!.filter(g => !g.dashed).every(g => g.startMetres < north.stopMetres));
  assert.ok(east.guides!.every(g => !g.dashed));
  assert.ok(east.guides!.filter(g => g.laneFraction !== east.medianFraction).every(g => g.startMetres === east.stopMetres),
    'East inbound guides begin at the stop bar, leaving the crossing throat clear.');
  for (const approach of [north, east]) {
    assert.ok(approach.colourAreas.filter(c => c.kind === 'coloured-curb-lane')
      .every(c => c.startMetres < approach.stopMetres), 'Coral must reach back to the zebra, not start behind the stop bar.');
  }
});

test('the two underpass side roads retain straight unobstructed access corridors', () => {
  for (const [east, slope, halfWidth] of [[48.2, -.043, 2.25], [80.15, -.012, 1.95]]) {
    for (let south = -24; south <= 2; south += 1) for (const offset of [-halfWidth, 0, halfWidth]) {
      const p = citySurveyPoint(east + slope * south + offset, south);
      assert.ok(cityOnCarriageway(p.x, p.z), 'A sidewalk extension bends or pinches a side-road access route.');
    }
  }
});

test('west and south alleys stay open across the main-road sidewalk extensions', () => {
  for (let south = 0; south <= 12; south += .5) for (const offset of [-1.6, 0, 1.6]) {
    const p = citySurveyPoint(-67.4 - south * 3.4 / 12 + offset, south);
    assert.ok(cityOnCarriageway(p.x, p.z), 'The west alley has a blocked or pinched driveway.');
  }
  for (let east = -50; east <= -25; east += .5) for (const offset of [-1.6, 0, 1.6]) {
    const p = citySurveyPoint(east, 54.5 + (east + 60) * 8.4 / 38 + offset);
    assert.ok(cityOnCarriageway(p.x, p.z), 'The south alley is distorted by the sidewalk extension.');
  }
});

test('east-road guides continue through the viaduct without bending into side streets', () => {
  const east = SHIBUYA_ROAD_DATA.markingInterpretation.approaches.find(a => a.id === 'station-east')!;
  const frame = cityStreetFrame('station-east', 0);
  const along = ([x, z]: number[]) => (x - frame.position.x / roadMetres(1)) * frame.forward.x
    + (z - frame.position.z / roadMetres(1)) * frame.forward.z;
  const lateral = ([x, z]: number[]) => x * frame.lateral.x + z * frame.lateral.z;
  const bridge = along([SHIBUYA_STATION.center.x / roadMetres(1), SHIBUYA_STATION.center.z / roadMetres(1)]);
  const paper = SHIBUYA_ROAD_MARKINGS.find(m => m.role === 'paper')!.polygons;
  const guides = east.guides!.map(g => {
    assert.ok('paths' in g && Array.isArray(g.paths));
    return { ...g, points: (g.paths as number[][][])[0] };
  });
  for (const guide of guides) {
    assert.ok(guide.startMetres < bridge - 8 && guide.endMetres > bridge + 12,
      'Every guide must continue beyond both sides of the railway deck.');
    const section = guide.points.filter(p => along(p) >= 20 && along(p) <= 47);
    const first = section[0], last = section.at(-1)!;
    for (const p of section) {
      const t = (along(p) - along(first)) / (along(last) - along(first));
      const deviation = lateral(p) - (lateral(first) + (lateral(last) - lateral(first)) * t);
      assert.ok(Math.abs(deviation) < .5, 'A side-street mouth pulled a through lane sideways.');
    }
    for (let i = 1; i < guide.points.length; i++) {
      const a = guide.points[i - 1], b = guide.points[i], distance = along(b);
      if (distance < 0 || distance > 65) continue;
      const p = { x: roadMetres((a[0] + b[0]) / 2), z: roadMetres((a[1] + b[1]) / 2) };
      assert.ok(paper.some(polygon => cityPointInPolygon(p, polygon)), 'The underpass divider has a missing painted segment.');
    }
  }
  for (const distance of [5, 20, 35, 50, 60]) {
    const offsets = guides.map(g => lateral(g.points.find(p => Math.abs(along(p) - distance) < .01)!));
    const first = offsets[1] - offsets[0], second = offsets[2] - offsets[1];
    assert.ok(first > 2.4 && first < 3.5 && Math.abs(first - second) < .01,
      'Keep the incoming lanes equally spaced through the bridge approach.');
  }
});

test('all four vehicle approaches have opposing-curb signal pairs; the scramble stays pedestrian-only', () => {
  assert.equal(SHIBUYA_STREET_SIGNALS.length, 10);
  const overhead = SHIBUYA_STREET_SIGNALS.filter(s => s.vehicle);
  assert.equal(overhead.length, 8);
  assert.equal(overhead.filter(s => s.vehicle!.movingApproach).length, 4);
  assert.deepEqual(SHIBUYA_STREET_SIGNALS.map(s => s.position), SHIBUYA_SIGNAL_POSITIONS,
    'Pairing must preserve the shared pavement anchors and pedestrian approaches.');
  for (const crossing of SHIBUYA_CROSSWALKS) {
    const pair = SHIBUYA_STREET_SIGNALS.filter(s => s.crossing === crossing.id);
    assert.equal(pair.length, 2);
    if (crossing.id === 'scramble') {
      assert.ok(pair.every(s => !s.vehicle));
      continue;
    }
    const frame = cityStreetFrame(crossing.id, 0);
    assert.deepEqual(pair.map(s => s.vehicle!.curbSide).sort(), ['incoming', 'outgoing']);
    for (const signal of pair) {
      const { facing, armDirection, curbSide } = signal.vehicle!;
      const side = curbSide === 'incoming' ? 1 : -1;
      const lateral = (signal.position.x - frame.position.x) * frame.lateral.x
        + (signal.position.z - frame.position.z) * frame.lateral.z;
      assert.ok(lateral * side > roadMetres(SHIBUYA_SIGNAL_DIMENSIONS.mastReach),
        `${signal.id}: each mast must stay above its own half of the approach.`);
      assert.ok(Math.abs(facing.x * frame.forward.x + facing.z * frame.forward.z - side) < 1e-8,
        `${signal.id}: the face must look toward its approaching traffic.`);
      assert.ok(Math.abs(armDirection.x * frame.lateral.x + armDirection.z * frame.lateral.z + side) < 1e-8,
        `${signal.id}: the paired cantilever must bend into the road, not over the sidewalk.`);
    }
  }
  assert.ok(SHIBUYA_STREET_SIGNALS.every(s => s.crossing !== 'center-gai'));
});

test('uprights fit the surveyed pavement and all eight overhead heads extend above the road', () => {
  for (const signal of SHIBUYA_STREET_SIGNALS) {
    assert.ok(cityPavementFixtureFits(signal.position, .30));
    assert.equal(isCityStreetApproachClear(signal.position.x, signal.position.z), false);
    const f = signal.pedestrianFacing;
    assert.ok(Math.abs(Math.hypot(f.x, f.z) - 1) < 1e-8);
    if (signal.vehicle) {
      const { armDirection: d } = signal.vehicle;
      assert.ok(cityOnCarriageway(signal.position.x + d.x * roadMetres(SHIBUYA_SIGNAL_DIMENSIONS.mastReach),
        signal.position.z + d.z * roadMetres(SHIBUYA_SIGNAL_DIMENSIONS.mastReach)), 'The overhead head must extend over its approach.');
    }
  }
  for (const p of SHIBUYA_STREET_LANTERNS) assert.ok(cityPavementFixtureFits(p, .20));
  for (const rail of SHIBUYA_GUARDRAILS) for (let t = 0; t <= 1; t += .1) {
    const p = { x: rail.start.x + (rail.end.x - rail.start.x) * t, z: rail.start.z + (rail.end.z - rail.start.z) * t };
    assert.ok(cityPavementFixtureFits(p, .12));
    assert.equal(isCityStreetApproachClear(p.x, p.z), false);
  }
  const entrance = SHIBUYA_CENTER_GAI_ENTRANCE;
  assert.equal(entrance.posts.length, 2);
  assert.ok(entrance.clearWidthMetres > 5 && entrance.heightMetres < 7);
  for (const p of entrance.posts) assert.ok(cityPavementFixtureFits(p, .36));
});

test('detailed fixtures stay palette-derived, bounded, and in two small static batches', () => {
  const street = createShibuyaStreetFurniture(), approved: string[] = Object.values(P);
  const bases = approved.map(c => new Color(c)), ink = new Color(P.ink);
  assert.ok(street.geometry.userData.authoredSwatches.every((c: string) => approved.includes(c)));
  const colors = street.geometry.getAttribute('color');
  for (let i = 0; i < colors.count; i++) {
    const pixel = [colors.getX(i), colors.getY(i), colors.getZ(i)];
    assert.ok(bases.some(base => {
      const rgb = [base.r, base.g, base.b], shadow = [ink.r, ink.g, ink.b];
      const channel = rgb.findIndex((v, k) => Math.abs(shadow[k] - v) > .001);
      const mix = channel === -1 ? 0 : (pixel[channel] - rgb[channel]) / (shadow[channel] - rgb[channel]);
      return mix >= -.00001 && mix <= .34001 && rgb.every((v, k) => Math.abs(pixel[k] - (v + (shadow[k] - v) * mix)) < .00001);
    }), 'Fixture shading must blend approved swatches only.');
  }
  assert.ok(street.geometry.getAttribute('position').count / 3 < 25000);
  assert.ok(street.lightGeometry.getAttribute('position').count / 3 < 2500);
  for (const aspect of ['vehicle-go', 'vehicle-amber', 'vehicle-stop']) {
    const lenses = street.lightRanges.filter(r => r.aspect === aspect);
    assert.equal(lenses.length, 8, 'The rendered mesh must contain both heads of every approach pair.');
    assert.equal(lenses.filter(r => r.movingApproach).length, 4);
  }
  for (const geometry of [street.geometry, street.lightGeometry]) {
    const bounds = geometry.boundingBox!;
    assert.ok(bounds.min.y >= CITY_PAVEMENT_HEIGHT - 1e-8);
    assert.ok(bounds.max.y < CITY_PAVEMENT_HEIGHT + roadMetres(7));
    assert.ok(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.min.z), Math.abs(bounds.max.x), Math.abs(bounds.max.z)) < .495);
    geometry.dispose();
  }
});

test('walk, all-red clearance, drive and amber are mutually exclusive; uploads happen only on phase changes', () => {
  const street = createShibuyaStreetFurniture(), colors = street.lightGeometry.getAttribute('color') as BufferAttribute;
  for (const [time, phase] of [[4, 'walk'], [11, 'clearance'], [13, 'drive'], [19.5, 'amber'], [20, 'walk']] as const) {
    street.setTime(time); assert.equal(cityStreetSignalPhase(time), phase);
    for (const range of street.lightRanges) {
      const color = '#' + new Color(colors.getX(range.start), colors.getY(range.start), colors.getZ(range.start)).getHexString();
      const go = range.movingApproach && phase === 'drive', amber = range.movingApproach && phase === 'amber';
      const expected = range.aspect === 'walk' ? (phase === 'walk' ? P.signalGo : P.ink)
        : range.aspect === 'dont-walk' ? (phase !== 'walk' ? P.coral : P.ink)
        : range.aspect === 'vehicle-go' ? (go ? P.signalGo : P.ink)
        : range.aspect === 'vehicle-amber' ? (amber ? P.warmLight : P.ink) : (!go && !amber ? P.coral : P.ink);
      assert.equal(color, expected);
    }
    const version = colors.version; street.setTime(time + .05); assert.equal(colors.version, version);
  }
  street.geometry.dispose(); street.lightGeometry.dispose();
});

test('street fixtures and signal lights use the city material for their morph', () => {
  const scene = Object.create(ShibuyaScene.prototype);
  // This prototype-only fixture skips the constructor and canvas sign painter;
  // street-life construction also registers worksite panels now.
  Object.assign(scene, { city: new Group(), boxes: [], transitPanels: [], sign: () => {},
    staticMaterial: new MeshBasicMaterial({ vertexColors: true }) });
  scene.buildStreetLife();
  const fixtures = scene.city.getObjectByName('shibuya-shared-street-furniture') as Mesh;
  const lights = scene.city.getObjectByName('shibuya-oriented-signal-lights') as Mesh;
  assert.ok(fixtures && lights);
  assert.equal(fixtures.material, scene.staticMaterial); assert.equal(lights.material, scene.staticMaterial);
  scene.city.traverse((o: Mesh) => o.geometry?.dispose()); scene.staticMaterial.dispose();
});
