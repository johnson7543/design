import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { Color, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareCityAssetLibrary, validateCityAssetManifest, type CityAssetLibrary } from '../src/designs/city/assetLoader.ts';
import { CityAssetInstances } from '../src/designs/city/assetInstances.ts';
import { createCityBuildings } from '../src/designs/city/layout.ts';
import { CITY_VEHICLES } from '../src/designs/city/vehicles.ts';
import { cityVehiclePosition, cityTrainPosition } from '../src/designs/city/motion.ts';
import { CITY_VEHICLE_SCALE, SHIBUYA_STATION, cityStationPoint, citySurfaceDistance } from '../src/designs/city/road-network.ts';
import { OSAKA_NIGHT_SWATCHES, SHIBUYA_PALETTE } from '../src/designs/city/palette.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';
import { DESIGN_QR_THEME_PRESETS } from '../src/designs/tree/themes.ts';
import { ShibuyaScene } from '../src/renderer/webgl/ShibuyaScene.ts';

const manifest = JSON.parse(readFileSync(new URL('../src/designs/city/assets/shibuya-manifest.json', import.meta.url), 'utf8'));
const bytes = readFileSync(new URL('../src/designs/city/assets/shibuya.glb', import.meta.url));
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const imported = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const library = prepareCityAssetLibrary(imported.scene, manifest);
const matrix = generateQRMatrix('https://example.com/shibuya', 'H').modules;
const buildings = createCityBuildings(matrix);

function dispose(root: Group) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if (!geometries.has(object.geometry)) { geometries.add(object.geometry); object.geometry.dispose(); }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!materials.has(material)) { materials.add(material); material.map?.dispose(); material.dispose(); }
    }
    if (object instanceof InstancedMesh) object.dispose();
  });
}

test('checked-in Blender source and complete GLB are self-contained and use only Osaka base colors', () => {
  assert.ok(statSync(new URL('../../../assets/design-qr/shibuya/shibuya-assets.blend', import.meta.url)).size > 1000);
  assert.ok(bytes.length < 1024 * 1024);
  assert.equal(library.assets.size, 9);
  const sourceSha = createHash('sha256').update(readFileSync(new URL('../src/designs/city/building-data.ts', import.meta.url))).digest('hex');
  const input = JSON.parse(readFileSync(new URL('../../../assets/design-qr/shibuya/landmark-meshes.json', import.meta.url), 'utf8'));
  assert.equal(input.sourceSha256, sourceSha, 'Prepared landmark input is stale.');
  for (const id of ['building-qfront', 'building-magnet']) {
    assert.equal(library.assets.get(id)!.metadata.sourceSha256, sourceSha, 'Regenerate Blender landmarks after a map update.');
  }
  assert.ok(!json.images?.length && !json.textures?.length && !json.animations?.length);
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    assert.equal(primitive.attributes.COLOR_0, undefined, 'Palette roles, not hidden vertex colors, must author GLB bases.');
    assert.ok(!primitive.targets?.length);
  }
  assert.ok(json.buffers.every((buffer: { uri?: string }) => !buffer.uri));
  assert.ok(!json.extensionsRequired?.length, 'The asset requires an external decoder.');
  const approved = new Set<string>(Object.values(OSAKA_NIGHT_SWATCHES));
  const used = new Set<string>();
  for (const material of json.materials) {
    const color = new Color().fromArray(material.pbrMetallicRoughness.baseColorFactor);
    const hex = '#' + color.getHexString(); used.add(hex);
    assert.ok(approved.has(hex), `Off-palette Blender base color ${hex}`);
    assert.equal(manifest.materials[material.name].swatch, hex);
  }
  assert.deepEqual(used, approved, 'Embedded source materials must retain their original authoring swatches.');
});

