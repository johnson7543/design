import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';

// Consume the built public package, not the editor's internal source alias.
const root = fileURLToPath(new URL('fixtures/city-assets-consumer', import.meta.url));
const output = await mkdtemp(join(tmpdir(), 'designqr-package-zoom-'));
await build({ configFile: false, root, logLevel: 'warn', build: { outDir: output, emptyOutDir: false } });
const server = await preview({ configFile: false, root, build: { outDir: output },
  preview: { host: '127.0.0.1', port: Number(process.env.DESIGNQR_PACKAGE_ZOOM_PORT ?? 4192), strictPort: true } });
const origin = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const requests = [], errors = [];
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const pixels = page => page.$eval('.first .designqr-presentation-canvas', canvas => canvas.toDataURL());
const samePng = async (actual, expected, label) => {
  if (actual !== expected) {
    await writeFile(join(output, 'actual.png'), Buffer.from(actual.split(',')[1], 'base64'));
    await writeFile(join(output, 'expected.png'), Buffer.from(expected.split(',')[1], 'base64'));
  }
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(actual), hash(expected), `${label}; captures: ${output}`);
};
const exportPng = (page, resetBeforeCapture = false) => page.evaluate(async resetBeforeCapture => {
  const ref = window.fixture.first.current;
  if (resetBeforeCapture) { ref.resume(); ref.resetZoom(); }
  const pending = ref.exportImage();
  if (resetBeforeCapture) ref.pause();
  const blob = await pending;
  return new Promise(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob);
  });
}, resetBeforeCapture);
const metrics = page => page.evaluate(() => {
  const root = document.querySelector('.first'), canvas = root.querySelector('.designqr-webgl-canvas');
  return { width: canvas.width, height: canvas.height, contexts: window.zoomGpu.size, clears: window.zoomClears,
    scale: Number(root.dataset.zoomScale ?? 1), transform: getComputedStyle(root.querySelector('.designqr-presentation-canvas')).transform };
});
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    requests.push(request.url());
    void (request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  });
  await page.evaluateOnNewDocument(() => {
    window.zoomGpu = new Set(); window.zoomClears = 0;
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = native.call(this, type, ...args);
      if (context && (type === 'webgl' || type === 'webgl2')) window.zoomGpu.add(context);
      return context;
    };
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const clear = prototype.clear;
      prototype.clear = function (...args) {
        // City's QR overlay also clears depth; count complete scene color passes.
        if (args[0] & this.COLOR_BUFFER_BIT) window.zoomClears++;
        return clear.apply(this, args);
      };
    }
  });
  await page.setViewport({ width: 640, height: 800, deviceScaleFactor: 2, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(origin, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.fixture?.first.current);
  await frame(page);
  await page.evaluate(() => window.fixture.first.current.pause());
  const original = await pixels(page), base = await metrics(page);
  assert.equal(requests.some(url => /PreviewZoomController/.test(url)), false, 'Default imports must not load gesture code.');
  assert.equal(await page.$('[data-zoom-ready]'), null);
  await page.evaluate(() => {
    window.fixture.first.current.setZoom(3);
    document.querySelector('.first').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  });
  assert.equal(await pixels(page), original, 'Zoom is opt-in, including the imperative API.');
  assert.deepEqual(await metrics(page), base);
  await page.evaluate(() => window.fixture.update({ zoom: { pinch: true, wheel: false } }));
  await page.waitForSelector('.first[data-zoom-ready="true"]');
  assert.equal(requests.filter(url => /PreviewZoomController/.test(url)).length, 1);
  assert.equal(await page.$('.first button'), null, 'The package must add no toolbar.');
  const wheelConsumed = await page.$eval('.first', element => !element.dispatchEvent(new WheelEvent('wheel', {
    deltaY: -100, bubbles: true, cancelable: true,
  })));
  assert.equal(wheelConsumed, false, 'Pinch-only players must leave ordinary wheel scrolling alone.');

  // Gesture handling is instance-local, and a real pinch cannot become a tap.
  const client = await page.createCDPSession();
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const bounds = await page.$eval('.first', element => {
    const r = element.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const touch = (id, offset) => ({ id, x: bounds.x + offset, y: bounds.y, radiusX: 4, radiusY: 4, force: 1 });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, -30)] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, -30), touch(2, 30)] });
  for (let i = 1; i <= 4; i++) await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [touch(1, -30 - i * 9), touch(2, 30 + i * 9)],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await metrics(page)).scale > 2, 'The public package must support native two-finger pinch.');
  assert.equal(await page.$('.first.view-scan'), null);
  await page.evaluate(() => window.fixture.first.current.resetZoom());
  assert.equal(await pixels(page), original, 'Paused pinch/reset must not advance animation or rotate the scene.');
  await client.detach();

  for (const design of ['tree', 'city']) {
    await page.evaluate(design => {
      window.fixture.first.current.resetZoom(); window.fixture.first.current.resume();
      window.fixture.update({ design, details: { title: 'Sharp QR', showValue: true, border: true } });
      window.fixture.first.current.setView('design');
    }, design);
    if (design === 'city') await page.waitForFunction(() => document.querySelector('.first .designqr-webgl-canvas').dataset.cityAssets === 'ready');
    await frame(page);
    for (const view of ['design', 'qr']) {
      await page.evaluate(view => {
        window.fixture.first.current.resetZoom(); window.fixture.first.current.setView(view);
      }, view);
      await frame(page);
      await page.evaluate(() => window.fixture.first.current.pause());
      const baseline = await pixels(page), before = await metrics(page);
      await page.evaluate(() => window.fixture.first.current.setZoom(3));
      const zoomed = await pixels(page), after = await metrics(page);
      assert.notEqual(zoomed, baseline, 'Zoom must rerasterize visible pixels.');
      assert.equal(after.scale, 3); assert.equal(after.transform, 'none');
      assert.equal(after.width, before.width); assert.equal(after.height, before.height);
      assert.equal(after.contexts, before.contexts, 'Zoom must not allocate another WebGL context.');
      assert.equal(after.clears - before.clears, 1, 'Paused zoom needs only one render, not a second export pass.');
      await samePng(await exportPng(page), baseline, `${design}/${view}: PNG framing or pixels changed.`);
      assert.equal(await pixels(page), zoomed, 'Export must not visibly flash the original framing.');
      assert.equal((await metrics(page)).clears - after.clears, 2, 'Only a zoomed download renders and restores the canonical source.');
      if (view === 'qr') {
        const sharpness = await page.evaluate(async baseline => {
          const source = document.querySelector('.first .designqr-presentation-canvas');
          // Read a copy: repeated getImageData on the live presentation makes
          // Chromium switch its compositor to CPU, changing gradient dithering.
          const fresh = document.createElement('canvas'); fresh.width = source.width; fresh.height = source.height;
          fresh.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0);
          const bitmap = await createImageBitmap(await (await fetch(baseline)).blob());
          const old = document.createElement('canvas'); old.width = source.width; old.height = source.height;
          const context = old.getContext('2d');
          context.translate(old.width / 2, old.height / 2); context.scale(3, 3);
          context.drawImage(bitmap, -old.width / 2, -old.height / 2); bitmap.close();
          const edgeEnergy = canvas => {
            const { data } = canvas.getContext('2d').getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1);
            let squared = 0, total = 0;
            for (let i = 4; i < data.length; i += 4) {
              const delta = Math.abs(data[i] - data[i - 4]) + Math.abs(data[i + 1] - data[i - 3]) + Math.abs(data[i + 2] - data[i - 2]);
              squared += delta * delta; total += delta;
            }
            return squared / Math.max(1, total);
          };
          return { raster: edgeEnergy(fresh), bitmap: edgeEnergy(old) };
        }, baseline);
        assert.ok(sharpness.raster > sharpness.bitmap * 1.3, `3x edges must be sharper than bitmap magnification: ${JSON.stringify(sharpness)}`);
        console.log(`${design}: 3x edge-energy ratio ${(sharpness.raster / sharpness.bitmap).toFixed(2)}, same ${after.width}×${after.height} buffer.`);
      }
      await page.evaluate(() => window.fixture.first.current.resetZoom());
      await samePng(await pixels(page), baseline, `${design}/${view}: reset must restore the exact paused frame.`);
    }
  }
  // Compare render-pass counts over the same number of animation frames.
  const sample = scale => page.evaluate(async scale => {
    const ref = window.fixture.first.current; ref.setZoom(scale); ref.resume();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const before = window.zoomClears;
    for (let i = 0; i < 12; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    const passes = window.zoomClears - before; ref.pause(); return passes;
  }, scale);
  const normalPasses = await sample(1), zoomPasses = await sample(3);
  assert.equal(zoomPasses, normalPasses, 'Zoom must not add a per-frame export render pass.');
  assert.ok(normalPasses >= 12 && normalPasses <= 13);
  const previewTransform = () => page.$eval('.first', e => [e.dataset.zoomScale, e.dataset.zoomX, e.dataset.zoomY]);
  const beforeRotationReset = await previewTransform();
  await page.evaluate(() => window.fixture.first.current.resetRotation());
  assert.deepEqual(await previewTransform(), beforeRotationReset,
    'The package rotation reset stays independent; only the editor combines it with zoom/pan reset.');
  const beforeReset = await exportPng(page);
  await samePng(await exportPng(page, true), beforeReset,
    'Reset then export in the same task must not capture the previous zoomed source frame.');
  await page.evaluate(() => window.fixture.update({ second: true, transparentBackground: true }));
  await page.waitForSelector('.second .designqr-presentation-canvas');
  await frame(page);
  await page.evaluate(() => { window.fixture.first.current.pause(); window.fixture.second.current.pause(); });
  const secondPixels = await page.$eval('.second .designqr-presentation-canvas', canvas => canvas.toDataURL());
  await page.evaluate(() => window.fixture.first.current.resetZoom());
  // Compare the same PNG API on both sides. Chromium's toDataURL diagnostic
  // encoder can round translucent RGB by one level compared with toBlob.
  const transparentExport = await exportPng(page);
  assert.equal(await page.evaluate(async png => {
    const bitmap = await createImageBitmap(await (await fetch(png)).blob());
    const copy = document.createElement('canvas'); copy.width = bitmap.width; copy.height = bitmap.height;
    const context = copy.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    return context.getImageData(0, 0, 1, 1).data[3];
  }, transparentExport), 0, 'Transparent exports must preserve their outside alpha.');
  await page.evaluate(() => window.fixture.first.current.setZoom(2));
  const transparentPreview = await pixels(page);
  await samePng(await exportPng(page), transparentExport, 'Transparent zoomed export must keep alpha and details.');
  await samePng(await pixels(page), transparentPreview, 'Transparent export must restore the zoomed presentation.');
  assert.equal(await page.$eval('.second .designqr-presentation-canvas', canvas => canvas.toDataURL()), secondPixels,
    'Zoom/export on one instance must not change another.');
  assert.equal(await page.$('.second[data-zoom-ready]'), null);
  await page.evaluate(() => window.fixture.update({ zoom: false }));
  await page.waitForFunction(() => !document.querySelector('.first').dataset.zoomReady);
  assert.equal((await metrics(page)).scale, 1);
  assert.equal(await page.$('.designqr-can-pinch'), null);
  // Remount and call setZoom in onReady, before the lazy controller is attached.
  await page.evaluate(() => window.fixture.update({ show: false, second: false }));
  await page.waitForFunction(() => !document.querySelector('.first'));
  await page.evaluate(() => window.fixture.update({ show: true, design: 'tree', zoom: true, readyZoom: 2 }));
  await page.waitForFunction(() => document.querySelector('.first')?.dataset.zoomScale === '2');
  await frame(page);
  await page.evaluate(() => window.fixture.first.current.pause());
  const limits = await page.evaluate(() => {
    const ref = window.fixture.first.current, read = () => Number(document.querySelector('.first').dataset.zoomScale);
    ref.setZoom(99); const max = read(); ref.setZoom(NaN); return { max, reset: read(), x: document.querySelector('.first').dataset.zoomX };
  });
  assert.deepEqual(limits, { max: 3, reset: 1, x: '0' });
  assert.equal(await page.evaluate(() => window.fixtureError), undefined);
  assert.deepEqual(errors, []);
  console.log(`Package zoom passed: default-off/lazy gestures, native pinch, 3D/QR exact export, same ${normalPasses} render passes with and without zoom.`);
  await page.screenshot({ path: join(output, 'package-zoom.png') });
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
