import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { decodeDesignQRConfig, encodeDesignQRConfig, normalizeDesignQRConfig } from 'designqr/config';
import { createDesignQREmbedUrl } from 'designqr/embed';
import { DESIGN_QR_THEME_PRESETS } from 'designqr';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.DESIGNQR_DOTONBORI_PORT ?? 4216), origin = `http://127.0.0.1:${port}`;
const consumer = process.env.DESIGNQR_DOTONBORI_CONSUMER;
const captures = process.env.DESIGNQR_DOTONBORI_CAPTURES ?? '/tmp/designqr-dotonbori-review';
const value = 'https://example.com/dotonbori';
const config = overrides => normalizeDesignQRConfig({ value, design: 'city', theme: 'dotonbori', interaction: { motionBlur: false }, ...overrides });
const url = (route = '/qr', overrides = {}) => route === '/qr/embed'
  ? createDesignQREmbedUrl(config(overrides), { origin, instanceId: 'dotonbori-smoke' })
  : `${origin}${route}?q=${encodeDesignQRConfig(config(overrides))}`;
const args = ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
if (consumer) args.push('--outDir', join(consumer, 'dist'), '--base', '/city-consumer/');
const preview = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser;
preview.stdout.on('data', chunk => { log += chunk; }); preview.stderr.on('data', chunk => { log += chunk; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const preset = '[aria-label="City theme"] button:nth-child(2)';
try {
  await mkdir(captures, { recursive: true });
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* starting */ }
    if (i > 80 || preview.exitCode !== null) throw new Error(log);
    await pause(100);
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    requests.push(request.url());
    void (new URL(request.url()).origin === origin || request.url().startsWith('data:') ? request.continue() : request.abort());
  });
  const ready = () => page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
  const addScanner = () => page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  const scan = expected => page.waitForFunction((expectedValue, paper) => {
    const source = document.querySelector('.designqr-presentation-canvas'), canvas = document.createElement('canvas');
    if (!source) return false;
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d'); context.fillStyle = paper; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, canvas.width, canvas.height)?.data === expectedValue;
  }, { timeout: 15000 }, expected, DESIGN_QR_THEME_PRESETS.dotonbori.groundColor);
  const capture = name => page.screenshot({ path: join(captures, `${name}.png`) });
  const pixels = () => page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL());

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(consumer ? `${origin}/city-consumer/` : url('/qr', { design: 'tree', theme: 'spring' }), { waitUntil: 'networkidle0' });
  await page.waitForSelector('.designqr-presentation-canvas');
  assert.equal(requests.some(request => /dotonbori-asset-data|shibuya-asset-data|GLTFLoader/.test(request)), false, 'Tree fetched city assets.');
  if (consumer) {
    await page.evaluate(value => window.fixture.update({ design: 'city', theme: 'dotonbori', value }), value);
    await ready(); await addScanner(); await capture('installed-dotonbori-3d');
    assert.equal(requests.some(request => /shibuya-asset-data/.test(request)), false, 'Dōtonbori fetched Shibuya payloads.');
    await page.evaluate(() => window.fixture.first.current.setView('qr')); await scan(value);
    await capture('installed-dotonbori-qr');
    await page.evaluate(() => window.fixture.update({ second: true, secondTheme: 'dotonbori' }));
    await page.waitForFunction(() => document.querySelector('.second .designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
    await page.evaluate(() => window.fixture.update({ show: false }));
    await page.waitForFunction(() => !document.querySelector('.first'));
    assert.equal(await page.$eval('.second .designqr-webgl-canvas', canvas => canvas.dataset.cityAssets), 'ready');
    assert.equal(await page.evaluate(() => window.fixtureError), undefined);
    console.log('Installed Dōtonbori: lazy non-root assets, QR scanning, and independent players passed.');
  } else {
    await page.click('.design-type-tabs button:nth-child(2)'); await ready();
    assert.equal(requests.some(request => /dotonbori-asset-data/.test(request)), false, 'Shibuya fetched Dōtonbori payloads.');
    await page.click('.floating-zoom-toggle');
    assert.equal(await page.$('.preview-river-view'), null, 'River view belongs only to Dōtonbori.');
    await page.keyboard.press('Escape');
    await page.click(preset); await ready();
    assert.match(await page.$eval('.designqr-root', element => element.getAttribute('aria-label')), /道頓堀/);
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(url(), { waitUntil: 'networkidle0' }); await ready(); await addScanner(); await pause(150);
      assert.equal(await page.$eval(preset, button => button.getAttribute('aria-pressed')), 'true');
      const layout = await page.evaluate(() => {
        const chip = document.querySelector('[aria-label="City theme"] button:nth-child(2)').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, chipFits: chip.right <= innerWidth && chip.bottom <= innerHeight };
      });
      assert.deepEqual(layout, { overflow: false, chipFits: true });
      await page.focus(preset); await page.keyboard.press('Enter');
      await capture(`dotonbori-${width}-3d`);
      const opening = await pixels(), canonical = page.url();
      await page.click('.floating-zoom-toggle');
      const riverLayout = await page.$eval('.preview-river-view', button => {
        const panel = button.closest('.preview-zoom-panel').getBoundingClientRect(), action = button.getBoundingClientRect();
        return { fits: panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight,
          actionFits: action.left >= panel.left && action.right <= panel.right, height: action.height };
      });
      assert.ok(riverLayout.fits && riverLayout.actionFits && riverLayout.height >= 34, JSON.stringify(riverLayout));
      await capture(`dotonbori-${width}-view-menu`);
      await page.focus('.preview-river-view'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('#preview-zoom-editor'));
      await pause(150);
      assert.notEqual(await pixels(), opening, 'River view must change the rendered viewing elevation.');
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('floating-zoom-toggle')), true);
      assert.equal(page.url(), canonical, 'The river-view preset is transient viewing state.');
      await capture(`dotonbori-${width}-river-view`);
      await page.click('[aria-label="Reset view"]'); await pause(150);
      assert.equal(await pixels(), opening, 'Reset must restore the exact low opening view under reduced motion.');
      await page.click('[title="2D QR"]'); await scan(value); await pause(150);
      await capture(`dotonbori-${width}-qr`);
      await page.click('.floating-zoom-toggle');
      assert.equal(await page.$('.preview-river-view'), null, 'The camera shortcut must not appear in QR mode.');
      await page.keyboard.press('Escape');
      const before = await pixels(); await page.click(preset); await pause(100);
      assert.equal(await pixels(), before, 'Reselecting changed settled QR output.');
      await page.click('[aria-label="Share link"]'); await page.click('[data-share-mode="react"]');
      await page.click('[data-react-example="advanced"]');
      assert.match(await page.$eval('.react-code', code => code.textContent), /theme="dotonbori"/);
      await page.click('[aria-label="Close share dialog"]');
      await page.click('.design-type-tabs button:nth-child(1)'); await page.click('.design-type-tabs button:nth-child(2)'); await ready(); await scan(value);
      assert.equal(await page.$eval(preset, button => button.getAttribute('aria-pressed')), 'true');
      console.log(`Dōtonbori editor ${width}×${height}: 3D/QR, scanner, preset, React snippet, and design restoration passed.`);
    }
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(url('/qr', { interaction: { motionBlur: false, transitionSpeed: .25 } }), { waitUntil: 'networkidle0' });
    await ready(); await addScanner(); await pause(250);
    await page.click('[aria-label="Auto Spin"]');
    await page.click('.floating-zoom-toggle'); await page.click('.preview-river-view');
    await page.waitForSelector('[aria-label="Auto Spin"]'); await pause(600);
    await page.click('[aria-label="Reset view"]'); await pause(600);
    const original = await pixels();
    await page.click('[title="2D QR"]'); await pause(650); await capture('dotonbori-morph-early');
    assert.notEqual(await pixels(), original); await pause(500); await capture('dotonbori-morph-late');
    await scan(value); await pause(150);
    await page.evaluate(() => {
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = blob => { if (blob.type === 'image/png') window.dotonboriExport = blob; return create(blob); };
      document.addEventListener('click', event => { const a = event.target.closest?.('a[download]'); if (a) { window.dotonboriFilename = a.download; event.preventDefault(); } }, true);
    });
    await page.click('[aria-label="Share link"]'); await page.click('.share-action-item.primary');
    await page.waitForFunction(() => window.dotonboriExport && window.dotonboriFilename);
    const exported = await page.evaluate(async paper => {
      const bitmap = await createImageBitmap(window.dotonboriExport), canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d'); context.fillStyle = paper; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const displayed = await new Promise(resolve => document.querySelector('.designqr-presentation-canvas').toBlob(resolve));
      const bytes = new Uint8Array(await window.dotonboriExport.arrayBuffer()), visible = new Uint8Array(await displayed.arrayBuffer());
      return { filename: window.dotonboriFilename, bytes: Array.from(bytes),
        decoded: window.jsQR(pixels.data, canvas.width, canvas.height)?.data,
        matchesDisplay: bytes.length === visible.length && bytes.every((byte, i) => byte === visible[i]) };
    }, DESIGN_QR_THEME_PRESETS.dotonbori.groundColor);
    assert.equal(exported.filename, 'designqr-dotonbori.png');
    assert.equal(exported.decoded, value, 'The downloaded PNG must scan.');
    assert.equal(exported.matchesDisplay, true, 'PNG export differs from the settled display.');
    await writeFile(join(captures, 'dotonbori-export.png'), Buffer.from(exported.bytes));
    if (await page.$('[aria-label="Close share dialog"]')) await page.click('[aria-label="Close share dialog"]');
    await page.click('[title="3D City"]'); await pause(2600);
    assert.notEqual(await pixels(), original, 'Returning to 3D did not resume waterfront activity.');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    // Wait for the media-change/layout effect and its rendered frame, rather
    // than assuming SwiftShader has presented it after a fixed wall-clock delay.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const still = await pixels(); await pause(400);
    const frozen = await pixels();
    if (frozen !== still) {
      await writeFile(join(captures, 'reduced-before.png'), Buffer.from(still.split(',')[1], 'base64'));
      await writeFile(join(captures, 'reduced-after.png'), Buffer.from(frozen.split(',')[1], 'base64'));
    }
    assert.ok(frozen === still, 'Reduced motion did not freeze waterfront activity.');
    await page.evaluate(() => { const input = document.querySelector('.url-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://example.com/dotonbora'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await pause(800); assert.notEqual(await pixels(), still, 'A same-grid payload edit did not regenerate the architecture.');
    const changed = await pixels(); await pause(300); assert.equal(await pixels(), changed, 'A paused content edit resumed the animation.');
    await capture('dotonbori-content-edited-3d');
    await page.evaluate(value => { const input = document.querySelector('.url-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await pause(800); assert.equal(await pixels(), still, 'Restoring content did not restore the same architecture and frozen actors.');
    await page.evaluate(() => { const input = document.querySelector('.url-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://example.com/dotonbora'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await pause(800);
    await page.click('[title="2D QR"]'); await scan('https://example.com/dotonbora');
    const shared = decodeDesignQRConfig(new URL(page.url()).searchParams.get('q'));
    assert.ok(shared.ok); assert.deepEqual(shared.value.theme, { type: 'preset', preset: 'dotonbori' });
    assert.equal(shared.value.value, 'https://example.com/dotonbora');
    await page.reload({ waitUntil: 'networkidle0' }); await ready(); await addScanner(); await scan('https://example.com/dotonbora');
    const logo = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d'); context.fillStyle = '#ffea44'; context.fillRect(0, 0, 32, 32);
      return canvas.toDataURL();
    });
    await page.goto(url('/qr/embed', { logo: { src: logo, alt: 'Custom Asahi-panel artwork' } }), { waitUntil: 'networkidle0' });
    await ready(); await addScanner(); await capture('dotonbori-logo-3d');
    const logoPixels = await page.$eval('.designqr-presentation-canvas', canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 240 && pixels[i + 1] > 210 && pixels[i + 2] < 100) count++;
      return count;
    });
    assert.ok(logoPixels > 100, 'The Asahi-panel logo is not visible from the default camera.');
    for (const overrides of [{}, { transparentBackground: true }, { details: { border: { padding: 16 }, title: 'Dōtonbori' } },
      { value: 'https://example.com/' + 'tokyo/'.repeat(32) },
      { logo: { src: logo }, transparentBackground: true, details: { border: { padding: 16 } } }]) {
      await page.goto(url('/qr/embed', { view: 'qr', ...overrides }), { waitUntil: 'networkidle0' }); await ready(); await addScanner(); await scan(overrides.value ?? value);
    }
    console.log('Dōtonbori: forward/reverse morph, QR-generated architecture/restoration, PNG export, and hosted embeds passed.');
  }
  assert.deepEqual(errors, []);
  console.log(`Dōtonbori smoke passed. Captures: ${captures}`);
} finally { if (browser) await browser.close(); preview.kill('SIGTERM'); }