test('runtime material mapping recolors GLB instances without changing shared templates or another player', () => {
  const template = library.assets.get('building-qfront')!.geometry;
  assert.equal(template.getAttribute('color'), undefined, 'The shared cache must not bake in a runtime theme.');
  assert.ok(template.getAttribute('cityMaterialRole') && template.getAttribute('cityShade'));
  const first = new CityAssetInstances(library, buildings);
  const firstMesh = first.root.getObjectByName('shibuya-building-qfront') as Mesh;
  const firstColors = firstMesh.geometry.getAttribute('color').array.slice();
  const second = new CityAssetInstances(library, buildings, { ...SHIBUYA_PALETTE, glass: OSAKA_NIGHT_SWATCHES.blue, stone: OSAKA_NIGHT_SWATCHES.ivory });
  const secondMesh = second.root.getObjectByName('shibuya-building-qfront') as Mesh;
  assert.ok(secondMesh.geometry.getAttribute('color').array.some((value, i) => value !== firstColors[i]), 'The second palette must recolor its own glass.');
  assert.deepEqual(firstMesh.geometry.getAttribute('color').array, firstColors);
  assert.equal(template.getAttribute('color'), undefined);
  const third = new CityAssetInstances(library, buildings);
  const thirdMesh = third.root.getObjectByName('shibuya-building-qfront') as Mesh;
  assert.deepEqual(thirdMesh.geometry.getAttribute('color').array, firstColors);
  dispose(second.root); dispose(first.root); dispose(third.root);
});

test('manifest rejects missing assets, dimensions, anchors, palette changes and wrong morph proxies', () => {
  for (const mutate of [
    (m: typeof manifest) => { m.assets.pop(); },
    (m: typeof manifest) => { m.assets.find((a: { id: string }) => a.id === 'vehicle-bus').dimensions[2] = .5; },
    (m: typeof manifest) => { m.assets.find((a: { id: string }) => a.id === 'building-qfront').nodes = []; },
    (m: typeof manifest) => { Object.values<{ swatch: string }>(m.materials)[0].swatch = 'invalid'; },
    (m: typeof manifest) => { m.assets.find((a: { id: string }) => a.id === 'building-magnet').morphProxy = 'box'; },
  ]) {
    const broken = structuredClone(manifest); mutate(broken);
    assert.throws(() => validateCityAssetManifest(broken));
  }
  const missingNode = imported.scene.clone(); missingNode.getObjectByName('qfront-logo-anchor')!.name = 'renamed';
  assert.throws(() => prepareCityAssetLibrary(missingNode, manifest), /semantic City node/);
  const movedAnchor = imported.scene.clone(); movedAnchor.getObjectByName('qfront-logo-anchor')!.rotation.y += .5;
  assert.throws(() => prepareCityAssetLibrary(movedAnchor, manifest), /billboard anchor/);
});

test('source-aligned landmarks stay in their complete polygon envelopes', () => {
  for (const value of ['Shibuya', 'QR-content/' + 'dense/'.repeat(30)]) {
    const plots = createCityBuildings(generateQRMatrix(value, 'H').modules);
    const instances = new CityAssetInstances(library, plots);
    for (const [index, id] of ['building-qfront', 'building-magnet'].entries()) {
      const b = plots[index];
      const model = instances.root.getObjectByName('shibuya-' + id) as Mesh;
      model.updateMatrix();
      const positions = model.geometry.getAttribute('position'), point = new Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(model.matrix);
        assert.ok(citySurfaceDistance(point.x, point.z, [b.envelope]) > -1e-6, `${id}: imported vertex leaves the source parcel.`);
      }
    }
    dispose(instances.root);
  }
});

