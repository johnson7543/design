import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Group, Mesh, MeshBasicMaterial } from 'three';
import { SHIBUYA_ROAD_DATA } from '../src/designs/city/road-data.ts';
import { createShibuyaRoadGeometry } from '../src/designs/city/road-mesh.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_PERSON_SCALE, CITY_ROAD_HEIGHT, CITY_VEHICLE_SCALE,
  SHIBUYA_BUILDABLE_LAND, SHIBUYA_CARRIAGEWAYS, SHIBUYA_CROSSWALKS, SHIBUYA_LAND, SHIBUYA_PAVEMENTS,
  SHIBUYA_ROAD_ARMS, SHIBUYA_ROAD_METRES, SHIBUYA_SIGNAL_POSITIONS, cityOnCarriageway,
  cityPointInPolygon, citySurfaceContainsBounds, citySurfaceDistance, citySurveyPoint } from '../src/designs/city/road-network.ts';
import { SHIBUYA_PALETTE as P } from '../src/designs/city/palette.ts';
import { ShibuyaScene } from '../src/renderer/webgl/ShibuyaScene.ts';
import { SHIBUYA_STREET_TREES } from '../src/designs/city/layout.ts';
import { cityStreetFrame } from '../src/designs/city/street-layout.ts';

test('the five-arm road retains official source provenance and one undistorted metric scale', () => {
  const source = SHIBUYA_ROAD_DATA.provenance;
  assert.equal(source.dataset, 'plateau-13113-shibuya-ku-2025');
  assert.equal(source.sourceCrs, 'EPSG:6697'); assert.equal(source.horizontalCrs, 'EPSG:6677');
  assert.ok(source.roads.some(r => r.id === 'tran_f2a5948b-23c4-4932-83a2-a5c3591bf06c' && r.lod === 3));
  assert.equal(Object.keys(source.sourceSha256).length, 2);
  assert.equal(SHIBUYA_ROAD_ARMS.length, 5); assert.equal(SHIBUYA_CROSSWALKS.length, 5);
  assert.equal(SHIBUYA_ROAD_ARMS.find(a => a.id === 'center-gai')!.lanes, 2);
  assert.ok(SHIBUYA_CARRIAGEWAYS.flatMap(p => p.rings.flat()).length > 150, 'The surveyed curves were replaced with a rectangular cross.');
  const origin = citySurveyPoint(0, 0), east = citySurveyPoint(10, 0), north = citySurveyPoint(0, -10);
  for (const p of [east, north]) assert.ok(Math.abs(Math.hypot(p.x - origin.x, p.z - origin.z) * SHIBUYA_ROAD_METRES - 10) < 1e-9);
  assert.ok(Math.abs(east.x * north.x + east.z * north.z) < 1e-9, 'Independent X/Z scaling distorted the survey.');
  assert.ok(Math.abs((CITY_PAVEMENT_HEIGHT - CITY_ROAD_HEIGHT) * SHIBUYA_ROAD_METRES - .15) < 1e-9);
  assert.ok(Math.abs(.023 * CITY_VEHICLE_SCALE * SHIBUYA_ROAD_METRES - 2.5) < 1e-9);
  assert.ok(Math.abs(.019 * CITY_PERSON_SCALE * SHIBUYA_ROAD_METRES - 1.75) < 1e-9);
  const sourceLengths = SHIBUYA_ROAD_DATA.crossings.map(c => Math.hypot(c.end[0] - c.start[0], c.end[1] - c.start[1]));
  [15.17, 17.44, 28.90, 16.60, 32.22].forEach((expected, i) => assert.ok(Math.abs(sourceLengths[i] - expected) < .02));
  const lengths = SHIBUYA_CROSSWALKS.map(r => r.length * SHIBUYA_ROAD_METRES);
  [14.86, 16.32, 22.99, 16.60, 32.22].forEach((expected, i) => assert.ok(Math.abs(lengths[i] - expected) < .02));
  for (const cross of SHIBUYA_CROSSWALKS) for (let t = .01; t < 1; t += .01) {
    assert.ok(cityOnCarriageway(cross.start.x + (cross.end.x - cross.start.x) * t, cross.start.z + (cross.end.z - cross.start.z) * t));
  }
});

