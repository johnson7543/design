import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, InstancedMesh } from 'three';
import { LazyCityScene, type CitySceneConstructor } from '../src/renderer/webgl/LazyCityScene.ts';
import { DESIGN_QR_THEME_PRESETS } from '../src/designs/tree/themes.ts';

const theme = DESIGN_QR_THEME_PRESETS.shibuya;
const modules = [[true, false], [false, true]];
function harness() {
  let resolve!: (constructor: CitySceneConstructor) => void, reject!: (error: Error) => void;
  const calls: string[] = [];
  let latest: boolean[][] | undefined;
  class Scene {
    root = new Group(); assetStatus = 'ready';
    constructor(value: boolean[][]) { calls.push('construct'); latest = value; }
    updateContent(value: boolean[][]) { calls.push('content'); latest = value; }
    setLogoPresent(present: boolean, light = false) { calls.push(`logo:${present}:${light}`); }
    getLogoAnchor() { return { x: .1, y: .2, z: .3, width: .1, height: .2 }; }
    prepareMorphRendering() { calls.push('prepare'); }
    update() { calls.push('update'); }
    dispose() { calls.push('dispose'); }
  }
  const promise = new Promise<CitySceneConstructor>((yes, no) => { resolve = yes; reject = no; });
  const scene = new LazyCityScene('tokyo-tower', modules, theme, () => promise);
  return { scene, calls, resolve: () => resolve(Scene), reject, latest: () => latest };
}

test('pending code cannot replace a paused or mid-turn frame; attachment uses current content and logo', async () => {
  const h = harness(), fallback = h.scene.root.children[0] as InstancedMesh;
  let freed = 0; fallback.geometry.addEventListener('dispose', () => freed++);
  h.resolve(); await Promise.resolve();
  h.scene.update(0, 0, false, false);
  h.scene.update(.5, .01, false, true);
  assert.equal(h.scene.assetStatus, 'loading'); assert.deepEqual(h.calls, []);
  const edited = [[false, true], [true, false]];
  h.scene.updateContent(edited, theme); h.scene.setLogoPresent(true, true);
  h.scene.update(1, 0, true, true);
  assert.equal(h.scene.assetStatus, 'ready'); assert.equal(h.latest(), edited);
  assert.deepEqual(h.calls, ['construct', 'logo:true:true', 'update']);
  assert.equal(h.scene.root.children.length, 1); assert.equal(freed, 1);
  h.scene.dispose(); h.scene.dispose();
  assert.equal(h.calls.filter(call => call === 'dispose').length, 1);
  assert.equal(h.scene.root.children.length, 1, 'Renderer-owned resources must remain traversable for final cleanup.');
});

test('failed imports preserve a current QR fallback and dispose its buffers once', async () => {
  const h = harness(); h.reject(new Error('offline'));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.scene.assetStatus, 'error');
  h.scene.updateContent([[true]], theme);
  const mesh = h.scene.root.children[0] as InstancedMesh;
  assert.equal(mesh.count, 1); assert.equal(mesh.instanceColor?.count, 1);
  let geometry = 0, material = 0, instances = 0;
  mesh.geometry.addEventListener('dispose', () => geometry++);
  (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).addEventListener('dispose', () => material++);
  mesh.addEventListener('dispose', () => instances++);
  h.scene.dispose(); h.scene.dispose();
  assert.deepEqual([geometry, material, instances], [1, 1, 1]);
});

test('late completion cannot construct or attach to a disposed player', async () => {
  const h = harness(); h.scene.dispose(); h.resolve(); await Promise.resolve();
  h.scene.update(0, 0, false, true);
  assert.deepEqual(h.calls, []); assert.equal(h.scene.root.children.length, 0);
});

test('players share code without sharing scene instances or resources', async () => {
  const a = harness(), b = harness(); a.resolve(); b.resolve(); await Promise.resolve();
  a.scene.update(0, 0, false, true); b.scene.update(0, 0, false, true);
  assert.notEqual(a.scene.root.children[0], b.scene.root.children[0]);
  a.scene.dispose(); b.scene.update(1, 0, false, true);
  assert.equal(b.calls.includes('dispose'), false); assert.equal(b.scene.assetStatus, 'ready');
  b.scene.dispose();
});

test('scene initialization failure leaves the QR fallback available', async () => {
  const scene = new LazyCityScene('shibuya', modules, theme, async () => {
    return class { constructor() { throw new Error('initialization failed'); } } as unknown as CitySceneConstructor;
  });
  await Promise.resolve(); scene.update(0, 0, false, true);
  assert.equal(scene.assetStatus, 'error');
  assert.equal(scene.root.children[0].name, 'city-loading-qr');
  scene.dispose();
});