test('fleet and four-car train keep dimensions, directions, wheel motion and world-space tile clipping', () => {
  const instances = new CityAssetInstances(library, buildings);
  const world = new Matrix4().makeRotationY(.63).scale(new Vector3(1.7, .9, 1.7));
  const instanceMatrix = new Matrix4(), point = new Vector3();
  for (const time of [0, 4, 10, 12, 13.9, 14, 19.9, 28]) {
    instances.update(time, world);
    for (const type of ['sedan', 'taxi', 'van', 'bus']) {
      const mesh = instances.root.getObjectByName(`shibuya-${type}-fleet`) as InstancedMesh;
      const indices = CITY_VEHICLES.flatMap((spec, i) => spec.type === type ? [i] : []);
      indices.forEach((index, i) => {
        mesh.getMatrixAt(i, instanceMatrix); point.setFromMatrixPosition(instanceMatrix);
        const pose = cityVehiclePosition(index, time);
        assert.ok(Math.abs(point.x - pose.x) < 1e-6 && Math.abs(point.z - pose.z) < 1e-6);
        if (Math.max(Math.abs(pose.x), Math.abs(pose.z)) < .49) {
          const forward = new Vector3(0, 0, 1).transformDirection(instanceMatrix);
          assert.ok(Math.abs(forward.x - Math.sin(pose.heading)) < 1e-6 && Math.abs(forward.z - Math.cos(pose.heading)) < 1e-6);
          assert.ok(Math.abs(new Vector3().setFromMatrixScale(instanceMatrix).x - CITY_VEHICLE_SCALE) < 1e-6);
        }
      });
    }
    const train = instances.root.getObjectByName('shibuya-metro-carriage') as InstancedMesh;
    for (let car = 0; car < 4; car++) {
      train.getMatrixAt(car, instanceMatrix); point.setFromMatrixPosition(instanceMatrix);
      const p = cityStationPoint(cityTrainPosition(time) + (car - 1.5) * SHIBUYA_STATION.carSpacing);
      assert.ok(Math.abs(point.x - p.x) < 1e-6 && Math.abs(point.z - p.z) < 1e-6);
      assert.ok(Math.abs(point.y - SHIBUYA_STATION.trackHeight) < 1e-6);
    }
    for (const material of instances.materials) for (const plane of material.clippingPlanes!.slice(0, 4)) {
      assert.ok(plane.distanceToPoint(new Vector3(0, .3, 0).applyMatrix4(world)) > 0);
    }
    for (const plane of instances.materials.at(-1)!.clippingPlanes!.slice(4)) {
      assert.ok(plane.distanceToPoint(new Vector3(SHIBUYA_STATION.center.x, .3, SHIBUYA_STATION.center.z).applyMatrix4(world)) > 0);
    }
    assert.ok(instances.materials[0].clippingPlanes!.some(plane => plane.distanceToPoint(new Vector3(0, .3, .51).applyMatrix4(world)) < 0));
  }
  const second = new CityAssetInstances(library, buildings);
  const wheels = instances.root.getObjectByName('shibuya-wheel') as InstancedMesh;
  for (const index of [0, 6]) {
    const angle = (time: number) => {
      instances.update(time, world); wheels.getMatrixAt(index * 4, instanceMatrix);
      instanceMatrix.premultiply(new Matrix4().makeRotationY(-cityVehiclePosition(index, time).heading));
      return Math.atan2(instanceMatrix.elements[6], instanceMatrix.elements[5]);
    };
    const a = angle(13), b = angle(13.001);
    const rotation = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const travel = cityVehiclePosition(index, 13.001).distance - cityVehiclePosition(index, 13).distance;
    assert.equal(Math.sign(rotation), Math.sign(travel), 'A world-axis wheel rolls against its vehicle travel.');
  }
  assert.notEqual(instances.materials[0], second.materials[0]);
  assert.notEqual((instances.root.children[0] as Mesh).geometry, (second.root.children[0] as Mesh).geometry);
  let disposedTemplate = false;
  library.assets.get('vehicle-taxi')!.geometry.addEventListener('dispose', () => { disposedTemplate = true; });
  dispose(instances.root); second.update(5, world);
  assert.equal(disposedTemplate, false); dispose(second.root);
});

