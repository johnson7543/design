import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { Mesh, Vector3 } from 'three';
import { HACHIKO_GARDEN_BEDS, HACHIKO_MONUMENT, HACHIKO_OBSTACLES, isHachikoApproachClear } from '../src/designs/city/hachiko-layout.ts';
import { HACHIKO_SCULPTURE_DATA as sculpture } from '../src/designs/city/hachiko-sculpture-data.ts';
import { createHachikoSquareGeometry } from '../src/designs/city/hachiko-square.ts';
import { CITY_BUILDING_PARCELS, createCityBuildings } from '../src/designs/city/layout.ts';
import { createCityPedestrians, pedestrianPose } from '../src/designs/city/motion.ts';
import { CITY_PAVEMENT_HEIGHT, SHIBUYA_CARRIAGEWAYS, SHIBUYA_LAND, cityPolygonsOverlap, citySurfaceDistance, citySurveyPoint } from '../src/designs/city/road-network.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';

test('Hachiko remains south of the crossing, west of the station, facing geographic east', () => {
  const { position, yaw, referencePoint: { latitude, longitude } } = HACHIKO_MONUMENT;
  // Map point in the supplied location reference, independent of camera yaw.
  assert.ok(Math.abs(latitude - 35.659044) < .000002 && Math.abs(longitude - 139.700592) < .000002);
  const east = (position.x + position.z) / Math.SQRT2 * 160;
  const south = (position.z - position.x) / Math.SQRT2 * 160;
  assert.ok(east > -3 && east < 0 && south > 48 && south < 53);
  const curbDistance = -citySurfaceDistance(position.x, position.z, SHIBUYA_CARRIAGEWAYS) * 160;
  assert.ok(curbDistance > 7 && curbDistance < 8.5,
    'The fitted road must leave Hachiko near the western curb, with the garden behind it.');
  for (const bed of HACHIKO_GARDEN_BEDS) {
    const gap = Math.min(...bed.rings[0].map(p => -citySurfaceDistance(p.x, p.z, SHIBUYA_CARRIAGEWAYS) * 160));
    assert.ok(gap > 1 && gap < 2.5, 'Move the planted pockets with the monument while keeping a clear curbside path.');
  }
  const face = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), yaw);
  const geographicEast = citySurveyPoint(1, 0);
  assert.ok(face.dot(new Vector3(geographicEast.x, 0, geographicEast.z).normalize()) > .999999);
  const entrance = createCityBuildings([[true]]).find(b => b.kind === 'station-front')!;
  assert.ok(face.dot(new Vector3(entrance.x - position.x, 0, entrance.z - position.z).normalize()) > .85);
});

test('the original Blender sculpture is current, bounded, and has a tail behind two separated front paws', () => {
  const script = readFileSync(new URL('../../../scripts/blender/build-hachiko-sculpture.py', import.meta.url));
  assert.equal(sculpture.authoringSha256, createHash('sha256').update(script).digest('hex'));
  assert.ok(statSync(new URL('../../../assets/design-qr/shibuya/hachiko-sculpture.blend', import.meta.url)).size > 1000);
  assert.ok(sculpture.indices.length / 3 < 7500 && sculpture.indices.length % 3 === 0);
  assert.equal(sculpture.faceRoles.length, sculpture.indices.length / 3);
  assert.ok(sculpture.faceRoles.every(role => role === 0 || role === 1));
  const points = Array.from({ length: sculpture.positions.length / 3 }, (_, i) =>
    new Vector3().fromArray(sculpture.positions, i * 3).divideScalar(sculpture.unitsPerMetre));
  assert.ok(sculpture.indices.every(i => Number.isInteger(i) && i >= 0 && i < points.length));
  assert.ok(points.every(p => Number.isFinite(p.length()) && p.y >= -.015 && p.y <= 1.22));
  const foot = points.filter(p => p.y < .065 && p.z > .23);
  assert.ok(foot.some(p => p.x < -.08) && foot.some(p => p.x > .08));
  assert.ok(!foot.some(p => Math.abs(p.x) < .04), 'Front paws must not fuse into one column.');
  assert.ok(points.some(p => p.z < -.80 && p.y < .09), 'The tail should rest behind the haunches, not curl over the back.');
  assert.ok(points.some(p => p.z > .40 && p.y > .90), 'The muzzle must point forward.');
});

