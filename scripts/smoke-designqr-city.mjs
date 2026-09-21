import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE, decodeDesignQRConfig, encodeDesignQRConfig, normalizeDesignQRConfig } from 'designqr/config';
import QRCode from 'qrcode';
import { resolveTreeTheme } from 'designqr';
import { createDesignQREmbedUrl, createDesignQRMessage } from 'designqr/embed';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Keep the focused City player separate from the cross-origin fixture (4175).
const port = Number(process.env.DESIGNQR_CITY_PORT ?? 4188);
const origin = `http://127.0.0.1:${port}`;
const captureDirectory = process.env.DESIGNQR_CITY_CAPTURE_DIR;
// Allow focused reruns on slow software-WebGL hosts; the default still covers every editor size.
const editorWidths = new Set((process.env.DESIGNQR_CITY_EDITOR_WIDTHS ?? '1440,1059,707,390,320').split(',').filter(Boolean).map(Number));
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => path && existsSync(path));
if (!chrome) throw new Error('Set CHROME_BIN to a Chrome or Chromium executable.');
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
});
let previewLog = '';
preview.stdout.on('data', chunk => { previewLog += chunk; });
preview.stderr.on('data', chunk => { previewLog += chunk; });
let browser;
const errors = [];
const instanceId = 'shibuya-smoke';
const denseValue = 'https://example.com/' + 'tokyo/'.repeat(32);
const oversizedValue = 'https://example.com/' + 'tokyo/'.repeat(45);
const cityTheme = resolveTreeTheme({ type: 'preset', preset: 'shibuya' });
const rgba = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).concat(255).join(',');
const cityQrPalette = {
  paperHex: cityTheme.groundColor, paper: rgba(cityTheme.groundColor),
  inks: cityTheme.qrFoliagePaletteColors.map(rgba), finder: rgba(cityTheme.qrFinderEyeColor),
};
assert.equal(QRCode.create(denseValue, { errorCorrectionLevel: 'M' }).modules.size,
  DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE, 'Exercise the maximum supported interactive QR size.');