test('main-road widths share a consistent scale while the south taper and shopping street retain their proportions', () => {
  const widthAt = (arm: string, distance: number, straight = false) => {
    const frame = cityStreetFrame(arm, straight ? 0 : distance);
    const onRoad = (offset: number) => cityOnCarriageway(
      frame.position.x + (frame.lateral.x * offset + (straight ? frame.forward.x * distance : 0)) / SHIBUYA_ROAD_METRES,
      frame.position.z + (frame.lateral.z * offset + (straight ? frame.forward.z * distance : 0)) / SHIBUYA_ROAD_METRES);
    assert.ok(onRoad(0), `${arm} lost its through corridor at ${distance} m.`);
    const edges = [-1, 1].map(side => {
      let offset = 0;
      while (offset < 35 && onRoad(side * (offset + .025))) offset += .025;
      return offset;
    });
    return edges[0] + edges[1];
  };
  for (const arm of ['jingu', 'dogenzaka']) for (const distance of [0, 10, 20, 30, 40, 50]) {
    // Measure beside the reopened west driveway, not through its side mouth.
    const width = widthAt(arm, arm === 'dogenzaka' && distance === 30 ? 35 : distance);
    assert.ok(width >= 14.2 && width <= 15.1, `${arm} is ${width} m wide at ${distance} m.`);
  }
  for (const [distance, expected] of [[0, 23.1], [10, 21.9], [20, 19.6], [30, 18.0], [45, 17.9], [50, 17.9]]) {
    const width = widthAt('hachiko', distance, true);
    assert.ok(Math.abs(width - expected) < .15,
      `South carriageway is ${width} m at ${distance} m; its bay and taper must sit outside four normal-width lanes.`);
  }
  for (const distance of [0, 5, 10, 20, 30, 40]) {
    const width = widthAt('center-gai', distance);
    assert.ok(width >= 3.9 && width <= 4.8, `Keep the ${width} m shopping street open without widening it into an arterial.`);
  }
});

test('full-footprint zoning rejects concave edge incursions even when all four corners fit', () => {
  const p = { rings: [[{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 5 }, { x: 3, z: 5 },
    { x: 3, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 5 }, { x: 0, z: 5 }]], bounds: { minX: 0, maxX: 5, minZ: 0, maxZ: 5 } };
  for (const x of [1, 4]) for (const z of [1, 4]) assert.ok(cityPointInPolygon({ x, z }, p));
  assert.equal(citySurfaceContainsBounds([p], { minX: 1, maxX: 4, minZ: 1, maxZ: 4 }), false);
  assert.ok(SHIBUYA_BUILDABLE_LAND.length > 0);
  for (const p of SHIBUYA_SIGNAL_POSITIONS) assert.ok(citySurfaceContainsBounds(SHIBUYA_PAVEMENTS,
    { minX: p.x - .002, maxX: p.x + .002, minZ: p.z - .002, maxZ: p.z + .002 }));
  for (const p of SHIBUYA_STREET_TREES) assert.ok(citySurfaceContainsBounds(SHIBUYA_LAND,
    { minX: p.x - .01, maxX: p.x + .01, minZ: p.z - .009, maxZ: p.z + .009 }));
});