test('the complete plaza geometry stays on land and clear of the station, roads and building envelopes', () => {
  for (const obstacle of HACHIKO_OBSTACLES) {
    assert.ok(SHIBUYA_CARRIAGEWAYS.every(road => !cityPolygonsOverlap(road, obstacle)));
    assert.ok(CITY_BUILDING_PARCELS.every(building => !cityPolygonsOverlap(building, obstacle)));
  }
  const geometry = createHachikoSquareGeometry(), positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  try {
    assert.ok(positions.count / 3 < 26000, 'The static plaza and station planting exceeded their miniature triangle budget.');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      assert.ok(citySurfaceDistance(x, z, SHIBUYA_LAND) >= -1e-6, 'A rendered plaza vertex enters the carriageway.');
      assert.ok(citySurfaceDistance(x, z, CITY_BUILDING_PARCELS) < 0, 'A rendered plaza vertex enters a building.');
      assert.ok(positions.getY(i) >= CITY_PAVEMENT_HEIGHT - .0002);
      for (const c of [colors.getX(i), colors.getY(i), colors.getZ(i)]) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1);
    }
    // A clear station-facing photo approach, with solid pedestal/planting exclusion.
    const { eastMetres: e, southMetres: s, position } = HACHIKO_MONUMENT;
    assert.equal(isHachikoApproachClear(position.x, position.z), false);
    for (const distance of [2, 4, 8, 15, 25]) {
      const p = citySurveyPoint(e + distance, s);
      assert.ok(isHachikoApproachClear(p.x, p.z));
    }
  } finally { geometry.dispose(); }
});

test('commuters keep clear of Hachiko and the planted seating pockets throughout their crossing cycle', () => {
  const buildings = createCityBuildings(generateQRMatrix('Hachiko / Shibuya', 'H').modules);
  for (const seed of [0, .5, 1]) for (const person of createCityPedestrians(seed, buildings)) {
    for (let time = 0; time < 40; time += .4) {
      const pose = pedestrianPose(person, time);
      assert.ok(isHachikoApproachClear(pose.x, pose.z, .002));
    }
  }
});

test('Hachiko keeps per-player resources and follows the city morph when asset loading fails', async () => {
  const { ShibuyaScene } = await import('../src/renderer/webgl/ShibuyaScene.ts');
  const { DESIGN_QR_THEME_PRESETS } = await import('../src/designs/tree/themes.ts');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const context = new Proxy({ measureText: (text: string) => ({ width: text.length * 10 }) }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => context }) } });
  const scenes: InstanceType<typeof ShibuyaScene>[] = [];
  try {
    const modules = generateQRMatrix('Hachiko', 'H').modules;
    for (let i = 0; i < 2; i++) {
      const scene = new ShibuyaScene(modules, DESIGN_QR_THEME_PRESETS.shibuya, () => Promise.reject(new Error('Offline fixture')));
      scenes.push(scene);
      const square = scene.root.getObjectByName('shibuya-hachiko-square') as Mesh;
      assert.ok(square?.geometry && square.parent?.visible);
      for (const progress of [0, .1, .5, 1]) scene.update(progress, 0, true);
      assert.equal(square.parent!.visible, false);
      scene.update(0, 0, true);
      assert.equal(square.parent!.visible, true);
    }
    await Promise.resolve(); await Promise.resolve();
    assert.equal(scenes[1].assetStatus, 'error');
    const a = scenes[0].root.getObjectByName('shibuya-hachiko-square') as Mesh;
    const b = scenes[1].root.getObjectByName('shibuya-hachiko-square') as Mesh;
    assert.deepEqual(a.geometry.getAttribute('position').array, b.geometry.getAttribute('position').array);
    assert.notEqual(a.geometry, b.geometry, 'Each player must own its resources.');
  } finally {
    for (const scene of scenes) {
      scene.dispose();
      const materials = new Set();
      scene.root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!materials.has(material)) { materials.add(material); material.map?.dispose(); material.dispose(); }
        }
      });
    }
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});
