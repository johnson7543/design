import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'designqr-morph-'));
const port = Number(process.env.DESIGNQR_MORPH_PORT ?? 4198);
await writeFile(join(directory, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/shibuya-content/main.ts'))};`);
let server, browser;
const report = [];
try {
  await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin()], logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.contentFixture?.snapshot().status === 'ready');
  await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  await page.evaluate(() => { window.contentFixture.pause(); window.contentFixture.time(7); window.contentFixture.track(); });
  const initial = await page.evaluate(() => window.contentFixture.snapshot());
  const original3d = await page.evaluate(() => window.contentFixture.exported());
  const endpoint = async value => {
    await page.evaluate(value => window.contentFixture.progress(value), value);
    return page.evaluate(() => window.contentFixture.exported());
  };
  const originalQr = await endpoint(1);
  await endpoint(0);
  // Both canonical layers have now been uploaded; compare the transient batch
  // against that warmed baseline, not the 3D-only first render.
  const prepared = await page.evaluate(() => window.contentFixture.snapshot());
  let snapshot;
  for (const progress of [0, .08, .12, .15, .20, .25, .3, .36, .40, .42, .46, .5, .6, .7, .9, .97, 1,
    .97, .9, .7, .6, .5, .46, .42, .40, .36, .3, .25, .20, .15, .12, .08, 0]) {
    const result = await page.evaluate(progress => {
      const t = performance.now(); window.contentFixture.progress(progress);
      return { progress, updateMs: performance.now() - t, scene: window.contentFixture.snapshot(), morph: window.contentFixture.morph() };
    }, progress);
    assert.equal(result.scene.time, initial.time, 'Turning advanced the street-life clock');
    assert.deepEqual(result.scene.actors, initial.actors, 'Turning rewrote live actor poses');
    assert.deepEqual(result.morph.buffer, initial.buffer, 'Turning grew the drawing buffer');
    if (progress > 0 && progress < 1) {
      snapshot ??= result.morph;
      assert.deepEqual(result.morph.sources, snapshot.sources, 'A reversal resampled the city');
      assert.deepEqual(result.morph.attributes, snapshot.attributes, 'A frame uploaded new tile attributes');
      assert.ok(result.morph.count <= 29 * 29 + 512, 'Detail fragments exceeded the bounded budget');
      assert.ok(result.morph.gpu.textures <= initial.gpu.textures, 'The morph allocated textures');
      assert.ok(result.morph.gpu.geometries <= prepared.gpu.geometries + 2,
        `Transient geometry grew: ${result.morph.gpu.geometries} vs ${prepared.gpu.geometries}`);
      const { cityOpacity, tileOpacity, qrOpacity } = result.morph.handoff;
      assert.ok(1 - (1 - cityOpacity) * (1 - tileOpacity) * (1 - qrOpacity) > .998, 'The handoff exposes a ghosted layer');
      if (progress <= .4) assert.equal(cityOpacity, 1, 'Buildings become translucent too early');
      const destinations = new Map();
      for (const source of result.morph.sources.slice(29 * 29)) {
        const key = JSON.stringify(source.target);
        destinations.set(key, (destinations.get(key) ?? 0) + 1);
      }
      assert.ok(Math.max(...destinations.values()) <= 2, 'Detail fragments crowded into a few cells');
      if (progress === .5) {
        const groups = new Map();
        for (const item of result.morph.groups.filter(s => s.group && ['vehicle', 'train', 'sign', 'marking'].includes(s.kind))) {
          const key = `${item.kind}:${item.group}`, reference = groups.get(key);
          if (reference) assert.deepEqual(item.motion, reference, 'One object uses unrelated tile paths');
          else groups.set(key, item.motion);
        }
        assert.ok(groups.size >= 5 + 12 + 1, 'Crosswalk/vehicle/train groups are missing');
      }
    } else assert.equal(result.morph.visible, false, 'Settled views still draw the transient batch');
    await (await page.$('.designqr-root')).screenshot({ path: join(directory, `frame-${report.length}-${progress}.png`) });
    report.push({ ...result, morph: { ...result.morph, sources: undefined, groups: undefined } });
  }
  assert.deepEqual(new Set(snapshot.sources.map(s => s.kind)), new Set([
    'building', 'road', 'pavement', 'marking', 'station', 'furniture', 'garden', 'people', 'vehicle', 'train', 'sign',
  ]));
  assert.deepEqual(await page.evaluate(() => window.contentFixture.exported()), original3d, 'Returning to 3D changed its pose/pixels');
  assert.deepEqual(await endpoint(1), originalQr, 'The canonical QR changed after a turn');
  // A content update during a turn keeps the captured actors, even across QR versions.
  await endpoint(.45);
  const peopleBefore = await page.evaluate(() => window.contentFixture.morph().sources.filter(s => ['people', 'vehicle', 'train'].includes(s.kind)));
  await page.evaluate(() => window.contentFixture.edit('TOKYO'));
  const peopleAfter = await page.evaluate(() => window.contentFixture.morph().sources.filter(s => ['people', 'vehicle', 'train'].includes(s.kind)));
  assert.deepEqual(peopleAfter.map(({ target: _target, ...s }) => s), peopleBefore.map(({ target: _target, ...s }) => s));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    // Chromium's emulated DPR-only change need not emit resize when the CSS
    // viewport stays 1440x900. Exercise the existing resize handler explicitly.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    // A paused fixture does not run a render loop. Wait for BOTH resize/DPR
    // callbacks before driving the next frame, rather than accepting old size.
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.designqr-webgl-canvas');
      return canvas.width === canvas.clientWidth * 2 && canvas.height === canvas.clientHeight * 2;
    });
    await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const value = width === 1440 ? 'https://example.com/' + 'tokyo/'.repeat(32) : `City morph / ${width}`;
    await page.evaluate(value => window.contentFixture.edit(value), value);
    for (const progress of [.3, .6, 1]) {
      await endpoint(progress);
      const current = await page.evaluate(() => window.contentFixture.morph());
      assert.ok(current.count <= (width === 1440 ? 57 * 57 : 29 * 29) + 512, 'Dense/mobile details exceeded the batch budget');
      await (await page.$('.designqr-root')).screenshot({ path: join(directory, `${width}-${progress}.png`) });
    }
    const exported = await page.evaluate(() => window.contentFixture.exported());
    const decoded = await page.evaluate(async bytes => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
    }, exported.bytes);
    assert.equal(decoded, value, `${width}: QR did not decode; scene=${JSON.stringify(await page.evaluate(() => window.contentFixture.snapshot()))}; errors=${JSON.stringify(errors)}`);
    await page.evaluate(() => window.contentFixture.zoom(3));
    assert.deepEqual(await page.evaluate(() => window.contentFixture.exported()), exported, 'Zoom affected the QR export');
    await page.evaluate(() => { window.contentFixture.zoom(1); window.contentFixture.track(); });
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // The earlier inspection changes renderer progress directly; synchronize the
  // public React view before exercising its real reduced-motion interaction.
  await page.evaluate(() => { window.contentFixture.view('qr'); window.contentFixture.resume(); });
  await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.view === 'qr'
    || window.contentFixture.snapshot().progress === 1);
  await page.evaluate(() => window.contentFixture.view('design'));
  await page.waitForFunction(() => window.contentFixture.snapshot().progress === 0);
  await page.evaluate(() => window.contentFixture.view('qr'));
  await page.waitForFunction(() => window.contentFixture.snapshot().progress === 1);
  assert.equal(await page.evaluate(() => window.contentFixture.morph().visible), false);
  await page.evaluate(() => window.contentFixture.pause());
  assert.deepEqual(await page.evaluate(() => window.contentFixture.unmount()), [], 'Morph resources leaked or were double-disposed');
  assert.deepEqual(errors, []);
  await writeFile(join(directory, 'report.json'), JSON.stringify({ frames: report, sources: snapshot.sources }, null, 2));
  console.log(`Whole-city morph passed: solid handoff, coherent object groups, bounded tile occupancy, reversible poses, GPU-only updates, stable endpoints, QR decode, reduced motion and disposal. Captures: ${directory}`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
