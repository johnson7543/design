import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { encodeDesignQRConfig, normalizeDesignQRConfig } from 'designqr/config';
import { createDesignQREmbedUrl } from 'designqr/embed';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.DESIGNQR_ZOOM_PORT ?? 4191);
const origin = `http://127.0.0.1:${port}`;
const captures = process.env.DESIGNQR_ZOOM_CAPTURE_DIR ?? await mkdtemp(join(tmpdir(), 'designqr-zoom-'));
await mkdir(captures, { recursive: true });
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .find(path => path && existsSync(path));
assert.ok(chrome, 'Chrome or Chromium is required.');
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  '--outDir', process.env.PREVIEW_DIST ?? 'dist'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
});
let previewLog = '';
preview.stdout.on('data', chunk => { previewLog += chunk; });
preview.stderr.on('data', chunk => { previewLog += chunk; });
let browser;
const errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const toggle = '.floating-zoom-toggle';
const panel = '#preview-zoom-editor';
const player = '.designqr-editor-player';
const requestedWidths = new Set((process.env.DESIGNQR_ZOOM_WIDTHS ?? '1440,390,320').split(',').map(Number));

async function state(page) {
  return page.$eval('.main-viewport', element => {
    const canvas = element.querySelector('.designqr-presentation-canvas');
    const rect = canvas.getBoundingClientRect();
    const host = element.getBoundingClientRect();
    const data = element.querySelector('.designqr-root').dataset;
    const source = element.querySelector('.designqr-webgl-canvas');
    const matrix = new DOMMatrix(getComputedStyle(canvas).transform);
    return {
      scale: Number(data.zoomScale),
      x: Number(data.zoomX), y: Number(data.zoomY), matrixScale: matrix.a,
      rawStyle: element.getAttribute('style'),
      canvasStyle: canvas.getAttribute('style'),
      inheritedScale: getComputedStyle(canvas).getPropertyValue('--qr-preview-zoom'),
      transform: getComputedStyle(canvas).transform,
      width: canvas.width, height: canvas.height,
      sourceWidth: source.width, sourceHeight: source.height, contexts: window.zoomGpu.size,
      host: { width: host.width, height: host.height },
      covers: rect.left <= host.left + 1 && rect.top <= host.top + 1
        && rect.right >= host.right - 1 && rect.bottom >= host.bottom - 1,
      stage: getComputedStyle(element.querySelector('.designqr-stage-transform-probe')).transform,
      mode: document.querySelector('.app-root').classList.contains('view-scan') ? 'scan' : '3d',
      browserScale: window.visualViewport.scale,
      url: location.href,
    };
  });
}

async function reset(page, wholeView = false) {
  const mode = (await state(page)).mode;
  if (wholeView) await page.click('[aria-label="Reset view"]');
  else {
    await page.focus(player);
    await page.keyboard.press('0');
  }
  await page.waitForFunction(() => document.querySelector('.floating-zoom-toggle').title.includes('100%'));
  const view = await state(page);
  assert.equal(view.scale, 1);
  assert.equal(view.x, 0);
  assert.equal(view.y, 0);
  assert.equal(view.mode, mode, 'Reset view must keep the selected 3D / 2D mode.');
  if (wholeView) assert.equal(await page.$('[aria-label="Pause Spin"]'), null, 'Reset view stops auto spin too.');
  await page.focus(player);
}

async function checkLayout(page, width) {
  const layout = await page.evaluate(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect();
    const zoom = bounds('.floating-zoom-toggle');
    const hint = bounds('.floating-center-tools');
    const right = bounds('.floating-right-tools');
    const panel = bounds('#preview-zoom-editor');
    const input = bounds('.input-card');
    return {
      separated: zoom.right <= hint.left && hint.right <= right.left,
      centered: Math.abs((hint.left + hint.right) / 2 - innerWidth / 2) < 1,
      inside: panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0,
      overflow: document.documentElement.scrollWidth > innerWidth,
      inputTop: input.top,
      toggleWidth: zoom.width,
      panelBackground: getComputedStyle(document.querySelector('#preview-zoom-editor')).backgroundColor,
    };
  });
  assert.ok(layout.separated && layout.centered && layout.inside && !layout.overflow,
    `${width}px zoom layout: ${JSON.stringify(layout)}`);
  assert.notEqual(layout.panelBackground, 'rgba(0, 0, 0, 0)', 'The popover needs its semantic surface.');
  return layout;
}

