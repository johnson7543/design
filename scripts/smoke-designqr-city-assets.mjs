import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { encodeDesignQRConfig, normalizeDesignQRConfig } from 'designqr/config';
import { resolveViewTransitionProgress, VIEW_TRANSITION_DURATION_SECONDS } from '../packages/designqr/src/designs/tree/constants.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const consumer = process.env.DESIGNQR_CITY_ASSET_CONSUMER;
const captures = process.env.DESIGNQR_CITY_ASSET_CAPTURES;
const port = Number(process.env.DESIGNQR_CITY_ASSET_PORT ?? 4210);
const origin = `http://127.0.0.1:${port}`, base = consumer ? '/city-consumer/' : '/';
const args = ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
if (consumer) args.push('--outDir', join(consumer, 'dist'), '--base', base);
const preview = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let previewLog = '';
preview.stdout.on('data', chunk => { previewLog += chunk; });
preview.stderr.on('data', chunk => { previewLog += chunk; });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin + base)).ok) break; } catch { /* starting */ }
    if (attempt > 100 || preview.exitCode !== null) throw new Error(`Asset preview did not start: ${previewLog}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), requests = [], errors = [];
  await page.evaluateOnNewDocument(() => {
    window.cityGpu = [];
    const contexts = new WeakMap();
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const resource of ['Buffer', 'Texture']) {
        const create = prototype['create' + resource], remove = prototype['delete' + resource];
        prototype['create' + resource] = function (...args) {
          if (!contexts.has(this)) { const counts = { Buffer: new Set(), Texture: new Set() }; contexts.set(this, counts); window.cityGpu.push(counts); }
          const value = create.apply(this, args); if (value) contexts.get(this)[resource].add(value); return value;
        };
        prototype['delete' + resource] = function (value) { contexts.get(this)?.[resource].delete(value); return remove.call(this, value); };
      }
    }
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    requests.push(request.url());
    void (new URL(request.url()).origin === origin || request.url().startsWith('data:') ? request.continue() : request.abort());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  const treeConfig = normalizeDesignQRConfig({ value: 'https://example.com/shibuya', design: 'tree', interaction: { motionBlur: false } });
  await page.goto(consumer ? origin + base : `${origin}/qr?q=${encodeDesignQRConfig(treeConfig)}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.designqr-presentation-canvas');
  if (consumer) {
    assert.equal(await page.$$eval('style[data-designqr-core-styles]', styles => styles.length), 1,
      'The installed component must load core styles without a CSS import.');
    assert.equal(await page.$eval('.designqr-webgl-canvas', canvas => getComputedStyle(canvas).opacity), '0');
  }
  assert.equal(requests.some(url => /(?:Shibuya|Dotonbori|TokyoTower)Scene-|(?:shibuya|dotonbori)-asset-data|GLTFLoader/.test(url)), false, 'Tree downloaded an unused City implementation/model.');
  if (consumer) await page.evaluate(() => window.fixture.update({ design: 'city', }));
  else {
    await page.click('.design-type-tabs button:nth-child(2)');
  }
  await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready', { timeout: 20000 });
  assert.equal(requests.filter(url => /shibuya-asset-data/.test(url)).length, 1, 'Asset data was not lazy-loaded once.');
  assert.equal(requests.some(url => /(?:Dotonbori|TokyoTower)Scene-|dotonbori-asset-data/.test(url)), false, 'Shibuya loaded another city.');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (captures) {
    await mkdir(captures, { recursive: true });
    await page.screenshot({ path: join(captures, `${consumer ? 'consumer' : 'editor'}-city.png`) });
  }
  await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  if (consumer) await page.evaluate(() => window.fixture.first.current.setView('qr'));
  else await page.click('[title="2D QR"]');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.designqr-presentation-canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data === 'https://example.com/shibuya';
  });
  const decode = async (target, expected, selector = '.designqr-presentation-canvas') => {
    await target.waitForFunction((expected, selector) => {
      const source = document.querySelector(selector), canvas = document.createElement('canvas');
      canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e8ddcf'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(pixels.data, pixels.width, pixels.height)?.data === expected;
    }, { timeout: 15000 }, expected, selector);
  };
  const frame = (target, selector = '.designqr-presentation-canvas') => target.$eval(selector, canvas => canvas.toDataURL());
  if (consumer) {
    const gpuCounts = () => page.evaluate(() => window.cityGpu.reduce((n, c) => ({ buffers: n.buffers + c.Buffer.size, textures: n.textures + c.Texture.size }), { buffers: 0, textures: 0 }));
    const settledQr = await frame(page);
    await page.evaluate(() => window.fixture.update({ value: 'Shibuya temporary' }));
    await decode(page, 'Shibuya temporary');
    await page.evaluate(() => window.fixture.update({ value: 'https://example.com/shibuya' }));
    await decode(page, 'https://example.com/shibuya');
    assert.equal(await frame(page), settledQr, 'Restoring the content changed the exact QR endpoint.');
    await page.evaluate(() => { window.fixture.first.current.setView('design'); });
    await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'ready');
    const stableResources = await gpuCounts();
    for (let i = 0; i < 6; i++) {
      await page.evaluate(i => window.fixture.update({ value: `Shibuya / ${i}` }), i);
      await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'ready');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    const afterEdits = await gpuCounts();
    assert.ok(afterEdits.buffers <= stableResources.buffers + 2 && afterEdits.textures <= stableResources.textures + 1,
      `Live edits leak GPU resources: ${JSON.stringify({ stableResources, afterEdits })}`);
    const logos = await page.evaluate(() => ['#ea6157', '#436ea4'].map((color, i) => {
      const canvas = document.createElement('canvas'); canvas.width = i ? 72 : 160; canvas.height = 80;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(6, 6, canvas.width - 12, 68);
      ctx.fillStyle = '#e8ddcf'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(i ? 'B' : 'A', canvas.width / 2, 56);
      return { src: canvas.toDataURL(), size: .16 };
    }));
    await page.evaluate(logos => window.fixture.update({ value: 'https://example.com/shibuya', logo: logos[0], secondLogo: logos[1], second: true }), logos);
    await page.waitForFunction(() => document.querySelectorAll('.designqr-webgl-canvas[data-city-assets="ready"]').length === 2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const second = await frame(page, '.second .designqr-presentation-canvas');
    await page.evaluate(logo => window.fixture.update({ logo }), logos[1]);
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(await frame(page, '.second .designqr-presentation-canvas'), second, 'Replacing one logo modified another player.');
    await page.evaluate(() => window.fixture.update({ show: false }));
    await page.waitForFunction(() => !document.querySelector('.first'));
    assert.equal(await frame(page, '.second .designqr-presentation-canvas'), second, 'Disposing one player destroyed shared GPU resources.');
    await page.evaluate(() => window.fixture.second.current.setView('qr')); await decode(page, 'https://example.com/second', '.second .designqr-presentation-canvas');
    await page.evaluate(() => window.fixture.update({ show: true, second: false, logo: false, value: 'https://example.com/' + 'tokyo/'.repeat(32),
      transparentBackground: true, details: { title: 'Shibuya City', showValue: true, border: true } }));
    await page.waitForFunction(() => document.querySelector('.first .designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
    await page.evaluate(() => window.fixture.first.current.setView('qr'));
    await decode(page, 'https://example.com/' + 'tokyo/'.repeat(32));
    const exported = await page.evaluate(async () => {
      const blob = await window.fixture.first.current.exportImage(), bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { value: window.jsQR(pixels.data, pixels.width, pixels.height)?.data, alpha: pixels.data[3], bytes: blob.size };
    });
    assert.equal(exported.value, 'https://example.com/' + 'tokyo/'.repeat(32)); assert.equal(exported.alpha, 0);
    assert.equal(await page.evaluate(() => window.fixtureError), undefined);
    console.log(`Installed consumer: content-driven QR, dense transparent PNG, independent logos/disposal, stable GPU resources ${JSON.stringify(afterEdits)}.`);

    // Advance the existing performance clock, not an alternate renderer/API.
    // Inverting the shared easing lets software WebGL inspect exact morph poses.
    const elapsedFor = progress => {
      let low = 0, high = 1;
      for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (resolveViewTransitionProgress(mid) < progress) low = mid; else high = mid; }
      return progress === 0 ? 0 : progress === 1 ? 1 : (low + high) / 2;
    };
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    for (const [label, value, logo] of [['logo', 'Shibuya', logos[0]], ['dense', 'https://example.com/' + 'tokyo/'.repeat(32), false]]) {
      await page.evaluate(({ value, logo }) => { window.fixture.update({ value, logo, details: {}, transparentBackground: true }); window.fixture.first.current.setView('design'); }, { value, logo });
      await page.waitForFunction(() => document.querySelector('.first .designqr-webgl-canvas').dataset.cityAssets === 'ready');
      await new Promise(resolve => setTimeout(resolve, 900));
      let baseTime = await page.evaluate(() => {
        window.cityRealNow = performance.now.bind(performance); window.cityTime = performance.now();
        performance.now = () => window.cityTime; return window.cityTime;
      });
      try {
        for (const reverse of [false, true]) {
          await page.evaluate(view => window.fixture.first.current.setView(view), reverse ? 'design' : 'qr');
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          let previous;
          for (const progress of reverse ? [1, .9, .75, .5, .25, .1, 0] : [0, .1, .25, .5, .75, .9, 1]) {
            await page.evaluate(time => { window.cityTime = time; }, baseTime + elapsedFor(reverse ? 1 - progress : progress) * VIEW_TRANSITION_DURATION_SECONDS * 1000);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const pixels = await frame(page);
            assert.ok(pixels.length > 10000 && pixels !== previous, 'The City morph froze or lost its artwork.'); previous = pixels;
            if (captures) await page.screenshot({ path: join(captures, `morph-${label}-${reverse ? 'reverse' : 'forward'}-${progress}.png`) });
          }
          if (!reverse) await decode(page, value);
          baseTime += VIEW_TRANSITION_DURATION_SECONDS * 1000;
        }
      } finally { await page.evaluate(() => { performance.now = window.cityRealNow; }); }
    }
    const bounds = await page.$eval('.first', el => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    for (const angle of ['side', 'rear']) {
      await page.mouse.move(bounds.x, bounds.y); await page.mouse.down();
      await page.mouse.move(bounds.x + 160, bounds.y, { steps: 10 }); await page.mouse.up();
      if (captures) await page.screenshot({ path: join(captures, `city-${angle}.png`) });
    }
    console.log('Installed consumer: exact forward/reverse morph poses 0, .1, .25, .5, .75, .9, 1; logo and dense QR decode; orbit views passed.');

    // Qualify Tokyo Tower through the same installed tarball and non-root host.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const towerValue = 'https://example.com/tokyo-tower';
    await page.evaluate(({ value, logo }) => window.fixture.update({ design: 'city', theme: 'tokyo-tower',
      value, logo, second: true, secondTheme: 'tokyo-tower', secondLogo: logo,
      transparentBackground: true, details: { border: true } }), { value: towerValue, logo: logos[0] });
    await page.waitForFunction(() => document.querySelector('main')?.dataset.theme === 'tokyo-tower' && document.querySelectorAll('.designqr-webgl-canvas[data-city-assets="ready"]').length === 2);
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.evaluate(() => { window.fixture.first.current.pause(); window.fixture.second.current.pause(); });
    const secondTower = await frame(page, '.second .designqr-presentation-canvas');
    for (const logo of [logos[1], false]) {
      await page.evaluate(logo => window.fixture.update({ logo }), logo);
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal(await frame(page, '.second .designqr-presentation-canvas'), secondTower,
        'Tokyo Tower logo edits changed another instance.');
    }
    for (const view of ['qr', 'design', 'qr']) {
      await page.evaluate(view => window.fixture.first.current.setView(view), view);
      await new Promise(resolve => setTimeout(resolve, 250));
      if (view === 'qr') await decode(page, towerValue);
      if (captures) await page.screenshot({ path: join(captures, `tokyo-tower-${view}.png`) });
    }
    const towerExport = await page.evaluate(async () => {
      const blob = await window.fixture.first.current.exportImage();
      const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
    });
    assert.equal(towerExport, towerValue, 'Installed Tokyo Tower PNG must decode.');
    await page.evaluate(() => window.fixture.update({ show: false }));
    await page.waitForFunction(() => !document.querySelector('.first'));
    assert.equal(await frame(page, '.second .designqr-presentation-canvas'), secondTower,
      'Disposing Tokyo Tower changed another instance.');
    await page.evaluate(() => window.fixture.second.current.setView('qr'));
    await decode(page, 'https://example.com/second', '.second .designqr-presentation-canvas');
    await page.evaluate(() => window.fixture.update({ second: false }));
    await page.waitForFunction(() => !document.querySelector('.designqr-root'));
    assert.equal(await page.evaluate(() => window.fixtureError), undefined, 'Tokyo Tower reported a player error.');
    console.log('Installed Tokyo Tower: two instances, logo replacement/removal, both views, PNG decode and disposal passed.');

    for (const mode of ['delayed', 'failed', 'disposed']) {
      const target = await browser.newPage(); let release;
      await target.setCacheEnabled(false);
      await target.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await target.setViewport({ width: 600, height: 600, deviceScaleFactor: 1 });
      await target.setRequestInterception(true);
      target.on('pageerror', error => errors.push(error.message));
      target.on('request', request => {
        if (/shibuya-asset-data/.test(request.url())) {
          if (mode === 'failed') void request.abort(); else release = () => request.continue();
        } else void request.continue();
      });
      await target.goto(origin + base, { waitUntil: 'networkidle0' });
      await target.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
      await target.evaluate(() => window.fixture.update({ design: 'city', }));
      await target.waitForFunction(() => ['loading', 'error'].includes(document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets));
      assert.ok((await frame(target)).length > 10000, 'The street and station details should render while models load.');
      if (mode === 'failed') {
        await target.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'error');
        await target.evaluate(() => window.fixture.first.current.setView('qr')); await decode(target, 'https://example.com/shibuya');
      } else {
        for (let attempt = 0; !release && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(release, 'Asset request was not intercepted.');
        if (mode === 'disposed') {
          await target.evaluate(() => window.fixture.update({ design: 'tree' }));
          await target.waitForFunction(() => !document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets);
          // Finish Tree's existing spawn/size handoff before testing late completion.
          await new Promise(resolve => setTimeout(resolve, 1600));
          await target.evaluate(() => window.fixture.first.current.pause());
          const tree = await frame(target); await release(); await new Promise(resolve => setTimeout(resolve, 500));
          assert.ok(await frame(target) === tree, 'Late assets attached to a replaced Tree scene.');
          assert.equal(await target.$eval('.designqr-webgl-canvas', canvas => canvas.dataset.cityAssets), undefined);
        } else {
          await target.evaluate(() => window.fixture.first.current.pause()); const paused = await frame(target);
          await release(); await new Promise(resolve => setTimeout(resolve, 500));
          assert.equal(await frame(target), paused, 'Loading mutated a paused scene.');
          await target.evaluate(() => window.fixture.first.current.setView('qr'));
          // setView is React state: let that view commit before resuming the clock.
          await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await target.evaluate(() => window.fixture.first.current.resume());
          await decode(target, 'https://example.com/shibuya');
          assert.equal(await target.$eval('.designqr-webgl-canvas', canvas => canvas.dataset.cityAssets), 'ready', 'Models must prepare behind the hidden city for the return to 3D.');
          await target.evaluate(() => window.fixture.update({ value: 'New content during asset loading' }));
          await decode(target, 'New content during asset loading');
          await target.evaluate(() => window.fixture.first.current.setView('design'));
          await target.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'ready');
        }
      }
      await target.close(); console.log(`Installed consumer ${mode} asset loading passed.`);
    }
  } else {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.click('[title="3D City"]');
      await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'ready');
      const layout = await page.evaluate(() => {
        const row = document.querySelector('.city-preset-row').getBoundingClientRect();
        const controls = [...document.querySelectorAll('.city-preset-row button')].map(button => button.getBoundingClientRect());
        return document.documentElement.scrollWidth <= innerWidth && controls.every(b => b.left >= row.left && b.right <= row.right + 1)
          && controls.every((b, i) => !i || b.left >= controls[i - 1].right);
      });
      assert.equal(layout, true, `${width}px City preset overflows its control row.`);
      assert.equal(await page.$$eval('.city-preset-row button', buttons => buttons.length), 1);
      await page.focus('.city-theme-tabs .season-chip'); await page.keyboard.press('Space');
      assert.equal(await page.$eval('.city-theme-tabs .season-chip', button => button.matches(':focus-visible') && button.getAttribute('aria-pressed') === 'true'), true);
      if (captures) await page.screenshot({ path: join(captures, `editor-city-${width}-3d.png`) });
      await page.click('[title="2D QR"]'); await decode(page, 'https://example.com/shibuya');
      if (captures) await page.screenshot({ path: join(captures, `editor-city-${width}-qr.png`) });
    }
    console.log('Editor: City preset and both views fit 1440×900, 390×844 and 320×568.');
  }
  assert.deepEqual(errors, [], 'Shibuya City has browser/GLSL errors.');
  if (captures) await writeFile(join(captures, `${consumer ? 'consumer' : 'editor'}-asset-validation.json`), JSON.stringify({
    installedConsumer: Boolean(consumer), base, unusedCityLazyLoading: 'passed', assetsReady: 'passed', qrDecode: 'passed', errors,
    assetRequests: requests.filter(url => /shibuya-asset-data|GLTFLoader/.test(url)),
  }, null, 2));
  console.log(`${consumer ? 'Installed non-root consumer' : 'Editor'}: Tree defers all City implementations/models; selected City assets load; QR decodes; no browser/GLSL errors.`);
} finally { await browser?.close(); preview.kill(); }
