import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { CITY_BUILDING_PARCELS, createCityBuildings } from '../src/designs/city/layout.ts';
import { cityBuildingPanels, cityPanelAnchor, createCityArchitectureGeometry } from '../src/designs/city/architecture.ts';
import { cityStationFrontageFrame, SHIBUYA_POLICE_BOX } from '../src/designs/city/station-frontage-layout.ts';
import { createCityPedestrians, pedestrianPose } from '../src/designs/city/motion.ts';
import { createShibuyaStationGeometry } from '../src/designs/city/station-geometry.ts';
import { createShibuyaPlinthGeometry, createShibuyaRoadGeometry } from '../src/designs/city/road-mesh.ts';
import { SHIBUYA_STAIR_WELLS, SHIBUYA_SUBWAY_ENTRANCES, citySubwayFootprint, citySubwayPoint,
  isCitySubwayApproachClear } from '../src/designs/city/station-layout.ts';
import { CITY_PAVEMENT_HEIGHT, SHIBUYA_CARRIAGEWAYS, SHIBUYA_LAND, SHIBUYA_PAVEMENTS,
  cityPointInPolygon, cityPolygonsOverlap, citySurfaceDistance, roadMetres } from '../src/designs/city/road-network.ts';
import { SHIBUYA_STREET_SIGNALS } from '../src/designs/city/street-layout.ts';
import { SHIBUYA_PALETTE } from '../src/designs/city/palette.ts';

test('A6a/A6b flank Center-Gai and A7a sits beside MAGNET, with complete sidewalk footprints', () => {
  assert.deepEqual(SHIBUYA_SUBWAY_ENTRANCES.map(e => e.id), ['A6a', 'A6b', 'A7a']);
  const [a, b, c] = SHIBUYA_SUBWAY_ENTRANCES;
  assert.ok(a.east < -28 && b.east > -12 && b.east < -4 && c.east > 17);
  assert.ok(a.south < -16 && b.south < -19 && c.south < -7);
  for (const e of SHIBUYA_SUBWAY_ENTRANCES) {
    const footprint = citySubwayFootprint(e, .15);
    assert.ok(SHIBUYA_CARRIAGEWAYS.every(road => !cityPolygonsOverlap(road, footprint)));
    assert.ok(CITY_BUILDING_PARCELS.every(building => !cityPolygonsOverlap(building, footprint)));
    assert.ok(SHIBUYA_STREET_SIGNALS.every(s => !cityPointInPolygon(s.position, footprint)));
    for (const p of footprint.rings[0]) assert.ok(citySurfaceDistance(p.x, p.z, SHIBUYA_PAVEMENTS) > 0);
    const front = citySubwayPoint(e, 0, e.length / 2), rear = citySubwayPoint(e, 0, -e.length / 2);
    assert.ok(Math.abs(Math.hypot(front.x - rear.x, front.z - rear.z) / roadMetres(1) - e.length) < 1e-9);
  }
});

