import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { encodeDesignQRConfig, normalizeDesignQRConfig } from 'designqr/config';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.DESIGNQR_CITY_MEASURE_PORT ?? 4189);
const origin = `http://127.0.0.1:${port}`;
const output = process.env.DESIGNQR_CITY_MEASURE_DIR;
if (!output) throw new Error('Set DESIGNQR_CITY_MEASURE_DIR to a measurement output directory.');
const label = process.env.DESIGNQR_CITY_MEASURE_LABEL ?? 'city';
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* starting */ }
    if (attempt > 100) throw new Error('Measurement preview did not start.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await mkdir(output, { recursive: true });
  const measurements = [];
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', request => void (new URL(request.url()).origin === origin || request.url().startsWith('data:') ? request.continue() : request.abort()));
    await page.evaluateOnNewDocument(() => {
      window.cityMeasure = { calls: 0, triangles: 0 };
      for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
          const original = prototype[name];
          if (!original) continue;
          prototype[name] = function (...args) {
            window.cityMeasure.context = this;
            window.cityMeasure.calls++;
            const count = name.includes('Arrays') ? args[2] : args[1];
            window.cityMeasure.triangles += count / 3 * (name.endsWith('Instanced') ? args.at(-1) : 1);
            return original.apply(this, args);
          };
        }
      }
    });
    const config = normalizeDesignQRConfig({ value: 'https://example.com/shibuya', design: 'city', interaction: { motionBlur: false, autoRotate: false } });
    await page.goto(`${origin}/qr?q=${encodeDesignQRConfig(config)}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.designqr-presentation-canvas');
    await page.waitForFunction(() => document.querySelector('.designqr-webgl-canvas')?.dataset.cityAssets === 'ready');
    await page.evaluate(() => new Promise(resolve => { let frames = 20; const next = () => --frames > 0 ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }));
    const result = await page.evaluate(() => new Promise(resolve => {
      const samples = []; let previous = performance.now();
      const next = now => {
        samples.push({ interval: now - previous, calls: window.cityMeasure.calls, triangles: window.cityMeasure.triangles });
        previous = now; window.cityMeasure.calls = 0; window.cityMeasure.triangles = 0;
        if (samples.length < 181) return requestAnimationFrame(next);
        const selected = samples.slice(1), intervals = selected.map(s => s.interval).sort((a, b) => a - b);
        const context = window.cityMeasure.context, extension = context.getExtension('WEBGL_debug_renderer_info');
        resolve({ medianMs: intervals[Math.floor(intervals.length * .5)], p95Ms: intervals[Math.floor(intervals.length * .95)],
          meanDrawCalls: selected.reduce((n, s) => n + s.calls, 0) / selected.length,
          meanTriangles: selected.reduce((n, s) => n + s.triangles, 0) / selected.length,
          renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unknown', frames: selected.length,
          userAgent: navigator.userAgent });
      };
      window.cityMeasure.calls = 0; window.cityMeasure.triangles = 0; requestAnimationFrame(next);
    }));
    await page.screenshot({ path: join(output, `${label}-${width}-3d.png`) });
    await page.click('[title="2D QR"]');
    await new Promise(resolve => setTimeout(resolve, 700));
    await page.screenshot({ path: join(output, `${label}-${width}-qr.png`) });
    measurements.push({ width, height, config, ...result });
    console.log(JSON.stringify(measurements.at(-1)));
    await page.close();
  }
  const entry = await readFile(join(root, 'packages/designqr/dist/designqr.js'));
  await writeFile(join(output, `${label}-measurements.json`), JSON.stringify({ label, measuredAt: new Date().toISOString(),
    setup: 'Headless Chrome / ANGLE SwiftShader software WebGL, DPR 1, 180 settled frames, autoRotate and motionBlur off; frame intervals include software-renderer scheduling.',
    packageEntryBytes: entry.length, packageEntryGzipBytes: gzipSync(entry).length, measurements }, null, 2));
} finally { await browser?.close(); preview.kill(); }