test('models attach at settled frames, prepare behind the QR, and cannot revive a disposed scene', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const context = new Proxy({ measureText: (text: string) => ({ width: text.length * 10 }) }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 512, height: 512, getContext: () => context }) } });
  const scenes: ShibuyaScene[] = [];
  try {
    let resolve!: (library: CityAssetLibrary) => void;
    const promise = new Promise<CityAssetLibrary>(done => { resolve = done; });
    const make = (loader = () => promise) => {
      const scene = new ShibuyaScene(matrix, DESIGN_QR_THEME_PRESETS.shibuya, loader); scenes.push(scene); return scene;
    };
    const active = make(), qrStart = make(), stale = make(); stale.dispose();
    assert.equal(active.assetStatus, 'loading');
    active.setLogoPresent(true); const anchor = active.getLogoAnchor();
    resolve(library); await promise; await Promise.resolve();
    assert.equal(active.assetStatus, 'pending');
    for (const progress of [.9, .75, .5, .25, .1]) active.update(progress, .1, false);
    active.update(0, 0, false, false); assert.equal(active.assetStatus, 'pending');
    active.update(0, 0, false, true); assert.equal(active.assetStatus, 'ready');
    qrStart.update(1, 0, true, false); assert.equal(qrStart.assetStatus, 'pending');
    qrStart.update(1, 0, true); assert.equal(qrStart.assetStatus, 'ready');
    const qrAssets = qrStart.root.getObjectByName('shibuya-assets')!;
    assert.equal(qrAssets.parent!.visible, false);
    qrStart.update(.1, 0, true);
    assert.equal(qrAssets.parent!.visible, true);
    assert.deepEqual(active.getLogoAnchor(), anchor);
    assert.equal(active.root.getObjectByName('shibuya-assets')!.children.length, 10);
    assert.ok(active.root.getObjectByName('shibuya-landmark-rooftops'));
    assert.equal(active.root.getObjectByName('shibuya-bus-fleet')!.visible, true);
    stale.update(0, .1, false); assert.ok(!stale.root.getObjectByName('shibuya-assets'));
    active.update(1, 0, false); assert.equal(active.root.getObjectByName('shibuya-assets')!.parent!.visible, false);
    active.update(0, 0, false); active.setLogoPresent(false);
    const failed = make(() => Promise.reject(new Error('Offline')));
    await Promise.resolve(); await Promise.resolve(); assert.equal(failed.assetStatus, 'error');
    assert.equal(failed.root.getObjectByName('shibuya-assets'), undefined);
    failed.update(1, 0, false);
    assert.equal(failed.root.getObjectByName('shibuya-hachiko-square')!.parent!.visible, false);
  } finally {
    for (const scene of scenes) { scene.dispose(); dispose(scene.root); }
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('QR edits preserve street-life objects and the phase clock across sizes, morphs and reduced motion', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Real sign painting and texture lifetime are covered by the browser gate.
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => null }) } });
  const theme = DESIGN_QR_THEME_PRESETS.shibuya;
  const scenes: ShibuyaScene[] = [];
  try {
    let loads = 0;
    const make = () => {
      const scene = new ShibuyaScene(matrix, theme, async () => { loads++; return library; });
      scenes.push(scene); return scene;
    };
    const edited = make(), uninterrupted = make();
    await Promise.resolve();
    // Start well beyond the opening pose, in moving vehicle traffic.
    for (const scene of scenes) scene.update(0, 10.3, false);
    const names = ['walking-commuters', 'sedan-fleet', 'taxi-fleet', 'van-fleet', 'bus-fleet', 'wheel', 'metro-carriage', 'metro-cab'];
    const actors = names.map(name => edited.root.getObjectByName('shibuya-' + name) as InstancedMesh);
    const fixedNames = ['surveyed-road-foundation', 'shared-street-furniture', 'oriented-signal-lights',
      'station-and-subway-entrances', 'subway-glazing', 'police-balcony-glazing', 'hachiko-square', 'construction-site', 'building-qfront', 'building-magnet'];
    const fixed = fixedNames.map(name => edited.root.getObjectByName('shibuya-' + name) as Mesh);
    let persistentDisposals = 0;
    for (const mesh of [...actors, ...fixed]) mesh.geometry.addEventListener('dispose', () => { persistentDisposals++; });
    const sameMotion = () => names.forEach((name, i) => {
      const actual = edited.root.getObjectByName('shibuya-' + name) as InstancedMesh;
      const control = uninterrupted.root.getObjectByName('shibuya-' + name) as InstancedMesh;
      assert.equal(actual, actors[i], `${name} was recreated`);
      assert.deepEqual(actual.instanceMatrix.array, control.instanceMatrix.array, `${name} restarted or changed its route`);
    });
    const inputs = ['https://example.com/another', 'TOKYO', 'https://example.com/' + 'tokyo/'.repeat(32)];
    const sizes = new Set<number>();
    for (const reduced of [false, true, false]) for (const progress of [0, .3, .75, 1, 0]) {
      for (const scene of scenes) scene.update(progress, .2, reduced);
      for (const value of inputs) {
        const next = generateQRMatrix(value, 'M').modules; sizes.add(next.length);
        const context = edited.root.getObjectByName('shibuya-source-aligned-streetscape') as Mesh;
        const old = context.geometry;
        let disposed = 0; old.addEventListener('dispose', () => { disposed++; });
        const matrices = actors.map(mesh => mesh.instanceMatrix.array.slice());
        edited.updateContent(next, theme);
        assert.equal(edited.assetStatus, 'ready');
        assert.notEqual(context.geometry, old); assert.equal(disposed, 1);
        fixedNames.forEach((name, i) => assert.equal(edited.root.getObjectByName('shibuya-' + name), fixed[i]));
        actors.forEach((mesh, i) => assert.deepEqual(mesh.instanceMatrix.array, matrices[i], 'Editing advanced the clock'));
        sameMotion();
        const qr = edited.root.getObjectByName('shibuya-qr-modules') as InstancedMesh;
        assert.equal(qr.count, next.flat().filter(Boolean).length, 'Growing/shrinking a QR left stale cells');
        if (progress === 1) {
          assert.equal(actors[0].parent!.visible, false);
          const transform = new Matrix4(); let index = 0;
          next.forEach((row, r) => row.forEach((dark, c) => {
            if (!dark) return;
            qr.getMatrixAt(index++, transform);
            assert.ok(Math.abs(transform.elements[12] - ((c + .5) / next.length - .5)) < 1e-6);
            assert.ok(Math.abs(transform.elements[14] - ((r + .5) / next.length - .5)) < 1e-6);
          }));
        }
      }
      for (const scene of scenes) scene.update(progress, .25, reduced);
      sameMotion();
    }
    assert.equal(loads, 2, 'Content edits reloaded models');
    assert.equal(persistentDisposals, 0); assert.ok(sizes.size >= 3 && sizes.has(57));
  } finally {
    for (const scene of scenes) { scene.dispose(); dispose(scene.root); }
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('content edits retain pending assets without attaching early or reviving a disposed scene', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => null }) } });
  let scene: ShibuyaScene | undefined;
  try {
    let resolve!: (library: CityAssetLibrary) => void, loads = 0;
    const promise = new Promise<CityAssetLibrary>(done => { resolve = done; });
    scene = new ShibuyaScene(matrix, DESIGN_QR_THEME_PRESETS.shibuya, () => { loads++; return promise; });
    const next = generateQRMatrix('Pending city content updates', 'M').modules;
    scene.updateContent(next, DESIGN_QR_THEME_PRESETS.shibuya);
    assert.equal(scene.assetStatus, 'loading');
    resolve(library); await promise; await Promise.resolve();
    for (const progress of [0, .4, 1]) {
      scene.update(progress, 0, false, false);
      scene.updateContent(next, DESIGN_QR_THEME_PRESETS.shibuya);
      assert.equal(scene.assetStatus, 'pending');
      assert.equal(scene.root.getObjectByName('shibuya-assets'), undefined);
    }
    scene.update(.4, 0, false, true); assert.equal(scene.assetStatus, 'pending');
    scene.update(1, 0, false, true); assert.equal(scene.assetStatus, 'ready');
    assert.equal(scene.root.getObjectByName('shibuya-assets')!.parent!.visible, false);
    assert.equal(loads, 1);
    const context = (scene.root.getObjectByName('shibuya-source-aligned-streetscape') as Mesh).geometry;
    scene.dispose(); scene.updateContent(matrix, DESIGN_QR_THEME_PRESETS.shibuya);
    assert.equal((scene.root.getObjectByName('shibuya-source-aligned-streetscape') as Mesh).geometry, context);
  } finally {
    if (scene) { scene.dispose(); dispose(scene.root); }
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});