async function pinch(page, client, width, cancel = false) {
  const start = await state(page);
  const cx = width / 2;
  const cy = 230;
  const touch = (id, x, y) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, cx - 35, cy)] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, cx - 35, cy), touch(2, cx + 35, cy)] });
  for (let i = 1; i <= 4; i++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [touch(1, cx - 35 - i * 9, cy + i * 3), touch(2, cx + 35 + i * 9, cy + i * 3)],
    });
  }
  if (cancel) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  } else {
    // Lift one finger, move the other, then lift it. None may trigger a tap or
    // resume the player's rotation. This exercises real pointer capture.
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [touch(2, cx + 71, cy + 12)] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(1, cx - 61, cy + 18)] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const next = await state(page);
  const expected = Math.min(10, start.scale * 142 / 70);
  assert.ok(Math.abs(next.scale - expected) < .1,
    `Pinch did not magnify: ${JSON.stringify(next)}; events: ${JSON.stringify(await page.evaluate(() => window.zoomPointerEvents))}`);
  assert.equal(next.mode, start.mode, 'Pinch release must not toggle the view.');
  assert.equal(next.browserScale, start.browserScale, 'Stage pinch must not scale browser chrome.');
  assert.equal(next.url, start.url, 'Preview transforms must not enter canonical config.');
  assert.equal(next.width, start.width);
  assert.equal(next.height, start.height);
  assert.equal(next.sourceWidth, start.sourceWidth);
  assert.equal(next.sourceHeight, start.sourceHeight);
  assert.equal(next.contexts, start.contexts);
  assert.equal(next.stage, start.stage, 'The export stage transform must not change.');
  assert.ok(next.covers);
  assert.equal(await page.$('.designqr-is-panning'), null, 'Pointer cancellation/release must clean up.');
  return next;
}

async function verifyExport(page, baselinePixels) {
  const before = await state(page);
  const previewPixels = await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL('image/png'));
  await page.evaluate(() => {
    window.previewExportBlob = null;
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (blob.type === 'image/png') window.previewExportBlob = blob;
      return original(blob);
    };
    document.addEventListener('click', event => {
      if (event.target.closest?.('a[download]')) event.preventDefault();
    }, true);
  });
  await page.click('[aria-label="Share link"]');
  await page.click('.share-action-item.primary');
  await page.waitForFunction(() => window.previewExportBlob, { polling: 50 });
  const exported = await page.evaluate(async () => {
    const bitmap = await createImageBitmap(window.previewExportBlob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    const png = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(window.previewExportBlob);
    });
    return { ...dimensions, png };
  });
  const zoomed = await state(page);
  assert.equal(exported.width, zoomed.width);
  assert.equal(exported.height, zoomed.height);
  assert.equal(exported.png, baselinePixels, 'Downloaded PNG must be byte-identical before and after preview zoom.');
  if (await page.$('[aria-label="Close share dialog"]')) await page.click('[aria-label="Close share dialog"]');
  await frame(page);
  const restored = await state(page);
  for (const key of ['scale', 'x', 'y', 'mode', 'width', 'height', 'contexts']) {
    assert.equal(restored[key], before[key], `Export must restore the inspected view's ${key}.`);
  }
  assert.equal(await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL('image/png')), previewPixels,
    'The visible 1000% preview must be restored, not replaced by the exported 100% frame.');
}

