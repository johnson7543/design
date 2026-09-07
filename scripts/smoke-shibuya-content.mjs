import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'designqr-content-'));
const port = Number(process.env.DESIGNQR_CONTENT_PORT ?? 4197);
await writeFile(join(directory, 'index.html'), '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/shibuya-content/main.ts'))};`);
let server, browser;
const changes = [];
function continuous({ before, after }) {
  assert.equal(after.root, before.root, 'A text edit replaced the city');
  assert.equal(after.status, 'ready', 'A text edit restarted model loading');
  assert.equal(after.time, before.time, 'A text edit ticked/reset the phase clock');
  assert.equal(after.progress, before.progress, 'A text edit restarted the morph');
  assert.deepEqual(after.actors, before.actors, 'People, vehicles, wheels or train were recreated or teleported');
  assert.deepEqual(after.fixed, before.fixed, 'The fixed street/station infrastructure was rebuilt');
  assert.equal(after.signals, before.signals, 'Signals restarted');
  assert.deepEqual(after.buffer, before.buffer, 'The drawing buffer grew');
  assert.notDeepEqual(after.buildings, before.buildings, 'The buildings did not reflect the new QR');
  changes.push({ before, after });
}
try {
  await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin()], logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1200, height: 760, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
  await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  // First exercise a live React prop change, then a manually paused inspection.
  continuous(await page.evaluate(() => window.contentFixture.edit('https://example.com/crossing')));
  await page.evaluate(() => { window.contentFixture.pause(); window.contentFixture.step(10); window.contentFixture.track(); });
  const originalHero = await page.evaluate(() => window.contentFixture.hero());
  const dense = 'https://example.com/' + 'tokyo/'.repeat(32);
  const first = await page.evaluate(() => window.contentFixture.snapshot());
  await page.screenshot({ path: join(directory, 'before.png') });
  for (const [i, value] of ['TOKYO', dense, ...Array.from({ length: 12 }, (_, i) => `https://example.com/shibuya-${i}`)].entries()) {
    const result = await page.evaluate(value => window.contentFixture.edit(value), value);
    continuous(result);
    assert.ok(result.after.projectedPerson.slice(0, 2).every((n, i) => Math.abs(n - result.before.projectedPerson[i]) < 1e-6),
      `A QR-version change moved a commuter on screen: ${result.before.projectedPerson} -> ${result.after.projectedPerson}`);
    assert.deepEqual(await page.evaluate(() => window.contentFixture.disposals()), [], `Resource leak after edit ${i}`);
  }
  assert.deepEqual(await page.evaluate(() => window.contentFixture.hero()), originalHero, 'Unchanged hero artwork was repainted/recreated');
  await page.screenshot({ path: join(directory, 'after.png') });
  const last = await page.evaluate(() => window.contentFixture.snapshot());
  assert.ok(last.gpu.geometries <= first.gpu.geometries + 1, 'Geometry allocations grew with edits');
  assert.ok(last.gpu.textures <= first.gpu.textures + 2, 'Textures accumulated across values');
  for (const progress of [.25, .7, 1, .4, 0]) {
    await page.evaluate(progress => window.contentFixture.progress(progress), progress);
    continuous(await page.evaluate(value => window.contentFixture.edit(value), `https://example.com/morph-${progress}`));
    if (progress === 1) assert.equal(changes.at(-1).after.cityVisible, false);
  }
  await page.evaluate(() => window.contentFixture.reduced(true));
  continuous(await page.evaluate(() => window.contentFixture.edit('Reduced motion city')));
  await page.evaluate(() => window.contentFixture.reduced(false));
  await page.evaluate(() => window.contentFixture.logo(true));
  await page.waitForFunction(original => window.contentFixture.hero().pixels !== original, {}, originalHero.pixels);
  const logoHero = await page.evaluate(() => window.contentFixture.hero());
  assert.notEqual(logoHero.pixels, originalHero.pixels);
  continuous(await page.evaluate(() => window.contentFixture.edit('https://example.com/with-logo')));
  assert.deepEqual(await page.evaluate(() => window.contentFixture.hero()), logoHero);
  await page.evaluate(() => window.contentFixture.logo(false));
  assert.deepEqual(await page.evaluate(() => window.contentFixture.hero()), originalHero);
  await page.evaluate(() => window.contentFixture.progress(1));
  continuous(await page.evaluate(value => window.contentFixture.edit(value), dense));
  const exported = await page.evaluate(() => window.contentFixture.exported());
  await writeFile(join(directory, 'updated-qr.png'), Buffer.from(exported.bytes));
  const decoded = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
  }, exported.bytes);
  assert.equal(decoded, dense, 'Export retained stale QR data');
  await page.evaluate(() => window.contentFixture.zoom(3));
  assert.deepEqual(await page.evaluate(() => window.contentFixture.exported()), exported, 'Zoom changed the updated QR export');
  await page.evaluate(() => { window.contentFixture.zoom(1); window.contentFixture.progress(0); window.contentFixture.resume(); });
  const resumed = await page.evaluate(() => window.contentFixture.snapshot());
  await page.waitForFunction(time => window.contentFixture.snapshot().time > time + .3, {}, resumed.time);
  const moving = await page.evaluate(() => window.contentFixture.snapshot());
  assert.equal(moving.root, resumed.root);
  assert.notDeepEqual(moving.actors, resumed.actors, 'The preserved simulation did not resume');
  await page.evaluate(() => window.contentFixture.pause());
  const oldRoot = moving.root;
  await page.evaluate(() => window.contentFixture.design('tree'));
  assert.equal(await page.$eval('.designqr-webgl-canvas', canvas => canvas.dataset.cityAssets), undefined);
  await page.evaluate(() => { window.contentFixture.design('city'); window.contentFixture.resume(); });
  await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
  assert.notEqual((await page.evaluate(() => window.contentFixture.snapshot())).root, oldRoot, 'Changing designs must rebuild the City simulation');
  assert.deepEqual(await page.evaluate(() => window.contentFixture.unmount()), [], 'Unmount leaked or double-disposed resources');
  assert.deepEqual(errors, []);
  await writeFile(join(directory, 'report.json'), JSON.stringify({ changes, first, last }, null, 2));
  console.log(`City content continuity passed: ${changes.length} live/paused/morph/QR edits, PNG decode, logo, bounded resources and disposal. Captures: ${directory}`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
