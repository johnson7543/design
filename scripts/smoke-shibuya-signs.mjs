import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'designqr-signs-'));
const port = Number(process.env.DESIGNQR_SIGN_PORT ?? 4196);
await writeFile(join(directory, 'index.html'), '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/shibuya-signs/main.ts'))};`);
let server, browser;
try {
  await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin()], logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1200, height: 760, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.signFixture);
  const report = await page.evaluate(() => window.signFixture.report());
  assert.equal(report.assetStatus, 'ready');
  assert.equal(report.inventory.length, 44);
  assert.ok(report.uniqueTextures <= 42, 'Duplicate maps and front/rear exit signs must share textures.');
  assert.ok(report.bytesWithMipmaps < report.formerBytesWithMipmaps, 'Sharper artwork must stay below the former sign texture allocation.');
  const checkRuns = (runs, width, height, id) => {
    for (const run of runs) {
      assert.equal(run.arguments, 3, `${id}: ${run.label} used width compression`);
      assert.ok(run.left >= -1 && run.right <= width + 1 && run.top >= -1 && run.bottom <= height + 1,
        `${id}: clipped ${run.label}: ${JSON.stringify(run)}`);
    }
  };
  for (const sign of report.inventory) {
    assert.ok(Math.abs(sign.shapeScale - 1) < .01, sign.id);
    assert.equal(sign.uvEnd, 1, sign.id);
    assert.ok(sign.pixels[0] * sign.pixels[1] <= 512 * 1024);
    assert.ok(Math.max(...sign.pixels) <= 2048);
    checkRuns(sign.runs, ...sign.pixels, sign.id);
    for (const run of sign.runs) assert.ok(run.fontPixels >= 14, `${sign.id}: under-resolved ${run.label}`);
  }
  const designs = await page.evaluate(() => window.signFixture.allDesigns());
  assert.equal(designs.length, 98);
  for (const design of designs) checkRuns(design.runs, design.width, design.height, `${design.index}/${design.aspect}`);
  for (const id of ['qfront-vision', 'magnet-corner-poster', 'qfront-books', 'department-store-street',
    'station-front-station-name', 'station-front-station-entry-name', 'subway-A6a-entry', 'subway-A7a-entry', 'jr-shibuya-rail-bridge']) {
    await page.evaluate(id => window.signFixture.detail(id), id);
    await page.screenshot({ path: join(directory, id + '.png') });
  }
  const normal = await page.evaluate(() => window.signFixture.detail('magnet-corner-poster'));
  const close = await page.evaluate(() => window.signFixture.detail('magnet-corner-poster', 3));
  assert.deepEqual(close, normal, 'Inspecting a sign must not grow the drawing buffer or render-pass count.');
  await page.screenshot({ path: join(directory, 'magnet-detail.png') });
  await page.evaluate(() => window.signFixture.detail('qfront-books', 1, Math.PI / 3));
  await page.screenshot({ path: join(directory, 'qfront-books-oblique.png') });
  const lifecycle = await page.evaluate(() => window.signFixture.lifecycle());
  for (const [key, value] of Object.entries(lifecycle)) if (key !== 'count') assert.equal(value, true, key);
  assert.equal(lifecycle.count, report.uniqueTextures);
  await writeFile(join(directory, 'report.json'), JSON.stringify({ report, designs, lifecycle }, null, 2));
  await page.evaluate(() => window.signFixture.dispose());
  assert.deepEqual(errors, []);
  console.log('Sign quality, 98 template/aspect combinations, shared-texture ownership and QR restoration passed.');
  console.log({ signs: report.inventory.length, textures: report.uniqueTextures,
    oldMiB: report.formerBytesWithMipmaps / 2**20, newMiB: report.bytesWithMipmaps / 2**20, captures: directory });
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