// Freeze scene time but keep rendering: a sharp zoom needs newly rasterized frames.
async function freezeFrames(page) {
  await page.evaluate(() => {
    window.zoomRealNow = performance.now.bind(performance);
    const now = performance.now();
    performance.now = () => now;
  });
  await frame(page);
}

async function frame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function resumeFrames(page) {
  await page.evaluate(() => { performance.now = window.zoomRealNow; });
  await frame(page);
}

async function scenePasses(page) {
  return page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const before = window.zoomClears;
    for (let i = 0; i < 12; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    return window.zoomClears - before;
  });
}

try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (preview.exitCode !== null) throw new Error(previewLog);
    try { ready = (await fetch(origin)).ok; } catch { /* Vite is starting. */ }
    if (ready) break;
    await pause(125);
  }
  assert.ok(ready, previewLog);
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ] });
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    if (!requestedWidths.has(width)) continue;
    for (const design of ['tree', 'city']) {
      // Input emulation belongs to a page: do not carry a touch session across
      // navigations or mix it with a preceding fixture's synthetic mouse state.
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
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
            if (args[0] & this.COLOR_BUFFER_BIT) window.zoomClears++;
            return clear.apply(this, args);
          };
        }
      });
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        void (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:' ? request.continue() : request.abort());
      });
      await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 640, hasTouch: width < 640 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: width === 1440 && design === 'city' ? 'no-preference' : 'reduce' }]);
      const config = normalizeDesignQRConfig({
        value: 'https://example.com/view-only', design, theme: design === 'city' ? 'shibuya' : 'spring',
        interaction: { motionBlur: false },
      });
      await page.goto(`${origin}/qr?q=${encodeDesignQRConfig(config)}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector(`${player}[data-zoom-ready="true"] .designqr-presentation-canvas`);
      if (design === 'city') await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'ready');
      await pause(200);
      const baseline = await state(page);
      assert.equal(baseline.scale, 1);
      const client = await page.createCDPSession();
      if (width < 640) {
        // Detaching a previous CDP input session resets touch emulation even
        // when Puppeteer's cached viewport dimensions have not changed.
        await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await page.evaluate(() => {
          window.zoomPointerEvents = [];
          for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
            document.addEventListener(type, event => window.zoomPointerEvents.push({
              type, id: event.pointerId, primary: event.isPrimary, target: event.target.className,
            }), true);
          }
        });
        await pinch(page, client, width);
        for (let i = 0; i < 3; i++) await pinch(page, client, width);
        assert.equal((await state(page)).scale, 10, 'Repeated finger pinches must reach 1000%.');
        const beforePan = await state(page), afterPan = await pinch(page, client, width);
        assert.equal(afterPan.scale, 10);
        assert.ok(afterPan.y > beforePan.y, 'Two fingers must still pan at the editor limit.');
        await reset(page, true);
        await pinch(page, client, width, true);
        await reset(page);
        // A normal tap must still work after a cancelled pinch.
        await page.touchscreen.tap(width / 2, 230);
        await pause(100);
        assert.equal((await state(page)).mode, 'scan', JSON.stringify(await page.evaluate(() => window.zoomPointerEvents)));
        await page.touchscreen.tap(width / 2, 230);
        assert.equal((await state(page)).mode, '3d');
      } else {
        await page.mouse.move(width / 2 + 100, 300);
        await page.mouse.wheel({ deltaY: -140 });
        await page.waitForFunction(() => Number(document.querySelector('.designqr-root').dataset.zoomScale) > 1);
        const wheel = await state(page);
        assert.ok(wheel.scale > 1 && wheel.x < 0, `Wheel zoom must anchor at the pointer: ${JSON.stringify(wheel)}`);
        await page.keyboard.down('Shift');
        await page.mouse.down();
        await page.mouse.move(width / 2 + 130, 320, { steps: 3 });
        await page.mouse.up();
        await page.keyboard.up('Shift');
        const panned = await state(page);
        assert.ok(panned.x > wheel.x && panned.y > wheel.y, 'Shift + drag must pan.');
        assert.equal(panned.mode, '3d');
        assert.equal(panned.url, baseline.url);
        await page.click('[aria-label="Auto Spin"]');
        assert.ok(await page.$('[aria-label="Pause Spin"]'));
        await reset(page, true);
        // Ctrl-wheel is how Chromium delivers trackpad pinch.
        await page.mouse.move(width / 2 + 100, 300);
        await page.keyboard.down('Control');
        for (let i = 0; i < 6; i++) await page.mouse.wheel({ deltaY: -160 });
        await page.keyboard.up('Control');
        await page.waitForFunction(() => Number(document.querySelector('.designqr-root').dataset.zoomScale) === 10);
        assert.equal((await state(page)).browserScale, baseline.browserScale);
        await reset(page);
        for (let i = 0; i < 6; i++) await page.mouse.wheel({ deltaY: -160 });
        await page.waitForFunction(() => Number(document.querySelector('.designqr-root').dataset.zoomScale) === 10);
        const beforePan = await state(page);
        await page.keyboard.down('Shift');
        await page.mouse.down();
        await page.mouse.move(width / 2 + 145, 325, { steps: 3 });
        await page.mouse.up();
        await page.keyboard.up('Shift');
        const afterPan = await state(page);
        assert.equal(afterPan.scale, 10, 'Panning must not reclamp an editor view to 300%.');
        assert.ok(afterPan.x > beforePan.x && afterPan.y > beforePan.y);
        await reset(page, true);
      }

      await freezeFrames(page);
      const designPixels = await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL('image/png'));
      const normalPasses = await scenePasses(page);
      await page.click(toggle);
      assert.equal(await page.$eval('[aria-label="Zoom preview out"]', button => button.disabled), true);
      const layout = await checkLayout(page, width);
      await page.click('[aria-label="Zoom preview in"]');
      await page.click('[aria-label="Zoom preview out"]');
      assert.equal((await state(page)).scale, 1);
      await page.click('[aria-label="Zoom preview in"]');
      await page.click('.preview-zoom-reset');
      assert.equal((await state(page)).scale, 1);
      for (let i = 0; i < 8; i++) await page.click('[aria-label="Zoom preview in"]');
      assert.equal((await state(page)).scale, 3);
      assert.equal(await page.$eval('[aria-label="Zoom preview in"]', button => button.disabled), false);
      for (let i = 0; i < 28; i++) await page.click('[aria-label="Zoom preview in"]');
      assert.equal((await state(page)).scale, 10);
      assert.equal(await page.$eval('[aria-label="Zoom preview in"]', button => button.disabled), true);
      const maxLayout = await checkLayout(page, width);
      assert.equal(maxLayout.inputTop, layout.inputTop, 'Zoom must not move the control rail.');
      assert.ok(Math.abs(maxLayout.toggleWidth - layout.toggleWidth) < .5,
        `The 1000% label must fit without growing the tool: ${layout.toggleWidth} → ${maxLayout.toggleWidth}.`);
      await page.focus(player);
      await page.keyboard.press('+');
      assert.equal((await state(page)).scale, 10);
      await page.keyboard.press('-');
      assert.equal((await state(page)).scale, 9.75);
      await page.keyboard.press('+');
      assert.equal((await state(page)).scale, 10);
      await frame(page);
      const maxView = await state(page);
      for (const key of ['width', 'height', 'sourceWidth', 'sourceHeight', 'contexts', 'stage', 'url']) {
        assert.equal(maxView[key], baseline[key], `1000% must not change ${key}.`);
      }
      assert.equal(maxView.transform, 'none', 'Zoom must rasterize, not scale the canvas with CSS.');
      assert.equal(await scenePasses(page), normalPasses, '1000% must not add scene passes per frame.');
      assert.notEqual(await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL()), designPixels);
      await page.screenshot({ path: join(captures, `${design}-${width}-3d.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await page.$(panel), null);
      assert.equal(await page.$eval(toggle, button => document.activeElement === button), true);
      await verifyExport(page, designPixels);
      if (width === 1440) {
        const viewport = page.viewport();
        await page.setViewport({ ...viewport, width: 390, height: 844 });
        await page.waitForFunction(() => document.querySelector('.designqr-root').clientWidth === 390);
        await frame(page);
        assert.equal((await state(page)).scale, 10, 'Responsive resizing must retain 1000%, not reclamp to the package ceiling.');
        assert.ok((await state(page)).covers);
        await page.setViewport(viewport);
        await frame(page);
        assert.equal((await state(page)).scale, 10);
      }
      await resumeFrames(page);
      await reset(page);
      await page.keyboard.press('Enter');
      assert.equal((await state(page)).mode, 'scan');
      await pause(800);
      const scanBaseline = await state(page);
      const pixels = await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL('image/png'));
      if (width < 640) {
        for (let i = 0; i < 4; i++) await pinch(page, client, width);
      }
      else {
        await page.focus(player);
        await page.keyboard.press('+');
        assert.equal((await state(page)).scale, 1.25);
        for (let i = 0; i < 35; i++) await page.keyboard.press('+');
      }
      const scanZoomed = await state(page);
      assert.equal(scanZoomed.scale, 10);
      assert.equal(scanZoomed.stage, scanBaseline.stage);
      assert.equal(scanZoomed.url, scanBaseline.url);
      await frame(page);
      assert.equal(scanZoomed.width, scanBaseline.width);
      assert.equal(scanZoomed.height, scanBaseline.height);
      assert.equal(scanZoomed.sourceWidth, scanBaseline.sourceWidth);
      assert.equal(scanZoomed.sourceHeight, scanBaseline.sourceHeight);
      assert.equal(scanZoomed.contexts, scanBaseline.contexts);
      assert.equal(scanZoomed.transform, 'none');
      assert.notEqual(await page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL('image/png')), pixels,
        'Sharp zoom must rerasterize the presentation, without enlarging its buffer.');
      await page.click(toggle);
      await checkLayout(page, width);
      await page.screenshot({ path: join(captures, `${design}-${width}-2d.png`) });
      await verifyExport(page, pixels);
      await reset(page, true);
      // Single-pointer dragging retains 3D rotation, never a tap-to-QR.
      await page.keyboard.press('Enter');
      await page.mouse.move(width / 2, 230);
      await page.mouse.down();
      await page.mouse.move(width / 2 + 25, 240, { steps: 4 });
      await page.mouse.up();
      assert.equal((await state(page)).mode, '3d');
      assert.equal((await state(page)).scale, 1);
      console.log(`Sharp 1000% editor zoom passed: ${design}, ${width}×${height}, 3D + 2D, PNG unchanged, ${normalPasses} scene passes / 12 frames.`);
      await client.detach();

      // The same canonical config must not opt the hosted public player into zoom.
      if (width === 1440) {
        await page.goto(createDesignQREmbedUrl(config, { origin, instanceId: 'zoom-isolation' }), { waitUntil: 'networkidle0' });
        await page.waitForSelector('.designqr-presentation-canvas');
        assert.equal(await page.$(toggle), null);
        const before = await page.$eval('.designqr-presentation-canvas', canvas => ({
          transform: getComputedStyle(canvas).transform, width: canvas.width, height: canvas.height,
        }));
        await page.mouse.move(720, 300);
        await page.mouse.wheel({ deltaY: -180 });
        assert.deepEqual(await page.$eval('.designqr-presentation-canvas', canvas => ({
          transform: getComputedStyle(canvas).transform, width: canvas.width, height: canvas.height,
        })), before, 'Hosted React player must retain its existing wheel behavior.');
      }
      await page.close();
    }
  }
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
  console.log(`Preview zoom smoke passed. Screenshots: ${captures}`);
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