function configUrl(route, overrides = {}) {
  const config = normalizeDesignQRConfig({
    value: 'https://example.com/shibuya', design: 'city', theme: 'shibuya',
    interaction: { motionBlur: false }, ...overrides,
  });
  return route === '/qr/embed' ? createDesignQREmbedUrl(config, { origin, instanceId })
    : `${origin}${route}?q=${encodeDesignQRConfig(config)}`;
}
async function load(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.designqr-presentation-canvas, [role="alert"]');
  assert.ok(await page.$('.designqr-presentation-canvas'),
    await page.$eval('body', body => body.innerText));
  await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  await page.addScriptTag({ content: `window.cityQrPalette = ${JSON.stringify(cityQrPalette)}; window.inspectCityQrPalette = ${inspectCityQrPalette.toString()};` });
  const parameters = new URL(url).searchParams;
  const decoded = decodeDesignQRConfig(parameters.get('config') ?? parameters.get('q') ?? '');
  if (decoded.ok && decoded.value.design.type === 'city') {
    await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready',
      { timeout: 15000 });
  }
  await new Promise(resolve => setTimeout(resolve, 180));
}
// Sample original, opaque cell interiors, not anti-aliased edges or a composited
// screenshot. Decoding over cool white only supplies the matrix's position and size.
function inspectCityQrPalette(source, { logo = false, card = false } = {}) {
  const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height);
  const backdrop = document.createElement('canvas');
  backdrop.width = source.width; backdrop.height = source.height;
  const context = backdrop.getContext('2d');
  context.fillStyle = window.cityQrPalette.paperHex; context.fillRect(0, 0, source.width, source.height);
  context.drawImage(source, 0, 0);
  const scan = context.getImageData(0, 0, source.width, source.height);
  const code = window.jsQR(scan.data, scan.width, scan.height);
  if (!code) return { valid: false, error: 'QR not decoded' };
  const grid = 17 + 4 * code.version;
  const { topLeftFinderPattern: a, topRightFinderPattern: b, bottomLeftFinderPattern: c } = code.location;
  const dx = { x: (b.x - a.x) / (grid - 7), y: (b.y - a.y) / (grid - 7) };
  const dy = { x: (c.x - a.x) / (grid - 7), y: (c.y - a.y) / (grid - 7) };
  const sample = (row, col) => {
    const x = Math.floor(a.x + (col - 3) * dx.x + (row - 3) * dy.x);
    const y = Math.floor(a.y + (col - 3) * dx.y + (row - 3) * dy.y);
    return Array.from(pixels.data.slice((y * source.width + x) * 4, (y * source.width + x) * 4 + 4)).join(',');
  };
  const { paper, inks, finder } = window.cityQrPalette;
  const counts = Object.fromEntries([paper, ...inks].map(color => [color, 0]));
  const offPalette = [];
  const wrongFinders = [];
  for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
    // User images are exempt; exclude the maximum supported 20% logo footprint
    // plus one cell of sampling clearance, but still check all other modules.
    if (logo && Math.abs(row + .5 - grid / 2) < grid * .1 + 1
      && Math.abs(col + .5 - grid / 2) < grid * .1 + 1) continue;
    const color = sample(row, col);
    if (Object.hasOwn(counts, color)) counts[color]++;
    else if (offPalette.length < 5) offPalette.push({ row, col, color });
    const isFinder = (row <= 6 && (col <= 6 || col >= grid - 7)) || (row >= grid - 7 && col <= 6);
    if (isFinder && color !== paper && color !== finder && wrongFinders.length < 5) wrongFinders.push({ row, col, color });
  }
  const transparent = pixels.data[3] === 0;
  const quietZoneOffPalette = [];
  for (let row = -4; row < grid + 4; row++) for (let col = -4; col < grid + 4; col++) {
    if (row >= 0 && row < grid && col >= 0 && col < grid) continue;
    const color = sample(row, col);
    // Border alone owns the four-module fill. Without it the margin belongs
    // to the atmosphere or transparent host, never a local paper surround.
    const invalid = card ? color !== paper : transparent ? color.split(',')[3] !== '0' : color === paper;
    if (invalid && quietZoneOffPalette.length < 5) quietZoneOffPalette.push({ row, col, color });
  }
  const cardColor = card ? sample(-2, (grid - 1) / 2) : null;
  return {
    valid: offPalette.length === 0 && wrongFinders.length === 0 && quietZoneOffPalette.length === 0
      && counts[paper] > 0 && inks.filter(ink => counts[ink] > 0).length >= (logo ? 3 : 4)
      && (!card || cardColor === paper),
    counts, offPalette, wrongFinders, quietZoneOffPalette, cardColor,
  };
}
async function decode(page, expected, paletteOptions = {}) {
  await page.waitForFunction(value => {
    const source = document.querySelector('.designqr-presentation-canvas');
    // jsQR ignores alpha. Composite onto the host's light backdrop so a
    // transparent borderless player's outer margin is not misread as black.
    // The source/export alpha and exact pixels are checked separately below.
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f5faff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data === value;
  }, { timeout: 10_000, polling: 200 }, expected);
  // A QR can decode before the turn finishes; wait for exact settled swatches.
  try {
    await page.waitForFunction(options => window.inspectCityQrPalette(
      document.querySelector('.designqr-presentation-canvas'), options).valid,
    { timeout: 5_000, polling: 200 }, paletteOptions);
  } catch {
    const sampled = await page.$eval('.designqr-presentation-canvas',
      (canvas, options) => window.inspectCityQrPalette(canvas, options), paletteOptions);
    assert.fail(`City QR must retain exact palette colors: ${JSON.stringify(sampled)}`);
  }
}
async function capture(page, name) {
  if (!captureDirectory) return;
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: join(captureDirectory, `${name}.png`) });
}
async function canvasPixels(page) {
  return page.$eval('.designqr-presentation-canvas', canvas => canvas.toDataURL('image/png'));
}

