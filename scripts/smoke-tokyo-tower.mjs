import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { createDesignQREmbedUrl } from 'designqr/embed';
import { normalizeDesignQRConfig, encodeDesignQRConfig } from 'designqr/config';
import { DESIGN_QR_THEME_PRESETS } from 'designqr';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';
import { dotonboriAssetPlugin } from './dotonbori-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'tokyo-tower-fixture-'));
const captures = process.env.DESIGNQR_TOWER_CAPTURES ?? '/tmp/designqr-tokyo-tower';
const port = Number(process.env.DESIGNQR_TOWER_PORT ?? 4222);
const value = 'https://example.com/tokyo-tower';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let fixtureServer, appServer, browser;
await mkdir(captures, { recursive: true });
await writeFile(join(directory, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/tokyo-tower/main.ts'))};`);
try {
  await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin(), dotonboriAssetPlugin()], logLevel: 'error', build: { outDir: 'dist' } });
  fixtureServer = await preview({ configFile: false, root: directory, logLevel: 'error', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
    if (message.text().startsWith('Glow comparison')) console.log(message.text()); });
  const capture = name => page.screenshot({ path: join(captures, `${name}.png`) });
  const scanner = () => page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  const decode = async (expected = value) => {
    await page.waitForFunction((expected, allowed) => {
      const source = document.querySelector('.designqr-presentation-canvas');
      if (!source) return false;
      const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f5faff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(data.data, data.width, data.height);
      if (code?.data !== expected) return false;
      const grid = code.version * 4 + 17;
      const a = code.location.topLeftFinderPattern, b = code.location.topRightFinderPattern, c = code.location.bottomLeftFinderPattern;
      for (let r = 0; r < grid; r++) for (let col = 0; col < grid; col++) {
        if (Math.abs(r + .5 - grid / 2) < grid * .1 + 1 && Math.abs(col + .5 - grid / 2) < grid * .1 + 1) continue;
        const x = Math.floor(a.x + (col - 3) * (b.x - a.x) / (grid - 7) + (r - 3) * (c.x - a.x) / (grid - 7));
        const y = Math.floor(a.y + (col - 3) * (b.y - a.y) / (grid - 7) + (r - 3) * (c.y - a.y) / (grid - 7));
        const offset = (y * canvas.width + x) * 4;
        if (!allowed.includes(Array.from(data.data.slice(offset, offset + 3)).join(','))) return false;
      }
      return true;
    }, { timeout: 10000, polling: 200 }, expected,
    [DESIGN_QR_THEME_PRESETS.shibuya.groundColor, ...DESIGN_QR_THEME_PRESETS.shibuya.qrFoliagePaletteColors]
      .map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',')));
  };
  await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.towerFixture?.ready());
  await page.evaluate(() => window.towerFixture.pause()); await scanner();
  const initial = await page.evaluate(() => window.towerFixture.snapshot());
  console.log('Tokyo Tower inventory:', initial);
  assert.ok(initial.parts > 2000 && initial.faces > initial.parts * 6); assert.equal(initial.calls, 1);
  assert.ok(await page.evaluate(() => window.towerFixture.glowDifference()) > 100, 'Night floodlights must cast visible soft glow.');
  for (const progress of [0, .15, .35, .55, .75, .94, 1, .75, .35, 0]) {
    const state = await page.evaluate(p => window.towerFixture.progress(p), progress);
    assert.equal(state.mesh, initial.mesh, 'A replacement QR mesh appeared.');
    assert.equal(state.geometry, initial.geometry, 'A turn allocated geometry.');
    assert.deepEqual(state.memory, initial.memory); assert.equal(state.calls, 1);
    assert.ok(Object.values(state.bounds).every(n => Math.abs(n) < 1), `Clipped at ${progress}: ${JSON.stringify(state.bounds)}`);
    assert.ok(state.groundBounds.minX < -.4 && state.groundBounds.maxX > .4
      && state.groundBounds.minZ < -.4 && state.groundBounds.maxZ > .4, `Ground shrank into a corner at ${progress}.`);
    assert.ok(state.groundBounds.maxY < .003, 'Ground must remain beneath the falling tower.');
    if (progress >= .75) assert.equal(await page.evaluate(() => window.towerFixture.glowDifference()), 0, 'Glow must not change QR pixels.');
    await capture(`morph-${progress}`);
    if (progress === 1) {
      await page.evaluate(() => window.towerFixture.set({ view: 'qr' })); await pause(300);
      await page.evaluate(() => window.towerFixture.progress(1)); await decode();
    }
  }
  await page.evaluate(() => window.towerFixture.set({ view: 'design' })); await pause(300);
  await page.evaluate(() => window.towerFixture.progress(0));
  for (let i = 0; i < 8; i++) {
    const state = await page.evaluate(yaw => window.towerFixture.angle(yaw), Math.PI / 4 + i * Math.PI / 4);
    assert.ok(Object.values(state.bounds).every(n => Math.abs(n) < 1));
    if (i % 2 === 0) await capture(`orbit-${i}`);
  }
  // Keep a large, actual browser-rendered night reference beside Blender's
  // separate review render, so source-light changes can be assessed honestly.
  await page.evaluate(() => window.towerFixture.set({ style: { width: 880, height: 960 }, details: { border: false } }));
  await pause(350); await page.evaluate(() => window.towerFixture.angle(Math.PI / 4));
  await page.$eval('.designqr-root', element => element.blur());
  await (await page.$('.designqr-presentation-canvas')).screenshot({ path: join(captures, 'runtime-night.png') });
  await page.evaluate(() => window.towerFixture.set({ transparentBackground: true }));
  assert.equal(await page.evaluate(() => window.towerFixture.glowDifference()), 0, 'Transparent artwork must not acquire a dark atmospheric halo.');
  await page.evaluate(() => window.towerFixture.set({ transparentBackground: false }));
  await page.evaluate(() => window.towerFixture.set({ style: undefined, details: { border: {} } }));
  await pause(200);
  await page.evaluate(() => window.towerFixture.progress(.45));
  await page.evaluate(() => window.towerFixture.set({ value: 'a'.repeat(200) })); await pause(300);
  await page.evaluate(() => window.towerFixture.set({ view: 'qr' })); await pause(200);
  const edited = await page.evaluate(() => window.towerFixture.progress(1));
  assert.equal(edited.cells, 57 ** 2); await decode('a'.repeat(200));
  await page.evaluate(() => window.towerFixture.set({ value: 'https://example.com/tokyo-tower' })); await pause(150);
  await page.evaluate(() => window.towerFixture.progress(1)); await decode();
  const logo = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d'); c.fillStyle = '#eed883'; c.fillRect(12, 12, 104, 104);
    c.fillStyle = '#1f3a52'; c.font = 'bold 50px sans-serif'; c.fillText('T', 47, 84); return canvas.toDataURL();
  });
  await page.evaluate(src => window.towerFixture.set({ logo: { src, size: .2, alt: 'Tower test logo' } }), logo);
  await pause(350); await page.evaluate(() => window.towerFixture.progress(1)); await decode();
  await capture('maximum-logo');
  const exported = await page.evaluate(() => window.towerFixture.exported());
  await writeFile(join(captures, 'react-export.png'), Buffer.from(exported));
  const exportScan = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const c = canvas.getContext('2d'); c.fillStyle = '#f5faff'; c.fillRect(0, 0, canvas.width, canvas.height); c.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, canvas.width, canvas.height)?.data;
  }, exported);
  assert.equal(exportScan, value, 'Exported PNG did not decode with the maximum logo.');
  await page.evaluate(() => window.towerFixture.dispose());
  assert.equal(await page.$('.designqr-root'), null);

  appServer = await preview({ configFile: false, root, logLevel: 'error', preview: { host: '127.0.0.1', port: port + 1, strictPort: true } });
  const origin = `http://127.0.0.1:${port + 1}`;
  const url = (route, overrides = {}) => {
    const config = normalizeDesignQRConfig({ value, design: 'city', theme: 'tokyo-tower', interaction: { motionBlur: false }, ...overrides });
    return route === '/qr/embed' ? createDesignQREmbedUrl(config, { origin, instanceId: 'tower-smoke' }) : `${origin}${route}?q=${encodeDesignQRConfig(config)}`;
  };
  const chip = '[aria-label="City theme"] button:nth-child(3)';
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(url('/qr'), { waitUntil: 'networkidle0' }); await scanner();
    await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
    assert.equal(await page.$eval(chip, b => b.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval(chip, b => b.textContent), '東京タワー');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await capture(`editor-${width}-3d`);
    await page.click('[title="2D QR"]'); await decode(); await capture(`editor-${width}-qr`);
    await page.click('[aria-label="Share link"]'); await page.click('[data-share-mode="react"]');
    await page.click('[data-react-example="advanced"]'); assert.match(await page.$eval('.react-code', c => c.textContent), /theme="tokyo-tower"/);
    await page.click('[aria-label="Close share dialog"]');
    console.log(`Tokyo Tower editor ${width}×${height}: selection, 3D, QR, and share passed.`);
  }
  for (const transparentBackground of [false, true]) for (const border of [false, {}]) {
    await page.goto(url('/qr/embed', { view: { initial: 'qr' }, transparentBackground, details: { border } }), { waitUntil: 'networkidle0' });
    await scanner(); await decode();
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(url('/qr', { interaction: { transitionSpeed: .25, motionBlur: false } }), { waitUntil: 'networkidle0' });
  await scanner(); await page.click('[title="2D QR"]'); await pause(450); await page.click('[title="3D City"]'); await pause(350);
  await page.click('[title="2D QR"]'); await decode();
  assert.deepEqual(errors, []);
  console.log(`Tokyo Tower persistent geometry, all turn poses, orbit, content edits, React export, editor, iframe, transparency, Border, and reversal passed. Captures: ${captures}`);
} finally {
  await browser?.close(); await fixtureServer?.httpServer.close(); await appServer?.httpServer.close();
}