test('stairs really descend through both ground layers and the railway leaves the road open', () => {
  const station = createShibuyaStationGeometry(), road = createShibuyaRoadGeometry(), plinth = createShibuyaPlinthGeometry();
  const material = new MeshBasicMaterial(), meshes = [road, plinth, station.geometry].map(g => new Mesh(g, material));
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  try {
    for (const [i, e] of SHIBUYA_SUBWAY_ENTRANCES.entries()) {
      assert.equal(SHIBUYA_STAIR_WELLS[i].length, 4);
      const sample = (depth: number) => {
        const p = citySubwayPoint(e, 0, depth);
        ray.set(new Vector3(p.x, CITY_PAVEMENT_HEIGHT + .0001, p.z), down);
        return ray.intersectObjects(meshes, false)[0]?.point.y;
      };
      const first = sample(e.length / 2 - .6), last = sample(-e.length / 2 + 1.0);
      assert.ok(first < CITY_PAVEMENT_HEIGHT - roadMetres(.14), `${e.id}: a ground surface filled the stair mouth.`);
      assert.ok(last < first - roadMetres(1.8), `${e.id}: steps do not descend into the ground.`);
      assert.ok(last > CITY_PAVEMENT_HEIGHT - roadMetres(2.9), `${e.id}: stair flight has no floor.`);
    }
    const positions = station.geometry.getAttribute('position');
    assert.ok(positions.count / 3 < 16000);
    const palette = new Set<string>(Object.values(SHIBUYA_PALETTE));
    assert.ok(station.geometry.userData.authoredSwatches.every((c: string) => palette.has(c)));
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      assert.ok(Number.isFinite(x + y + z) && Math.max(Math.abs(x), Math.abs(z)) < .5);
      if (y < CITY_PAVEMENT_HEIGHT + roadMetres(4.8)) assert.ok(citySurfaceDistance(x, z, SHIBUYA_LAND) >= -1e-6,
        'A low transit structure or bridge pier obstructs the road.');
    }
    assert.equal(station.panels.filter(p => p.transit === 'entrance').length, 6);
    const bridge = station.panels.find(p => p.transit === 'viaduct')!, normal = cityPanelAnchor(bridge);
    assert.ok(Math.sin(normal.angle) + Math.cos(normal.angle) < -1.4, 'JR lettering must face west toward the crossing.');
  } finally {
    for (const mesh of meshes) mesh.geometry.dispose(); station.glassGeometry.dispose(); material.dispose();
  }
});

test('the police box has a projecting curved balcony beside an open, taller JR entrance', () => {
  const b = createCityBuildings([[true]]).find(b => b.kind === 'station-front')!;
  const frame = cityStationFrontageFrame(b), geometry = createCityArchitectureGeometry([b]);
  const material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material), ray = new Raycaster();
  const point = (u: number, y: number, depth: number) => {
    const p = frame.point(u, depth); return new Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(y), p.z);
  };
  const depthAt = (u: number, y: number) => {
    const origin = point(u, y, -2), direction = point(u, y, 8).sub(origin).normalize();
    ray.set(origin, direction); const hit = ray.intersectObject(mesh, false)[0];
    assert.ok(hit, 'The facade must have a physical surface behind the entry.');
    return frame.local(hit.point).depth;
  };
  try {
    assert.ok(SHIBUYA_POLICE_BOX.height < b.height / roadMetres(1));
    assert.ok(depthAt(16.5, 1.7) > 6, 'A wall seals the main station entrance at street level.');
    assert.ok(depthAt(5.5, 1.7) > 1, 'The police doors must be recessed behind the balcony.');
    assert.ok(depthAt(5.5, 3.8) < -.15, 'The balcony needs a real projecting metal fascia.');
    assert.ok(depthAt(3.5, 3.8) > depthAt(5.5, 3.8) + .25, 'The balcony was flattened into a straight box.');
    assert.ok(depthAt(11, 9.3) < depthAt(10.5, 9.3) - .15, 'The JR sign needs raised letter bodies, not only a flat image.');
    const panels = cityBuildingPanels(b), police = panels.find(p => p.transit === 'police-name')!;
    const station = panels.find(p => p.transit === 'station-facade')!;
    const along = (p: typeof station) => frame.local(p.path[0]).u;
    assert.ok(along(police) < SHIBUYA_POLICE_BOX.width && along(station) > SHIBUYA_POLICE_BOX.width);
    for (const p of [police, station]) {
      const anchor = cityPanelAnchor(p);
      assert.ok(Math.sin(anchor.angle) + Math.cos(anchor.angle) < -1.3, 'The names must face Hachiko square to the west.');
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('both directions of the complete pedestrian cycle clear all three stair pavilions', () => {
  for (const seed of [0, .25, .5, .75, 1]) {
    const people = createCityPedestrians(seed, createCityBuildings([[true]]));
    for (const person of people) for (let t = 0; t < 40; t += .1) {
      const p = pedestrianPose(person, t);
      assert.ok(isCitySubwayApproachClear(p.x, p.z, .20), `Pedestrian ${person.index}, seed ${seed}, time ${t} enters a stair pavilion.`);
    }
  }
});