async function verifyCityPresetSelection(page) {
  const selector = '[aria-label="City theme"] button';
  const readSelection = () => page.$eval(selector, button => {
    const row = button.parentElement.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    const designRow = document.querySelector('.design-type-tabs').getBoundingClientRect();
    const actionRow = document.querySelector('.action-buttons-row').getBoundingClientRect();
    const standardHeight = Number.parseFloat(getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--qr-control-height'));
    return {
      label: button.textContent.trim(), selected: button.getAttribute('aria-pressed'),
      active: button.classList.contains('active'), enabled: !button.disabled,
      presetCount: button.parentElement.querySelectorAll('button').length,
      focusUnclipped: getComputedStyle(button.parentElement).overflowY === 'visible',
      aligned: Math.abs(bounds.left - designRow.left) < 1 && bounds.right <= row.right + 1
        && row.top >= designRow.bottom && row.bottom <= actionRow.top
        && Math.abs(bounds.height - standardHeight) < 1,
      focused: button.matches(':focus-visible') && getComputedStyle(button).outlineStyle !== 'none',
      view: document.querySelector('.mode-btn.active').getAttribute('title'),
      value: document.querySelector('.url-input').value,
    };
  });
  const initial = await readSelection();
  assert.equal(initial.label, '渋谷');
  assert.equal(initial.selected, 'true');
  assert.equal(initial.active && initial.enabled && initial.aligned, true, 'The City preset must use the standard selected chip and preset row.');
  assert.equal(initial.focusUnclipped, true, 'The City preset row must not clip its keyboard focus ring.');
  assert.equal(initial.presetCount, 3, 'City must expose 渋谷, 道頓堀 and 東京タワー.');
  await page.click(selector);
  await page.focus(selector);
  for (const key of ['Enter', 'Space']) await page.keyboard.press(key);
  const selected = await readSelection();
  assert.equal(selected.focused, true, 'The Shibuya preset needs visible keyboard focus.');
  assert.deepEqual({ ...selected, focused: false }, { ...initial, focused: false },
    'Reselecting Shibuya changed the preset, content, or view.');
}

async function artworkBounds(page) {
  return page.$eval('.designqr-webgl-canvas', source => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 32) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  });
}

