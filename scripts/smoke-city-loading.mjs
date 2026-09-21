import assert from 'node:assert/strict';
import { join } from 'node:path';
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { writeFile } from 'node:fs/promises';

const consumer = process.env.DESIGNQR_CITY_ASSET_CONSUMER;
if (!consumer) throw new Error('An installed City consumer is required.');
const root = process.cwd(), port = Number(process.env.DESIGNQR_CITY_LOADING_PORT ?? 4193);
const server = await preview({ configFile: false, root: consumer, base: '/city-consumer/',
  logLevel: 'error', preview: { host: '127.0.0.1', port, strictPort: true } });
let browser;
const results = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [preset, chunk] of [['shibuya', 'ShibuyaScene'], ['dotonbori', 'DotonboriScene'], ['tokyo-tower', 'TokyoTowerScene']]) {
    for (const mode of ['delayed', 'failed', 'disposed']) {
      const page = await browser.newPage(), requests = [], errors = [], blocked = [];
      await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 1 });
      await page.setCacheEnabled(false);
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.setRequestInterception(true);
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        requests.push(request.url());
        if (request.url().includes(chunk + '-')) {
          if (mode === 'failed') void request.abort(); else blocked.push(request);
        } else void request.continue();
      });
      await page.goto(`http://127.0.0.1:${port}/city-consumer/`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.fixture?.first.current);
      assert.equal(requests.some(url => /(?:Shibuya|Dotonbori|TokyoTower)Scene-|(?:shibuya|dotonbori)-asset-data/.test(url)), false);
      await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
      const value = `https://example.com/${preset}/loading`;
      await page.evaluate(({ preset, value }) => window.fixture.update({ design: 'city', theme: preset, value }), { preset, value });
      await page.waitForFunction(() => ['loading', 'error'].includes(document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets));
      const decode = async expected => page.waitForFunction(expected => {
        const source = document.querySelector('.designqr-presentation-canvas');
        const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return window.jsQR(pixels.data, pixels.width, pixels.height)?.data === expected;
      }, { timeout: 20000 }, expected);
      await page.evaluate(() => window.fixture.first.current.setView('qr'));
      await decode(value);
      if (mode === 'failed') {
        await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'error');
        await page.evaluate(() => window.fixture.update({ value: '日本の街 QR' }));
        await decode('日本の街 QR');
        const exported = await page.evaluate(async () => {
          const blob = await window.fixture.first.current.exportImage(), bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
        });
        assert.equal(exported, '日本の街 QR', 'Failed City code must still export a decodable PNG.');
      } else {
        for (let i = 0; !blocked.length && i < 100; i++) await wait(20);
        assert.ok(blocked.length, `${preset} chunk was not intercepted.`);
        if (mode === 'disposed') {
          await page.evaluate(() => { window.fixture.update({ design: 'tree', theme: 'spring' }); });
          await page.waitForFunction(() => !document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets);
          await page.evaluate(() => window.fixture.first.current.pause());
          const before = await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL());
          await Promise.all(blocked.map(request => request.continue())); await wait(350);
          assert.equal(await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL()), before,
            `${preset} completed into a replaced scene.`);
        } else {
          await page.evaluate(() => window.fixture.first.current.pause());
          const before = await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL());
          await Promise.all(blocked.map(request => request.continue())); await wait(350);
          assert.equal(await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL()), before,
            `${preset} completed into a paused frame.`);
          await page.evaluate(() => window.fixture.first.current.resume());
          await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready', { timeout: 30000 });
          await decode(value);
          await page.evaluate(() => window.fixture.first.current.setView('design'));
          await wait(200);
        }
      }
      assert.equal(requests.some(url => /(?:Shibuya|Dotonbori|TokyoTower)Scene-/.test(url) && !url.includes(chunk + '-')), false,
        `${preset} requested a different city's implementation.`);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => window.fixtureError), undefined);
      await page.close(); results.push({ preset, mode, result: 'passed' });
      console.log(`Installed ${preset} ${mode} code loading: QR fallback, isolation and lifecycle passed.`);
    }
  }
  if (process.env.DESIGNQR_CITY_ASSET_CAPTURES) await writeFile(join(process.env.DESIGNQR_CITY_ASSET_CAPTURES, 'city-loading.json'), JSON.stringify(results, null, 2));
} finally { await browser?.close(); server.httpServer.close(); }
