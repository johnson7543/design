import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(root, '.designqr-styles-'));
let server, browser;
try {
  await writeFile(join(directory, 'host.css'), '.designqr-root { --designqr-title-font-family: Georgia; width: min(100%, 480px); height: auto; }');
  await writeFile(join(directory, 'main.js'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DesignQR, createTreeTheme, DESIGN_QR_THEME_PRESETS } from 'designqr';
window.qrBackdrop = DESIGN_QR_THEME_PRESETS.winter.groundColor;
const ink = DESIGN_QR_THEME_PRESETS.shibuya.qrFinderEyeColor;
const treeTheme = createTreeTheme('winter', {
  qrFoliagePaletteColors: [ink, ink, ink, ink], qrFoliageColorVariation: 0,
  qrFinderPaletteColors: [ink, ink, ink, ink], qrFinderEyeColor: ink, qrFinderColorVariation: 0,
});
const root = createRoot(document.getElementById('app'));
window.renderPlayers = (count, value = '', design = 'tree', view = 'qr') => flushSync(() => root.render(
  React.createElement(React.Fragment, null, ...Array.from({ length: count }, (_, key) =>
    React.createElement(DesignQR, { key, value, design, view, theme: design === 'tree' ? treeTheme : 'shibuya', details: { border: {} }, interaction: { motionBlur: false } })))));
window.renderPlayers(2);
`);
  await writeFile(join(directory, 'manual.js'), "import 'designqr/style.css';\nimport './main.js';\n");
  for (const mode of ['auto', 'manual', 'nonce']) {
    const nonce = mode === 'nonce' ? '<meta property="csp-nonce" content="designqr-test-nonce">' : '';
    const policy = mode === 'auto' ? '' : `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' ${mode === 'nonce' ? "'nonce-designqr-test-nonce'" : ''}">`;
    await writeFile(join(directory, `${mode}.html`), `<!doctype html><html><head>${policy}${nonce}<link rel="stylesheet" href="./host.css"></head><body><div id="app"></div><script type="module" src="./${mode === 'manual' ? 'manual' : 'main'}.js"></script></body></html>`);
  }
  await build({ configFile: false, root: directory, logLevel: 'warn', build: {
    rollupOptions: { input: Object.fromEntries(['auto', 'manual', 'nonce'].map(mode => [mode, join(directory, `${mode}.html`)])) },
  } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port: 4199, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of ['auto', 'manual', 'nonce']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.evaluateOnNewDocument(() => {
      window.styleViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.styleViolations.push(event.violatedDirective));
    });
    await page.goto(`http://127.0.0.1:4199/${mode}.html`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.designqr-error');
    const read = () => page.evaluate(() => {
      const players = [...document.querySelectorAll('.designqr-root')];
      return { count: document.querySelectorAll('style[data-designqr-core-styles]').length,
        players: players.map(player => { const css = getComputedStyle(player); return {
          marker: css.getPropertyValue('--designqr-core-styles').trim(), display: css.display,
          title: css.getPropertyValue('--designqr-title-font-family').trim(), height: player.getBoundingClientRect().height,
        }; }), violations: window.styleViolations,
        nonce: document.querySelector('style[data-designqr-core-styles]')?.nonce };
    });
    const first = await read();
    assert.equal(first.count, mode === 'manual' ? 0 : 1, mode);
    for (const player of first.players) {
      assert.equal(player.marker, 'loaded', mode);
      assert.equal(player.display, 'grid', mode);
      // Explicit stylesheet order belongs to the host; auto CSS must precede overrides.
      if (mode !== 'manual') assert.equal(player.title, 'Georgia', mode);
      assert.ok(player.height >= 192, mode);
    }
    if (mode === 'nonce') assert.equal(first.nonce, 'designqr-test-nonce');
    await page.evaluate(() => { window.renderPlayers(0); window.renderPlayers(3); });
    assert.equal((await read()).count, first.count, `${mode}: remount duplicated styles`);
    assert.deepEqual((await read()).violations, [], `${mode}: CSP violations`);
    assert.deepEqual(errors.filter(message => !message.includes('favicon.ico') && !message.includes('404')), [], mode);
    if (mode === 'auto') {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
      for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        for (const design of ['tree', 'city']) {
          await page.evaluate(design => window.renderPlayers(1, 'https://github.com/johnson7543/design', design), design);
          await page.waitForFunction(() => {
            const canvas = document.querySelector('.designqr-presentation-canvas');
            if (!canvas?.width || !canvas.height) return false;
            const composite = document.createElement('canvas');
            composite.width = canvas.width; composite.height = canvas.height;
            const context = composite.getContext('2d');
            context.fillStyle = window.qrBackdrop;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(canvas, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            return window.jsQR(pixels.data, pixels.width, pixels.height)?.data === 'https://github.com/johnson7543/design';
          }, { timeout: 30000 }).catch(async error => {
            console.error({ design, width, errors, state: await page.evaluate(() => ({
              html: document.getElementById('app').innerHTML,
              rect: document.querySelector('.designqr-root')?.getBoundingClientRect().toJSON(),
            })) });
            await page.screenshot({ path: '/tmp/designqr-auto-styles-failure.png' });
            throw error;
          });
          for (const view of ['design', 'qr']) {
            await page.evaluate(({ design, view }) => window.renderPlayers(1, 'https://github.com/johnson7543/design', design, view), { design, view });
            assert.equal(await page.$eval('.designqr-root', player => {
              const box = player.getBoundingClientRect();
              const hidden = player.querySelector('.designqr-webgl-canvas');
              return box.width > 0 && Math.abs(box.height - box.width) < 1
                && box.right <= innerWidth && getComputedStyle(hidden).opacity === '0';
            }), true, `${design} ${view} ${width}: automatic layout`);
          }
        }
        console.log(`Automatic styles: Tree/City, both views and QR decode at ${width}×${height} passed.`);
      }
      assert.equal((await read()).count, 1);
    }
    await page.close();
    console.log(`DesignQR styles: ${mode}, error layout, multiple instances, remount and CSP passed.`);
  }
} finally {
  await browser?.close();
  await server?.httpServer.close();
  await rm(directory, { recursive: true, force: true });
}