async function sendEmbedCommand(page, type, payload) {
  const message = createDesignQRMessage(instanceId, type, payload);
  await page.evaluate(message => window.postMessage(message, location.origin), message);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function verifyEditorExport(page, expected, name, paletteOptions = {}) {
  await page.evaluate(() => {
    window.cityExportBlob = null;
    window.cityExportFilename = null;
    if (window.cityExportCaptureInstalled) return;
    window.cityExportCaptureInstalled = true;
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (blob.type === 'image/png') window.cityExportBlob = blob;
      return createObjectURL(blob);
    };
    document.addEventListener('click', event => {
      const anchor = event.target.closest?.('a[download]');
      if (anchor) {
        window.cityExportFilename = anchor.download;
        event.preventDefault();
      }
    }, true);
  });
  await page.click('[aria-label="Share link"]');
  await page.click('.share-action-item.primary');
  await page.waitForFunction(() => window.cityExportBlob && window.cityExportFilename);
  const result = await page.evaluate(async paletteOptions => {
    const bitmap = await createImageBitmap(window.cityExportBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const display = document.querySelector('.designqr-presentation-canvas');
    // Compare encoded PNG bytes: decoding translucent edge pixels can round
    // premultiplied RGB, even when both PNGs contain exactly the same frame.
    const displayedBlob = await new Promise(resolve => display.toBlob(resolve, 'image/png'));
    const displayedBytes = new Uint8Array(await displayedBlob.arrayBuffer());
    const exportedBytes = new Uint8Array(await window.cityExportBlob.arrayBuffer());
    return {
      decoded: window.jsQR(pixels.data, pixels.width, pixels.height)?.data,
      filename: window.cityExportFilename,
      matchesDisplay: exportedBytes.length === displayedBytes.length
        && exportedBytes.every((value, i) => value === displayedBytes[i]),
      cornerAlpha: pixels.data[3],
      palette: window.inspectCityQrPalette(canvas, paletteOptions),
      png: canvas.toDataURL('image/png').split(',')[1],
    };
  }, paletteOptions);
  assert.equal(result.decoded, expected, 'The exported City PNG must decode.');
  assert.equal(result.filename, 'designqr-shibuya.png');
  assert.equal(result.matchesDisplay, true, 'The exported PNG differs from the visible city QR.');
  assert.equal(result.palette.valid, true, `Exported City QR is off-palette: ${JSON.stringify(result.palette)}`);
  if (captureDirectory) await writeFile(join(captureDirectory, `${name}-export.png`), Buffer.from(result.png, 'base64'));
  return result;
}
async function motionRegions(page) {
  return page.$eval('.designqr-presentation-canvas', canvas => {
    const ctx = canvas.getContext('2d');
    // Disjoint probes at the station-side default view: central scramble and
    // the east-side rail span above the road. Keep traffic out of the rail probe.
    return [[.36, .51, .19, .10], [.725, .515, .040, .070]].map(([x, y, w, h]) =>
      Array.from(ctx.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height),
        Math.round(w * canvas.width), Math.round(h * canvas.height)).data));
  });
}

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* preview starting */ }
    if (attempt > 80) throw new Error(`City preview failed: ${previewLog}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ] });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    void (url.origin === origin || url.protocol === 'data:' ? request.continue() : request.abort());
  });
  for (const [width, height] of [[1440, 900], [1059, 1273], [707, 1157], [390, 844], [320, 568]]) {
    if (!editorWidths.has(width)) continue;
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await load(page, configUrl('/qr'));
    assert.equal(await page.$eval('.design-type-tabs button:nth-child(2)', button => button.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('.mode-btn[title="3D City"]', button => button.textContent.trim()), '3D City');
    assert.equal(await page.$eval('.designqr-root', stage => stage.getAttribute('aria-label').includes('渋谷')), true);
    assert.equal(await page.$('[aria-label="Add Theme"]'), null, 'City must not offer custom themes.');
    assert.equal(await page.$('.custom-themes-row'), null);
    await verifyCityPresetSelection(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px horizontal overflow`);
    const bounds = await page.evaluate(() => {
      const stage = document.querySelector('.main-viewport').getBoundingClientRect();
      const drawer = document.querySelector('.customizer-card').getBoundingClientRect();
      return { stageHeight: stage.height, drawerBottom: drawer.bottom };
    });
    assert.ok(bounds.stageHeight > 180 && bounds.drawerBottom <= height + 1, `${width}px city controls do not fit`);
    await capture(page, `shibuya-${width}-3d`);
    await page.click('[title="2D QR"]');
    await decode(page, 'https://example.com/shibuya');
    // Decoding exact cell colors can precede the last camera/presentation frame.
    // Compare genuinely settled canvases, including on slower small-mobile hosts.
    let qrBeforePresetSelection = await canvasPixels(page), stableFrames = 0;
    for (let attempt = 0; stableFrames < 3 && attempt < 50; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const next = await canvasPixels(page);
      stableFrames = next === qrBeforePresetSelection ? stableFrames + 1 : 0;
      qrBeforePresetSelection = next;
    }
    assert.equal(stableFrames, 3, 'The QR presentation never settled before preset selection.');
    await verifyCityPresetSelection(page);
    assert.ok(await canvasPixels(page) === qrBeforePresetSelection, 'Reselecting Shibuya changed the settled QR artwork.');
    await capture(page, `shibuya-${width}-qr`);
    await page.click('[aria-label="Share link"]');
    await page.click('[data-share-mode="react"]');
    assert.equal(await page.$('[data-react-example="theme"]'), null);
    for (const mode of ['simple', 'advanced']) {
      await page.click(`[data-react-example="${mode}"]`);
      const code = await page.$eval('.react-code', el => el.textContent);
      assert.match(code, /design="city"/);
      assert.doesNotMatch(code, /createTreeTheme|tree=\{/);
    }
    assert.equal(await page.$eval('.react-example-switcher', el => el.scrollWidth <= el.clientWidth + 1), true);
    await page.click('[aria-label="Close share dialog"]');
    await verifyEditorExport(page, 'https://example.com/shibuya', `shibuya-${width}`);
    // Switching design at the scan endpoint must never leave city geometry behind.
    for (let i = 0; i < 2; i++) {
      await page.click('.design-type-tabs button:nth-child(1)');
      await page.click('.design-type-tabs button:nth-child(2)');
      await decode(page, 'https://example.com/shibuya');
    }
    await page.click('[title="3D City"]');
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('.design-type-tabs button:nth-child(2)', b => b.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('[aria-label="City theme"] button', b => b.getAttribute('aria-pressed')), 'true');
    console.log(`City editor ${width}×${height}: both views, QR decode, design switching, and share reload passed.`);
  }
  await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 1 });
  await load(page, configUrl('/qr/embed'));
  await capture(page, 'shibuya-default-animation-start');
  const motionBefore = await motionRegions(page);
  await new Promise(resolve => setTimeout(resolve, 1200));
  const motionAfter = await motionRegions(page);
  for (const [index, name] of ['pedestrians', 'metro'].entries()) {
    const changed = motionBefore[index].filter((value, i) => Math.abs(value - motionAfter[index][i]) > 12).length;
    assert.ok(changed > 100, `Default ${name} motion is missing with camera rotation disabled (${changed} changed channels).`);
  }
  await capture(page, 'shibuya-default-animation');
  await page.focus('.designqr-root');
  await page.keyboard.press('Enter');
  await decode(page, 'https://example.com/shibuya');
  await new Promise(resolve => setTimeout(resolve, 300));
  const scanFrame = await canvasPixels(page);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await canvasPixels(page), scanFrame, 'Completed QR view must be static.');
  await page.keyboard.press('Enter');
  await new Promise(resolve => setTimeout(resolve, 750));
  const resumed = await canvasPixels(page);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.notEqual(await canvasPixels(page), resumed, 'City activity must resume after returning from QR view.');
  await sendEmbedCommand(page, 'designqr:pause');
  const paused = await canvasPixels(page);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await canvasPixels(page), paused, 'Pause must stop city activity.');
  await sendEmbedCommand(page, 'designqr:resume');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.notEqual(await canvasPixels(page), paused, 'Resume must restart city activity.');
  console.log('City default animation: walking commuters, passing metro, static QR, and return to motion passed.');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await load(page, configUrl('/qr/embed', { interaction: { autoRotate: true }, transparentBackground: true }));
  assert.equal(await page.$eval('.designqr-presentation-canvas', canvas => {
    const { width, height } = canvas;
    const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    for (let x = 0; x < width; x++) {
      if (pixels[x * 4 + 3] || pixels[((height - 1) * width + x) * 4 + 3]) return false;
    }
    for (let y = 0; y < height; y++) {
      if (pixels[(y * width) * 4 + 3] || pixels[(y * width + width - 1) * 4 + 3]) return false;
    }
    return true;
  }), true, 'The square embed clips city geometry at its edges.');
  const first = await canvasPixels(page);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await canvasPixels(page), first, 'Reduced motion must freeze all city activity.');
  await page.focus('.designqr-root');
  await page.keyboard.press('Enter');
  await decode(page, 'https://example.com/shibuya');
  console.log('City embed: keyboard turn, default city rendering, and reduced-motion freeze passed.');

  // Compare actual rendered endpoints while switching the same public player.
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [600, 600]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await load(page, configUrl('/qr/embed', { transparentBackground: true }));
    await page.evaluate(() => { window.framingCanvas = document.querySelector('.designqr-presentation-canvas'); });
    const measurements = {};
    for (const design of ['city', 'tree']) {
      const config = normalizeDesignQRConfig({ value: 'https://example.com/shibuya', design,
        transparentBackground: true, interaction: { motionBlur: false } });
      await sendEmbedCommand(page, 'designqr:set-config', { config });
      measurements[design] = { design: await artworkBounds(page) };
      await sendEmbedCommand(page, 'designqr:set-view', { view: 'qr' });
      if (design === 'city') await decode(page, config.value);
      measurements[design].qr = await artworkBounds(page);
      measurements[design].qrPixels = await canvasPixels(page);
      assert.equal(await page.evaluate(() => window.framingCanvas === document.querySelector('.designqr-presentation-canvas')), true);
    }
    const ratio = measurements.city.design.width / measurements.tree.design.width;
    assert.ok(ratio >= .9 && ratio <= 1.05, `City/Tree 3D footprint differs at ${width}×${height}: ${ratio}.`);
    for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
      assert.ok(Math.abs(measurements.city.qr[key] - measurements.tree.qr[key]) <= 2,
        `Switching 3D design changed the shared QR ${key}.`);
    }
    console.log(`Shared framing ${width}×${height}: City/Tree footprint ratio ${ratio.toFixed(3)}, identical QR bounds.`);
    // Tree's seasonal color strategy is outside this change. Verify returning
    // to Tree reproduces its own fresh QR output, without recoloring its theme.
    await load(page, configUrl('/qr/embed', {
      design: 'tree', theme: 'spring', view: 'qr', transparentBackground: true,
    }));
    assert.equal(await canvasPixels(page), measurements.tree.qrPixels, 'City → Tree changed the established Tree QR output.');
  }
  await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 1 });
  await load(page, configUrl('/qr/embed', { value: 'Shibuya', transparentBackground: true }));
  const shortCityBounds = await artworkBounds(page);
  await sendEmbedCommand(page, 'designqr:set-config', { config: normalizeDesignQRConfig({ value: denseValue, design: 'city', transparentBackground: true }) });
  const denseCityBounds = await artworkBounds(page);
  // Heights vary with content; the ground tile and shared camera scale do not.
  for (const key of ['minX', 'maxX', 'maxY', 'width']) {
    assert.ok(Math.abs(shortCityBounds[key] - denseCityBounds[key]) <= 2, `Dense QR content shifted the 3D City tile ${key}.`);
  }
  const contentA = 'Shibuya / A', contentB = 'Shibuya / B';
  assert.equal(QRCode.create(contentA).modules.size, QRCode.create(contentB).modules.size);
  await load(page, configUrl('/qr', { value: contentA }));
  const originalCity = await canvasPixels(page);
  await capture(page, 'shibuya-content-a');
  const editValue = async value => {
    const previousFrame = await canvasPixels(page);
    await page.$eval('.url-input', (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.waitForFunction(value => document.querySelector('.url-input').value === value, {}, value);
    // React/deferred QR work and software WebGL can outlast a fixed 400 ms sleep.
    // Require an actual changed rendered frame; an unchanged skyline still fails.
    await page.waitForFunction(previous => document.querySelector('.designqr-presentation-canvas').toDataURL('image/png') !== previous,
      { timeout: 15000, polling: 200 }, previousFrame);
    if (await page.$('.mode-btn.active[title="3D City"]')) {
      await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas').dataset.cityAssets === 'ready');
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await editValue(contentB);
  assert.notEqual(await canvasPixels(page), originalCity, 'Changing equal-size QR text did not change the visible 3D city.');
  await capture(page, 'shibuya-content-b');
  await page.click('[title="2D QR"]'); await decode(page, contentB);
  await page.click('[title="3D City"]');
  await editValue(contentA);
  assert.equal(await canvasPixels(page), originalCity, 'Restoring the same value did not reproduce the city.');
  await page.click('[title="2D QR"]'); await decode(page, contentA);
  await editValue(contentB); await decode(page, contentB);
  await page.click('[title="3D City"]');
  assert.notEqual(await canvasPixels(page), originalCity, 'Editing the settled QR left a stale skyline on return to 3D.');
  console.log('City content: equal-size live edits change the skyline, restore deterministically, and decode in both edit flows.');
  await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 1 });
  const logo = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 80, 80);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('S', 40, 57);
    return canvas.toDataURL('image/png');
  });
  const billboardLogo = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#db2777'; ctx.fillRect(0, 0, 160, 80);
    ctx.fillStyle = '#f5f7fb'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Y', 80, 55);
    return canvas.toDataURL('image/png');
  });
  const billboardPinkPixels = () => page.$eval('.designqr-presentation-canvas', canvas => {
    // Source-aligned QFRONT is north of the crossing, facing the Hachiko-side camera.
    const pixels = canvas.getContext('2d').getImageData(canvas.width * .36, canvas.height * .34, canvas.width * .18, canvas.height * .17).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 160 && pixels[i + 1] < 90 && pixels[i + 2] - pixels[i + 1] > 30) count++;
    }
    return count;
  });
  await load(page, configUrl('/qr/embed'));
  const originalBillboard = await billboardPinkPixels();
  await load(page, configUrl('/qr/embed', { logo: { src: billboardLogo } }));
  await capture(page, 'shibuya-logo-billboard');
  assert.ok(await billboardPinkPixels() > originalBillboard + 100, 'The uploaded logo is not visible on the main billboard at the default angle.');
  await page.focus('.designqr-root'); await page.keyboard.press('Enter');
  await decode(page, 'https://example.com/shibuya', { logo: true });
  await page.keyboard.press('Enter');
  await page.evaluate(() => { window.cityLogoCanvas = document.querySelector('.designqr-presentation-canvas'); });
  const replaceLogo = async (src) => {
    await sendEmbedCommand(page, 'designqr:set-config', {
      config: normalizeDesignQRConfig({ value: 'https://example.com/shibuya', design: 'city',
        logo: src ? { src } : false, interaction: { motionBlur: false } }),
    });
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(await page.evaluate(() => window.cityLogoCanvas === document.querySelector('.designqr-presentation-canvas')), true);
  };
  await replaceLogo(logo);
  assert.equal(await billboardPinkPixels(), originalBillboard, 'Replacing the billboard logo retained the old image.');
  await replaceLogo(billboardLogo);
  assert.ok(await billboardPinkPixels() > originalBillboard + 100);
  await replaceLogo(false);
  assert.equal(await billboardPinkPixels(), originalBillboard, 'Removing the logo failed to restore the sign.');
  console.log('City logo: default-angle billboard and logo-bearing QR decode passed.');
  for (const [name, overrides] of [
    ['short', { value: 'Shibuya', view: 'qr' }],
    ['dense', { value: denseValue, view: 'qr' }],
    ['transparent', { value: 'Shibuya', view: 'qr', transparentBackground: true }],
    ['dense-transparent', { value: denseValue, view: 'qr', transparentBackground: true }],
    ['zero-padding-card', { value: 'Shibuya', view: 'qr', transparentBackground: true, details: { border: { padding: 0 } } }],
    ['card', { value: 'Shibuya', view: 'qr', details: { border: { padding: 16 } } }],
    ['logo-transparent', { value: 'https://example.com/shibuya', view: 'qr', logo: { src: logo }, transparentBackground: true, details: { title: 'Shibuya', border: { padding: 16 } } }],
  ]) {
    await load(page, configUrl('/qr/embed', overrides));
    await decode(page, overrides.value, { logo: Boolean(overrides.logo), card: Boolean(overrides.details?.border) });
    if (name === 'logo-transparent') {
      assert.equal(await page.$eval('.designqr-presentation-canvas', canvas => canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3]), 0);
      const colors = await page.$eval('.designqr-presentation-canvas', canvas => {
        const style = getComputedStyle(canvas);
        return ['--designqr-content-color', '--designqr-border-color', '--designqr-border-highlight-color']
          .map(property => style.getPropertyValue(property).trim());
      });
      assert.deepEqual(colors, ['#29445f', '#29445f40', '#f5faff73'], 'City QR details must use the reference palette.');
      await page.addStyleTag({ content: '.designqr-root { --designqr-content-color: #605b53; }' });
      assert.equal(await page.$eval('.designqr-presentation-canvas', canvas => getComputedStyle(canvas).getPropertyValue('--designqr-content-color').trim()), '#605b53',
        'City theme defaults must not override host presentation CSS.');
    }
    await capture(page, `shibuya-embed-${name}`);
    console.log(`City embed ${name}: QR decode passed.`);
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await load(page, configUrl('/qr', {
    view: 'qr', logo: { src: logo }, transparentBackground: true,
    details: { title: 'Shibuya', showValue: true, border: { padding: 16 } },
  }));
  await decode(page, 'https://example.com/shibuya', { logo: true, card: true });
  const transparentExport = await verifyEditorExport(page, 'https://example.com/shibuya', 'shibuya-logo-transparent', { logo: true, card: true });
  assert.equal(transparentExport.cornerAlpha, 0);

  // A City preset selection must never overwrite the remembered seasonal Tree choice.
  await load(page, configUrl('/qr', { design: 'tree', theme: 'spring' }));
  assert.equal(await page.$eval('[aria-label="Tree theme"] button:first-child', b => b.getAttribute('aria-pressed')), 'true');
  await page.click('[aria-label="Tree theme"] button:nth-child(2)');
  await page.click('.design-type-tabs button:nth-child(2)');
  await verifyCityPresetSelection(page);
  await page.click('.design-type-tabs button:nth-child(1)');
  assert.equal(await page.$eval('[aria-label="Tree theme"] button:nth-child(2)', b => b.getAttribute('aria-pressed')), 'true');

  // Tree's selected custom theme survives an editor-only round trip through City.
  await load(page, configUrl('/qr', {
    design: 'tree', theme: resolveTreeTheme({ type: 'preset', preset: 'summer' }),
  }));
  const selectedTreeTheme = await page.$eval('.custom-theme-chip-wrap.active', el => el.textContent);
  await page.focus('.design-type-tabs button:nth-child(2)');
  await page.keyboard.press('Enter');
  assert.equal(await page.$('[aria-label="Add Theme"]'), null);
  await verifyCityPresetSelection(page);
  await page.focus('.design-type-tabs button:nth-child(1)');
  await page.keyboard.press('Space');
  assert.equal(await page.$eval('.custom-theme-chip-wrap.active', el => el.textContent), selectedTreeTheme);
  assert.ok(await page.$('[aria-label="Add Theme"]'));

  // The desktop theme panel leaves the design selector reachable behind it.
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  // A responsive CSS rail can still be moving after setViewport resolves.
  // Keep this a real pointer test, but click only once its target has settled.
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-label="Add Theme"]');
    const b = button.getBoundingClientRect();
    const key = [b.x, b.y, b.width, b.height].map(n => n.toFixed(2)).join(',');
    window.cityControlStableFrames = key === window.cityControlBounds ? (window.cityControlStableFrames ?? 0) + 1 : 0;
    window.cityControlBounds = key;
    return window.cityControlStableFrames >= 3 && button.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
  });
  await page.click('[aria-label="Add Theme"]');
  await page.waitForSelector('.custom-theme-aside-panel');
  await page.click('.design-type-tabs button:nth-child(2)');
  assert.equal(await page.$('.custom-theme-aside-panel'), null, 'City left the Tree custom-theme editor open.');
  await page.click('.design-type-tabs button:nth-child(1)');
  assert.equal(await page.$eval('.custom-theme-chip-wrap.active', el => el.textContent), selectedTreeTheme);

  for (const route of ['/qr', '/qr/embed']) {
    await page.goto(configUrl(route, { value: oversizedValue, view: 'qr' }), { waitUntil: 'networkidle0' });
    await page.waitForSelector('[role="alert"]');
    assert.equal(await page.$eval('[role="alert"]', el => el.getAttribute('data-designqr-error-code')), 'QR_GENERATION_FAILED');
    if (route === '/qr') assert.match(await page.$eval('[role="alert"]', el => el.textContent), /interactive rendering limit/);
    assert.equal(await page.$('canvas'), null, 'Oversized city content must not leave a stale QR canvas.');
    if (route === '/qr') assert.equal(await page.$eval('[aria-label="Share link"]', el => el.disabled), true);
  }
  console.log('City preset-only controls, React snippets, PNG exports, theme restoration, and oversized-value rejection passed.');
  assert.deepEqual(errors, [], 'City rendering raised browser errors.');
  if (captureDirectory) await writeFile(join(captureDirectory, 'city-validation.json'), JSON.stringify({ browserErrors: errors, editorWidths: [...editorWidths], framingViewports: ['1440x900', '390x844', '320x568', '600x600'], qrDecoding: 'passed', reducedMotion: 'passed', embed: 'passed', sharedFraming: 'passed', densityIndependentSize: 'passed', contentDrivenSkyline: 'passed', palette: 'passed' }, null, 2));
  console.log('Shibuya city smoke passed.');
} finally {
  await browser?.close();
  preview.kill();
}