test('content edits vary both landmark glazing buffers deterministically without replacing assets', () => {
  const instances = new CityAssetInstances(library, buildings);
  const meshes = ['qfront', 'magnet'].map(id => instances.root.getObjectByName(`shibuya-building-${id}`) as Mesh);
  const snapshot = () => meshes.map(mesh => Array.from(mesh.geometry.getAttribute('color').array));
  const before = snapshot();
  const roofs = () => Array.from((instances.root.getObjectByName('shibuya-landmark-rooftops') as Mesh).geometry.getAttribute('position').array);
  const beforeRoofs = roofs();
  const geometry = meshes.map(mesh => mesh.geometry);
  const templates = ['building-qfront', 'building-magnet'].map(id =>
    Array.from(library.assets.get(id)!.geometry.getAttribute('position').array));
  instances.updateBuildings(createCityBuildings(generateQRMatrix('https://example.com/another', 'H').modules));
  const after = snapshot();
  for (let i = 0; i < meshes.length; i++) {
    assert.notDeepEqual(after[i], before[i]);
    assert.equal(meshes[i].geometry, geometry[i]);
  }
  assert.notDeepEqual(roofs(), beforeRoofs, 'Rooftop arrangement stayed fixed');
  assert.notDeepEqual(roofs().filter((_, i) => i % 3 !== 1), beforeRoofs.filter((_, i) => i % 3 !== 1), 'Only rooftop heights changed');
  instances.updateBuildings(buildings);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(roofs(), beforeRoofs);
  assert.deepEqual(['building-qfront', 'building-magnet'].map(id =>
    Array.from(library.assets.get(id)!.geometry.getAttribute('position').array)), templates);
  dispose(instances.root);
});
