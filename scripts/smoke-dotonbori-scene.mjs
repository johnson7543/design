import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';
import { dotonboriAssetPlugin } from './dotonbori-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url))), directory = await mkdtemp(join(tmpdir(), 'dotonbori-scene-'));
const port = Number(process.env.DESIGNQR_DOTONBORI_SCENE_PORT ?? 4217);
await writeFile(join(directory, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/dotonbori-scene/main.ts'))};`);
let server, browser;
try {
  await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin(), dotonboriAssetPlugin()], logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.dotonboriSceneFixture?.ready());
  await page.evaluate(() => window.dotonboriSceneFixture.pause());
  const glow = await page.evaluate(() => ({ opaque: window.dotonboriSceneFixture.glowDifference(), transparent: window.dotonboriSceneFixture.glowDifference(true) }));
  assert.ok(glow.opaque.changed > 100, 'The night profile must affect actual presentation pixels.');
  assert.equal(glow.transparent.changed, 0, 'Transparent artwork must retain unmodified source alpha.');
  await (await page.$('.designqr-root')).screenshot({ path: join(directory, 'night-opening.png') });
  const surfaces = await page.evaluate(() => window.dotonboriSceneFixture.surfaceSnapshot());
  assert.equal(surfaces.buildingCount, 58); assert.equal(surfaces.wheelCells.length, 33);
  assert.ok(surfaces.sourceTriangles > 340000 && surfaces.coverageError < 1e-10);
  assert.ok(surfaces.bytes < 56 * 1024 ** 2);
  const surfaceTiming = await page.evaluate(() => window.dotonboriSceneFixture.surfaceTiming());
  for (const group of surfaceTiming) {
    assert.ok(group.triangles > 0 && group.startChanged > 0, `${group.name} must start with the city.`);
    assert.ok(group.settleChanged > 0, `${group.name} must participate in the shared final settle.`);
    assert.equal(group.afterSettleChanged, 0, `${group.name} must finish at 90%, with no delayed tail.`);
    assert.ok(group.reverseIdentical, `${group.name} must retrace the same rendered pixels in reverse.`);
    if (group.name === 'donki') {
      assert.ok(group.ordinaryMotion.length >= 10);
      for (const frame of group.ordinaryMotion) assert.equal(frame.changedPixels, 0,
        `At ${frame.progress}, Donki must contract and travel with ordinary architecture, not wait as a complete wheel frame.`);
    }
  }
  const riverTurn = new Map();
  for (const progress of [0, .16, .30, .44, .60, .78, .88, .94, 1, .94, .88, .78, .60, .44, .30, .16, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), progress);
    const pixels = await page.evaluate(() => window.dotonboriSceneFixture.sourceImage());
    assert.deepEqual(errors, [], 'The source and transient shader programs must compile on the browser GPU.');
    if (riverTurn.has(progress)) assert.equal(pixels, riverTurn.get(progress), `At ${progress}, reversing must retrace the same rendered source pixels.`);
    else {
      riverTurn.set(progress, pixels);
      await (await page.$('.designqr-root')).screenshot({ path: join(directory, `river-turn-${progress}.png`) });
    }
    if (progress === 1) assert.equal((await page.evaluate(() => window.dotonboriSceneFixture.glowDifference())).changed, 0, 'The settled QR must have no night glow.');
  }
  const snapshot = () => page.evaluate(() => window.dotonboriSceneFixture.snapshot());
  const initial = await snapshot(), identity = initial.buildings.map(b => [b.id, b.geometry]);
  const openingCamera = await page.evaluate(() => window.dotonboriSceneFixture.cameraPose());
  assert.ok(Math.abs(openingCamera.elevation - Math.PI / 6) < 1e-5, 'Open 30 degrees above the river.');
  assert.ok(Math.abs(openingCamera.yaw + 8 * Math.PI / 9) < 1e-5, 'Open from the northeast toward the Glico running man.');
  await page.evaluate(() => window.dotonboriSceneFixture.riverView());
  const riverCamera = await page.evaluate(() => window.dotonboriSceneFixture.cameraPose());
  assert.ok(Math.abs(riverCamera.elevation - 5 * Math.PI / 18) < 1e-5);
  assert.ok(Math.abs(riverCamera.yaw - openingCamera.yaw) < 1e-5, 'River view preserves the northeast bearing.');
  await (await page.$('.designqr-root')).screenshot({ path: join(directory, 'river-view.png') });
  for (const progress of [.42, 1, .42, 0]) await page.evaluate(p => window.dotonboriSceneFixture.progress(p), progress);
  assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.cameraPose()), riverCamera, 'The viewing preset survives a complete QR turn.');
  await page.evaluate(() => {
    window.dotonboriSceneFixture.reducedMotion(true);
    window.dotonboriSceneFixture.resetRotation();
  });
  assert.ok(Math.abs((await page.evaluate(() => window.dotonboriSceneFixture.cameraPose())).elevation - Math.PI / 6) < 1e-5);
  await page.evaluate(() => { window.dotonboriSceneFixture.pause(); window.dotonboriSceneFixture.reducedMotion(false); });
  await page.evaluate(() => {
    window.dotonboriSceneFixture.orbit(-1.2, -.15);
    window.dotonboriSceneFixture.resetRotation();
  });
  await page.waitForFunction(() => {
    const camera = window.dotonboriSceneFixture.cameraPose();
    return Math.abs(camera.elevation - Math.PI / 6) < 1e-5 && Math.abs(camera.yaw + 8 * Math.PI / 9) < 1e-5;
  });
  await page.evaluate(() => window.dotonboriSceneFixture.pause());
  await writeFile(join(directory, 'bridge-waterline.png'), Buffer.from((await page.evaluate(() => window.dotonboriSceneFixture.bridgeFrame())).split(',')[1], 'base64'));
  const wheelFrames = [];
  for (const time of [0, 75, 0]) {
    const { image, ...frame } = await page.evaluate(time => window.dotonboriSceneFixture.ebisuFrame(time), time);
    assert.equal(frame.count, 32); assert.equal(frame.inventory, 58);
    if (wheelFrames.length) {
      assert.equal(frame.geometry, wheelFrames[0].geometry); assert.equal(frame.material, wheelFrames[0].material);
      assert.notDeepEqual(frame.matrices, wheelFrames.at(-1).matrices);
    }
    await writeFile(join(directory, `ebisu-front-${time}.png`), Buffer.from(image.split(',')[1], 'base64'));
    wheelFrames.push(frame);
  }
  assert.deepEqual(wheelFrames[0].matrices, wheelFrames[2].matrices);
  const reverseWheel = await page.evaluate(() => window.dotonboriSceneFixture.ebisuFrame(0, Math.PI + .24));
  await writeFile(join(directory, 'ebisu-rear.png'), Buffer.from(reverseWheel.image.split(',')[1], 'base64'));
  const riverbankViews = [];
  for (const bank of ['north', 'south']) for (const east of [-35, 0, 35]) {
    const { image, ...frame } = await page.evaluate(({ bank, east }) => window.dotonboriSceneFixture.riverbankFrame(bank, east), { bank, east });
    assert.equal(frame.inventory, 58);
    await writeFile(join(directory, `riverbank-${bank}-${east}.png`), Buffer.from(image.split(',')[1], 'base64'));
    riverbankViews.push(frame);
  }
  const facadeViews = [];
  const crabFrames = [];
  for (const time of [0, 3, 6, 12]) {
    const frame = await page.evaluate(time => window.dotonboriSceneFixture.facadeFrame('B046-south', 0, 'crab', time), time);
    assert.equal(frame.inventory, 58);
    if (crabFrames.length) {
      assert.equal(frame.state.geometry, crabFrames[0].state.geometry);
      assert.equal(frame.state.material, crabFrames[0].state.material);
      assert.notEqual(frame.image, crabFrames.at(-1).image, 'Exterior crab must change rendered pixels while retaining its geometry.');
    }
    if (time === 12) assert.equal(frame.image, crabFrames[0].image, 'Exterior crab loop must return to the same rendered pose.');
    await writeFile(join(directory, `kani-crab-${time}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
    crabFrames.push(frame);
  }
  for (const angle of [-.7, .7]) {
    const frame = await page.evaluate(angle => window.dotonboriSceneFixture.facadeFrame('B046-south', angle, 'crab'), angle);
    await writeFile(join(directory, `kani-crab-side-${angle}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
  }
  for (const id of ['B046', 'B046-west', 'B037', 'B041', 'B034-east-lower']) {
    const frame = await page.evaluate(id => window.dotonboriSceneFixture.facadeFrame(id, .28, 'store'), id);
    await writeFile(join(directory, `interior-${id}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
  }
  for (const id of ['B046-south', 'B034-east-lower', 'B037', 'B037-east', 'B039', 'B040', 'B041', 'B046', 'B046-west',
    'B031-west', 'B034-south-lower', 'B034-south-upper', 'B034-east-upper']) for (const angle of ['B046-south', 'B034-east-lower'].includes(id) ? [-.55, 0, .55] : [0]) {
    const { image, contextImage, ...frame } = await page.evaluate(({ id, angle }) => window.dotonboriSceneFixture.facadeFrame(id, angle), { id, angle });
    assert.equal(frame.inventory, 58); assert.ok(frame.meshes >= 3);
    await writeFile(join(directory, `facade-${id}-${angle}.png`), Buffer.from(image.split(',')[1], 'base64'));
    await writeFile(join(directory, `facade-context-${id}-${angle}.png`), Buffer.from(contextImage.split(',')[1], 'base64'));
    facadeViews.push(frame);
  }
  // Warm every camera-facing material/geometry, then require stable GPU storage.
  let baseline;
  for (let pass = 0; pass < 2; pass++) {
    for (let step = 0; step < 24; step++) {
      const angle = Math.PI / 4 + step / 24 * Math.PI * 2 * (pass ? -1 : 1);
      const state = await page.evaluate(angle => window.dotonboriSceneFixture.angle(angle), angle);
      assert.equal(state.buildings.length, 58); assert.deepEqual(state.buildings.map(b => [b.id, b.geometry]), identity);
      assert.deepEqual(state.errors, []); assert.ok(state.buildings.every(building => building.visible), 'The full building inventory must draw during rotation.');
      assert.equal(state.ownedTriangles, initial.ownedTriangles, 'Rotation must retain every facade, sign and shop detail.');
      if (baseline) assert.deepEqual(state.gpu, baseline);
      if (pass === 0 && step % 6 === 0) await page.screenshot({ path: join(directory, `orbit-${step}.png`) });
    }
    baseline = (await snapshot()).gpu;
  }
  const waterViews = [];
  for (let side = 0; side < 4; side++) {
    await page.evaluate(angle => window.dotonboriSceneFixture.angle(angle), Math.PI / 4 + side * Math.PI / 2);
    const { image, ...view } = await page.evaluate(() => window.dotonboriSceneFixture.waterVisibility());
    assert.ok(view.reflectionPixels > 100, `Reflections disappear from viewing side ${side}.`);
    assert.ok(view.wakePixels > 100, `The wake disappears from viewing side ${side}.`);
    assert.deepEqual(view.order, ['dotonbori-water-plan', 'dotonbori-water-reflections', 'dotonbori-spreading-wake']);
    await writeFile(join(directory, `water-side-${side}.png`), Buffer.from(image.split(',')[1], 'base64'));
    await page.screenshot({ path: join(directory, `water-side-city-${side}.png`) });
    waterViews.push({ side, ...view });
  }
  await page.evaluate(() => window.dotonboriSceneFixture.angle(Math.PI / 4));
  const waterFrames = [];
  for (const delta of [0, .35, .8, .35]) {
    const frame = await page.evaluate(delta => window.dotonboriSceneFixture.waterFrame(delta), delta);
    if (waterFrames.length) {
      const before = waterFrames.at(-1);
      assert.equal(frame.river.geometry, before.river.geometry); assert.equal(frame.wake.geometry, before.wake.geometry);
      assert.notEqual(frame.river.position, before.river.position); assert.notEqual(frame.wake.position, before.wake.position);
      assert.notEqual(frame.wake.color, before.wake.color);
      assert.notEqual(frame.image, before.image, 'Actual water pixels must move independently of boat/people/sign artwork.');
    }
    await writeFile(join(directory, `water-only-${waterFrames.length}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
    await page.screenshot({ path: join(directory, `water-city-${waterFrames.length}.png`) });
    waterFrames.push(frame);
  }
  const frozenWater = await page.evaluate(() => window.dotonboriSceneFixture.waterSnapshot());
  for (const p of [.08, .42, .7, 1, .7, .42, .08, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.waterSnapshot()), frozenWater,
      'Water and wake must freeze through the QR turn and paused 3D restoration.');
    if (p === .42) await page.screenshot({ path: join(directory, 'water-folding.png') });
  }
  const clothFrames = [];
  for (const kind of ['noren', 'pennant']) {
    const frames = [];
    for (const phase of [6, 6.5, 7]) {
      const frame = await page.evaluate(({ kind, phase }) => window.dotonboriSceneFixture.clothFrame(kind, phase), { kind, phase });
      assert.ok(frame.breeze > 0 && frame.visiblePixels > 1000, `${kind} must be visible in the breeze.`);
      if (frames.length) {
        assert.notEqual(frame.image, frames.at(-1).image, `${kind} must change actual fabric pixels.`);
        assert.deepEqual(frame.state.map(s => [s.geometry, s.material]), frames[0].state.map(s => [s.geometry, s.material]));
      }
      await writeFile(join(directory, `${kind}-${phase}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
      await writeFile(join(directory, `${kind}-context-${phase}.png`), Buffer.from(frame.contextImage.split(',')[1], 'base64'));
      frames.push(frame);
    }
    const reverse = await page.evaluate(kind => window.dotonboriSceneFixture.clothFrame(kind, undefined, -1), kind);
    assert.ok(reverse.visiblePixels > frames.at(-1).visiblePixels * .65, `${kind} must also render from the reverse side.`);
    assert.deepEqual(reverse.state, frames.at(-1).state, 'Changing view must not change cloth buffers.');
    await writeFile(join(directory, `${kind}-reverse.png`), Buffer.from(reverse.image.split(',')[1], 'base64'));
    clothFrames.push({ kind, frames: frames.map(({ image: _image, contextImage: _context, ...frame }) => frame), reversePixels: reverse.visiblePixels });
  }
  const frozenCloth = await page.evaluate(() => window.dotonboriSceneFixture.clothSnapshot());
  for (const p of [.08, .42, .7, 1, .7, .42, .08, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.clothSnapshot()), frozenCloth,
      'Fabric must freeze during the QR turn, reversal and paused 3D restoration.');
    if (p === .42) await page.screenshot({ path: join(directory, 'cloth-folding.png') });
  }
  const actionFrames = [];
  for (const [kind, times] of Object.entries({ prep: [0, 1, 2], service: [0, 8, 12, 18], tank: [0, 5, 9],
    phone: [0, 23, 26], wave: [18, 20, 22], passenger: [16, 18, 20] })) {
    const frames = [];
    for (const time of times) {
      const frame = await page.evaluate(({ kind, time }) => window.dotonboriSceneFixture.actionFrame(kind, time), { kind, time });
      assert.ok(frame.visiblePixels > 1000, `${kind} activity must render visible geometry.`);
      if (frames.length) {
        assert.notEqual(frame.image, frames.at(-1).image, `${kind} must change its actual rendered pose.`);
        assert.deepEqual(frame.state.map(s => [s.geometry, s.material]), frames[0].state.map(s => [s.geometry, s.material]));
      }
      await writeFile(join(directory, `${kind}-${time}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
      await writeFile(join(directory, `${kind}-context-${time}.png`), Buffer.from(frame.contextImage.split(',')[1], 'base64'));
      frames.push(frame);
    }
    actionFrames.push({ kind, frames: frames.map(({ image: _image, contextImage: _context, ...frame }) => frame) });
  }
  const frozenActions = await page.evaluate(() => window.dotonboriSceneFixture.actionSnapshot());
  for (const p of [.08, .42, .7, 1, .7, .42, .08, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.actionSnapshot()), frozenActions,
      'Staff, trays, phone gestures, passenger and crabs must freeze through the QR turn and its reversal.');
    if (p === .42) await page.screenshot({ path: join(directory, 'activity-folding.png') });
  }
  await page.screenshot({ path: join(directory, 'activity-city.png') });
  const crowdFrames = [];
  for (const time of [0, 23.4, 91.8, 187.6, 600, 3600]) for (const area of ['bridge', 'bank']) {
    const frame = await page.evaluate(({ time, area }) => window.dotonboriSceneFixture.crowdFrame(time, area), { time, area });
    assert.ok(frame.minimum > .94, `Crowd bodies overlap at ${time}: ${frame.minimum} m.`);
    if (crowdFrames.length) {
      assert.equal(frame.geometry, crowdFrames[0].geometry); assert.equal(frame.material, crowdFrames[0].material);
    }
    await writeFile(join(directory, `crowd-${area}-${time}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
    crowdFrames.push(frame);
  }
  const frozenCrowd = await page.evaluate(() => window.dotonboriSceneFixture.crowdSnapshot());
  for (const p of [.08, .42, .7, 1, .7, .42, .08, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.crowdSnapshot()), frozenCrowd,
      'Corrected walking positions must remain frozen through the QR turn and reversal.');
  }
  await page.evaluate(() => window.dotonboriSceneFixture.angle(2 * Math.PI / 3));
  const signFrames = [];
  for (const phase of [0, 5, 8]) {
    const frame = await page.evaluate(phase => window.dotonboriSceneFixture.glicoFrame(phase), phase);
    assert.equal(frame.blend, frame.reflectedBlend); assert.equal(frame.visible, true);
    if (signFrames.length) {
      assert.equal(frame.texture, signFrames[0].texture); assert.equal(frame.textureVersion, signFrames[0].textureVersion);
      assert.equal(frame.geometry, signFrames[0].geometry);
      assert.notEqual(frame.image, signFrames.at(-1).image, 'The LED program must visibly change its rendered pixels.');
    }
    await writeFile(join(directory, `glico-frame-${phase}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
    await page.screenshot({ path: join(directory, `glico-city-${phase}.png`) });
    signFrames.push(frame);
  }
  assert.deepEqual(signFrames.map(f => f.blend), [0, .5, 1]);
  await writeFile(join(directory, 'glico-atlas.png'), Buffer.from((await page.evaluate(() => window.dotonboriSceneFixture.glicoAtlas())).split(',')[1], 'base64'));
  const glicoState = () => page.evaluate(() => window.dotonboriSceneFixture.glicoSnapshot());
  for (const p of [.42, .65, 1, .65, .42]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    const state = await glicoState();
    assert.equal(state.blend, 1); assert.equal(state.reflectedBlend, 1);
    assert.equal(state.morphTexture, state.texture); assert.equal(state.morphUniformMatches, true);
    assert.equal(state.textureVersion, signFrames[0].textureVersion);
    assert.equal(state.morphVisible, p < 1);
    if (p === .42) await page.screenshot({ path: join(directory, 'glico-folding.png') });
  }
  await page.evaluate(() => window.dotonboriSceneFixture.progress(0));
  assert.equal((await glicoState()).blend, 1, 'Paused 3D restoration must retain the sign frame.');
  const campaignFrames = [];
  for (const time of [0, 9, 10, 12, 13, 9]) {
    const frame = await page.evaluate(time => ({ ...window.dotonboriSceneFixture.facadeFrame('B031-west', 0, undefined, time),
      state: window.dotonboriSceneFixture.campaignSnapshot() }), time);
    if (campaignFrames.length) {
      assert.equal(frame.state.texture, campaignFrames[0].state.texture);
      assert.equal(frame.state.textureVersion, campaignFrames[0].state.textureVersion);
      assert.equal(frame.state.geometry, campaignFrames[0].state.geometry);
      assert.notEqual(frame.image, campaignFrames.at(-1).image, 'Both secondary screens must visibly change without repainting their atlas.');
    }
    assert.equal(frame.state.texture, frame.state.morphTexture); assert.equal(frame.state.morphUniformMatches, true);
    await writeFile(join(directory, `campaigns-${time}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
    campaignFrames.push(frame);
  }
  assert.equal(campaignFrames[1].state.frames[0][2], .5); assert.equal(campaignFrames[1].state.frames[1][2], 0);
  const frozenCampaigns = campaignFrames.at(-1).state;
  for (const p of [.42, .65, 1, .65, .42, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.campaignSnapshot()), frozenCampaigns);
  }
  const logoState = () => page.evaluate(() => window.dotonboriSceneFixture.logoSnapshot());
  await page.evaluate(() => {
    const f = window.dotonboriSceneFixture; f.reducedMotion(true); f.resetRotation(); f.pause(); f.reducedMotion(false);
  });
  const signVisibility = await page.evaluate(() => window.dotonboriSceneFixture.signVisibility());
  assert.equal(signVisibility.panels.length, 2);
  for (const panel of signVisibility.panels) assert.equal(panel.clear, panel.samples, 'The narrow B038 context must leave the Pip/FANCL side signs clear.');
  const originalLogoState = await logoState();
  for (const aspect of [1, 4, .25]) {
    await page.evaluate(aspect => window.dotonboriSceneFixture.logo(window.dotonboriSceneFixture.sampleLogo(aspect)), aspect);
    await page.waitForFunction(() => window.dotonboriSceneFixture.logoSnapshot().exists);
    const state = await logoState();
    assert.ok(state.visible && state.anchor.visible); assert.equal(state.opacity, 1);
    assert.deepEqual(state.position, state.expected, 'Logo must be attached to the source-fitted Asahi panel');
    assert.ok(state.scale * state.imageScale[0] <= state.anchor.width * state.cityScale + 1e-8);
    assert.ok(state.scale * state.imageScale[1] <= state.anchor.height * state.cityScale + 1e-8);
    assert.ok(Math.abs(state.position[1] + state.scale * state.imageScale[1] / 2
      - (state.anchor.y + state.anchor.height / 2) * state.cityScale) < 1e-8, 'Every aspect ratio must use the upper Asahi area.');
    if (aspect >= 1) {
      const visibility = await page.evaluate(() => window.dotonboriSceneFixture.signVisibility());
      assert.ok(visibility.logo.clear / visibility.logo.samples > (aspect === 1 ? .84 : .92), 'The raised logo must be readable above the nearby Donki host.');
    }
    assert.equal(state.uv.filter((v, i) => v !== originalLogoState.uv[i]).length, 8);
    if (aspect === 1) await page.screenshot({ path: join(directory, 'asahi-logo.png') });
  }
  for (const ink of ['dark', 'light']) {
    await page.evaluate(ink => window.dotonboriSceneFixture.logo(window.dotonboriSceneFixture.sampleLogo(1, ink)), ink);
    await page.waitForFunction(() => window.dotonboriSceneFixture.logoSnapshot().exists);
    const state = await logoState();
    assert.deepEqual(state.backing, ink === 'dark' ? [232, 221, 207, 255] : [31, 58, 82, 255], 'Backing must contrast with the upload without recoloring it.');
  }
  // The Asahi host and its uploaded artwork remain present at every rotation
  // and throughout the shared sign-to-QR travel.
  await page.evaluate(() => window.dotonboriSceneFixture.logo(window.dotonboriSceneFixture.sampleLogo()));
  await page.waitForFunction(() => window.dotonboriSceneFixture.logoSnapshot().exists);
  for (let step = 1; step < 24; step++) {
    await page.evaluate(a => window.dotonboriSceneFixture.angle(a), Math.PI / 4 + step * Math.PI / 12);
    const state = await logoState();
    assert.ok(state.anchor.visible && state.visible, 'The Asahi logo must remain attached during rotation.');
  }
  const logoTexture = (await logoState()).texture;
  for (const p of [.1, .5, .77, 1, .77, .5, .1, 0]) {
    await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    const state = await logoState();
    assert.equal(state.texture, logoTexture, 'View changes must retain the uploaded texture.');
    assert.equal(state.visible, true); assert.equal(state.anchor.visible, true);
    assert.equal(state.opacity, 1);
    if (p === 1) { assert.equal(state.position[0], 0); assert.equal(state.position[2], 0); }
    else assert.ok(Math.hypot(state.position[0], state.position[2]) > 0, 'The logo must travel from the Asahi panel.');
  }
  await page.evaluate(() => { window.dotonboriSceneFixture.angle(Math.PI / 4); window.dotonboriSceneFixture.logo(false); });
  assert.equal((await logoState()).exists, false); assert.deepEqual((await logoState()).uv, originalLogoState.uv);
  const opening = await snapshot();
  assert.ok(opening.buildings.every(building => building.visible));
  for (const p of [.001, .08, .25, .42, .2, .6, .8, 1, .8, .6, .42, .25, .08]) {
    const state = await page.evaluate(p => window.dotonboriSceneFixture.progress(p), p);
    assert.deepEqual(state.errors, []);
    assert.ok(state.buildings.every(b => b.visible));
    assert.deepEqual(state.buildings.map(b => [b.id, b.geometry]), identity);
    assert.equal(state.ownedTriangles, opening.ownedTriangles, 'Every facade and sign must remain present during the turn.');
    if (p === .25 || p === .6) await page.screenshot({ path: join(directory, `turn-${p}.png`) });
  }
  // Public view state also changes the night backdrop to the light scan paper.
  await page.evaluate(() => { window.dotonboriSceneFixture.view('qr'); window.dotonboriSceneFixture.progress(1); });
  await new Promise(resolve => setTimeout(resolve, 700));
  await writeFile(join(directory, 'qr.png'), Buffer.from(await page.evaluate(() => window.dotonboriSceneFixture.exported())));
  await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  const decoded = await page.evaluate(async () => {
    const bytes = await window.dotonboriSceneFixture.exported(), url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
  });
  assert.equal(decoded, 'https://example.com/dotonbori');
  const transportedQR = await page.evaluate(async () => {
    const image = new Image(); image.src = window.dotonboriSceneFixture.surfaceEndpoint(); await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
  });
  assert.equal(transportedQR, decoded, 'The transported surfaces themselves must scan before the canonical QR handoff.');
  await page.evaluate(() => window.dotonboriSceneFixture.progress(0));
  assert.ok((await snapshot()).buildings.every(building => building.visible));
  // Exercise the public view action with real animated frames as well as the
  // exact progress probes above, so the click-to-turn integration is covered.
  // Match the recorded default-speed software-GPU benchmark. Detailed artwork
  // and responsive checks still use DPR 2; playback must retain its real pace.
  await page.setViewport({ width: 960, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => { window.dotonboriSceneFixture.view('design'); window.dotonboriSceneFixture.progress(0); window.dotonboriSceneFixture.watchTransitions(); });
  const playback = [];
  for (const view of ['qr', 'design']) {
    await page.evaluate(view => window.dotonboriSceneFixture.startTurn(view), view);
    await page.waitForFunction(p => window.dotonboriSceneFixture.snapshot().progress === p, {}, view === 'qr' ? 1 : 0);
    await page.evaluate(() => window.dotonboriSceneFixture.pause());
    const frames = await page.evaluate(() => window.dotonboriSceneFixture.transitionFrames());
    assert.ok(frames.some(frame => frame.progress > 0 && frame.progress < 1), `${view}: the public action must exercise the animated transition (${JSON.stringify(frames)}).`);
    playback.push({ view, frames });
    for (const frame of frames) {
      assert.equal(frame.visibleBuildings, 58);
    }
  }
  const responsiveViews = [];
  const pausedWater = await page.evaluate(() => window.dotonboriSceneFixture.waterSnapshot());
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    for (const [view, progress] of [['design', 0], ['design', .42], ['qr', 1]]) {
      await page.evaluate(({ view, progress }) => { window.dotonboriSceneFixture.view(view); window.dotonboriSceneFixture.progress(progress); }, { view, progress });
      await new Promise(resolve => setTimeout(resolve, 100));
      const state = await snapshot(); assert.equal(state.buildings.length, 58); assert.deepEqual(state.errors, []);
      const paintedPixels = await page.evaluate(() => window.dotonboriSceneFixture.paintedPixels());
      assert.ok(paintedPixels > 1000, 'Resizing a paused player must repaint its cleared source buffer.');
      assert.deepEqual(await page.evaluate(() => window.dotonboriSceneFixture.waterSnapshot()), pausedWater, 'Resize must not advance the paused scene.');
      await page.screenshot({ path: join(directory, `responsive-${width}-${progress}.png`) });
      responsiveViews.push({ width, height, progress, buildings: state.buildings.length, paintedPixels });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(join(directory, 'report.json'), JSON.stringify({ surfaces, surfaceTiming, transportedQR, orbitViewsChecked: 48, glow, riverTurnFrames: riverTurn.size, playback, initial, final: await snapshot(), decoded,
    riverCamera, campaignFrames: campaignFrames.map(({ image: _image, contextImage: _context, ...frame }) => frame),
    riverbankViews, facadeViews, crabFrames: crabFrames.map(({ image: _image, contextImage: _context, ...frame }) => frame),
    responsiveViews, waterViews, waterFrames: waterFrames.map(({ image: _image, ...frame }) => frame), clothFrames, actionFrames,
    crowdFrames: crowdFrames.map(({ image: _image, ...frame }) => frame) }, null, 2));
  await page.evaluate(() => window.dotonboriSceneFixture.dispose());
  console.log(`Dōtonbori scene passed: all 58 buildings and attached details remain present throughout rotation and QR transitions; crowd clearance, animated shops and visitors, two-sided cloth, water and wake, folding Glico artwork, stable GPU storage, Asahi logo travel, public view actions and PNG decoding. Captures: ${directory}`);
} finally { await browser?.close(); await server?.close(); }