test('the east underpass has a compact physical carriageway and connected pavement extensions', () => {
  const frame = cityStreetFrame('station-east', 0);
  const at = (distance: number, offset: number) => ({
    x: frame.position.x + (frame.forward.x * distance + frame.lateral.x * offset) / SHIBUYA_ROAD_METRES,
    z: frame.position.z + (frame.forward.z * distance + frame.lateral.z * offset) / SHIBUYA_ROAD_METRES,
  });
  for (const distance of [12, 25, 30, 35, 40, 45]) {
    const offsets = Array.from({ length: 1201 }, (_, i) => -20 + i * .025).filter(offset => {
      const p = at(distance, offset); return cityOnCarriageway(p.x, p.z);
    });
    const width = offsets.at(-1)! - offsets[0];
    assert.ok(width > 13.9 && width < 14.1, `East road at ${distance} m is ${width} m wide; moving only the paint leaves excess asphalt.`);
    const sidewalk = at(distance, offsets[0] - .6);
    assert.ok(citySurfaceDistance(sidewalk.x, sidewalk.z, SHIBUYA_PAVEMENTS) > .3 / SHIBUYA_ROAD_METRES);
    assert.ok(citySurfaceDistance(sidewalk.x, sidewalk.z, SHIBUYA_LAND) > .3 / SHIBUYA_ROAD_METRES);
  }
  for (const distance of [18, 49]) for (const offset of [-22, -16, -9]) {
    const p = at(distance, offset);
    assert.ok(cityOnCarriageway(p.x, p.z), 'Pavement must not seal either north-side street mouth.');
  }

  const prepare = (raw: number[][][][]) => raw.map(polygon => {
    const rings = polygon.map(ring => ring.map(([x, z]) => ({ x: x / SHIBUYA_ROAD_METRES, z: z / SHIBUYA_ROAD_METRES })));
    return { rings, bounds: { minX: Math.min(...rings[0].map(p => p.x)), maxX: Math.max(...rings[0].map(p => p.x)),
      minZ: Math.min(...rings[0].map(p => p.z)), maxZ: Math.max(...rings[0].map(p => p.z)) } };
  });
  const sourceRoad = prepare(SHIBUYA_ROAD_DATA.carriageways), sourceLand = prepare(SHIBUYA_ROAD_DATA.land);
  const additions = prepare(SHIBUYA_ROAD_DATA.surfaceLayout.pavementExtensions);
  const aprons = prepare(SHIBUYA_ROAD_DATA.surfaceLayout.alleyAprons);
  for (let x = -78.37; x < 79; x += 2) for (let z = -78.19; z < 79; z += 2) {
    const p = { x: x / SHIBUYA_ROAD_METRES, z: z / SHIBUYA_ROAD_METRES };
    const added = additions.some(polygon => cityPointInPolygon(p, polygon));
    const apron = aprons.some(polygon => cityPointInPolygon(p, polygon));
    assert.equal(cityOnCarriageway(p.x, p.z), (sourceRoad.some(polygon => cityPointInPolygon(p, polygon)) && !added) || apron,
      'The compiled road must match the documented pavement extensions and alley aprons.');
    assert.equal(SHIBUYA_LAND.some(polygon => cityPointInPolygon(p, polygon)), (sourceLand.some(polygon => cityPointInPolygon(p, polygon)) || added) && !apron,
      'Pavement and road occupancy must share the same boundary without gaps or overlaps.');
  }
});

test('the road foundation stays within the tile and uses only approved palette colors', () => {
  const geometry = createShibuyaRoadGeometry();
  const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  const approved = new Set<string>(Object.values(P));
  for (let i = 0; i < positions.count; i++) {
    assert.ok(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i)));
    assert.ok(Math.abs(positions.getX(i)) <= .49501 && Math.abs(positions.getZ(i)) <= .49501);
    const hex = '#' + new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString();
    assert.ok(approved.has(hex), `Road mesh introduced an off-palette colour ${hex}.`);
  }
  const morning = geometry.getAttribute('cityMorning');
  assert.equal(morning.count, positions.count);
  assert.deepEqual(new Set(morning.array), new Set([0, 1]));
  assert.equal(geometry.groups.length, 2);
  const [carriageway, pavement] = geometry.groups;
  assert.equal(carriageway.start + carriageway.count, pavement.start);
  assert.equal(pavement.start + pavement.count, positions.count);
  for (let i = carriageway.start; i < carriageway.count; i++) {
    assert.ok(positions.getY(i) < CITY_PAVEMENT_HEIGHT, 'Depth offset must stay below pavement/garden details.');
  }
  const scene = Object.create(ShibuyaScene.prototype);
  Object.assign(scene, { city: new Group(), boxes: [], signMaterials: new Set(), staticMaterial: new MeshBasicMaterial() });
  scene.buildStreets();
  const road = scene.city.getObjectByName('shibuya-surveyed-road-foundation') as Mesh;
  assert.ok(road);
  assert.deepEqual(road.geometry.getAttribute('position').array, positions.array);
  road.geometry.dispose(); (road.material as MeshBasicMaterial[])[0].dispose(); scene.staticMaterial.dispose();
  geometry.dispose();
});
