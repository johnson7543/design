import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'designqr-morph-detail-'));
const baseline = process.env.DESIGNQR_MORPH_BASELINE === '1';
const fixtureDirectory = process.env.DESIGNQR_MORPH_BASELINE_DIR ?? directory;
const profiling = process.env.DESIGNQR_MORPH_PROFILE === '1';
const port = Number(process.env.DESIGNQR_MORPH_DETAIL_PORT ?? 4199);
await writeFile(join(directory, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/shibuya-content/main.ts'))};`);
let server, browser;
const report = { baseline, profiling, cases: [] };
try {
  if (fixtureDirectory === directory) await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin()], logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: fixtureDirectory, logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.contentFixture?.snapshot().status === 'ready');
  await page.addScriptTag({ path: join(root, 'node_modules/jsqr/dist/jsQR.js') });
  await page.evaluate(() => { window.contentFixture.pause(); window.contentFixture.time(7); window.contentFixture.track(); });
  const decode = async bytes => page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data;
  }, bytes);
  const profile = await page.createCDPSession();
  await profile.send('Profiler.enable');
  await profile.send('Profiler.setSamplingInterval', { interval: 100 });
  for (const variant of [-1, 0, 2, 3]) {
    await page.evaluate(variant => { window.contentFixture.progress(0); window.contentFixture.logo(variant >= 0, variant); }, variant);
    if (variant >= 0) await page.waitForFunction(() => !!window.contentFixture.logoVisual());
    const before = await page.evaluate(() => ({ scene: window.contentFixture.snapshot(), logo: window.contentFixture.logoVisual(), hero: window.contentFixture.hero() }));
    const original3d = await page.evaluate(() => window.contentFixture.exported());
    await writeFile(join(directory, `${variant}-3d.png`), new Uint8Array(original3d.bytes));
    await page.evaluate(() => window.contentFixture.progress(1));
    const originalQr = await page.evaluate(() => window.contentFixture.exported());
    assert.equal(await decode(originalQr.bytes), 'https://example.com/shibuya');
    await page.evaluate(() => window.contentFixture.progress(0));
    if (profiling) await profile.send('Profiler.start');
    const measurements = [];
    let baseIdentity, attributes;
    for (const progress of [.15, .36, .42, .5, .6, .74, .94, 1, .74, .5, .36, 0]) {
      measurements.push(await page.evaluate(p => window.contentFixture.measureProgress(p), progress));
      const current = await page.evaluate(() => ({ scene: window.contentFixture.snapshot(), logo: window.contentFixture.logoVisual() }));
      assert.deepEqual(current.scene.actors, before.scene.actors);
      assert.equal(current.scene.time, before.scene.time);
      assert.deepEqual(current.scene.buffer, before.scene.buffer);
      if (before.logo) {
        assert.equal(current.logo.texture, before.logo.texture);
        assert.equal(current.logo.id, before.logo.id);
        assert.equal(current.logo.version, before.logo.version);
        assert.equal(current.logo.aspect, before.logo.aspect);
        assert.equal(current.logo.copies, 1);
      }
      if (!baseline) {
        const detail = await page.evaluate(() => window.contentFixture.signDetails());
        const morph = await page.evaluate(() => window.contentFixture.morph());
        baseIdentity ??= morph.baseIdentity;
        assert.equal(morph.baseIdentity, baseIdentity);
        assert.equal(detail.vertices, 36);
        assert.equal(detail.maps.length, 3);
        assert.equal(detail.visible, progress > .3 && progress < .78);
        assert.ok(detail.maps.every(m => m.borrowed), 'Sign fragments copied their textures');
        if (detail.visible) assert.ok(detail.maps.every(m => m.sameProgram), `An extra sign shader was compiled: ${JSON.stringify(detail.maps)}`);
        assert.ok(detail.maps.every(m => m.texture !== before.logo?.texture), 'The uploaded logo was duplicated in sign fragments');
        assert.equal(detail.attributes.position.bytes, 432);
        if (attributes) {
          assert.deepEqual(detail.attributes.uv, attributes.uv);
          assert.deepEqual(detail.attributes.normal, attributes.normal);
        }
        attributes ??= detail.attributes;
        assert.ok(measurements.at(-1).gpu.textures <= before.scene.gpu.textures, 'Turning uploaded another texture');
        if (measurements.length > 1) {
          assert.equal(measurements.at(-1).prepareMs, 0, 'A frame rebuilt correspondence');
          assert.equal(measurements.at(-1).compileMs, 0, 'A frame repeated shader preparation');
          assert.equal(measurements.at(-1).programs, measurements[0].programs, 'First visibility compiled an unprepared shader');
        }
      }
      if ([.42, .5, .6, .74].includes(progress)) await (await page.$('.designqr-root')).screenshot({ path: join(directory, `${variant}-${progress}.png`) });
    }
    if (profiling) {
      const { profile: cpu } = await profile.send('Profiler.stop');
      await writeFile(join(directory, `${variant}.cpuprofile`), JSON.stringify(cpu));
    }
    assert.deepEqual(await page.evaluate(() => window.contentFixture.exported()), original3d);
    await page.evaluate(() => window.contentFixture.progress(1));
    assert.deepEqual(await page.evaluate(() => window.contentFixture.exported()), originalQr);
    assert.deepEqual(await page.evaluate(() => window.contentFixture.hero()), before.hero);
    report.cases.push({ variant, measurements });
    console.log(JSON.stringify({ variant, measurements }));
  }
  if (!baseline) {
    // Replace/remove at a frozen mid-turn pose. The hero map is repainted in
    // place; fragments must borrow the latest content, never the logo texture.
    await page.evaluate(() => { window.contentFixture.logo(false); window.contentFixture.progress(.5); });
    const original = await page.evaluate(() => window.contentFixture.hero());
    let lastLogo;
    for (const variant of [0, 2, 3, 0]) {
      await page.evaluate(variant => window.contentFixture.logo(true, variant), variant);
      await page.waitForFunction(old => {
        const image = window.contentFixture.logoVisual(); return image && image.id !== old;
      }, {}, lastLogo);
      const state = await page.evaluate(() => ({ logo: window.contentFixture.logoVisual(), detail: window.contentFixture.signDetails(), hero: window.contentFixture.hero(), scene: window.contentFixture.snapshot() }));
      lastLogo = state.logo.id;
      assert.equal(state.scene.progress, .5); assert.equal(state.scene.time, 7);
      assert.equal(state.logo.aspect, variant === 2 ? 3 : variant === 3 ? 1 / 3 : 1);
      assert.equal(state.logo.copies, 1);
      assert.equal(state.hero.texture, original.texture);
      assert.notEqual(state.hero.pixels, original.pixels);
      const hero = state.detail.maps.find(m => m.id === 'qfront-vision');
      assert.equal(hero.texture, state.hero.texture); assert.ok(hero.borrowed);
      assert.ok(state.detail.maps.every(m => m.texture !== state.logo.texture));
      await page.evaluate(() => window.contentFixture.track());
      assert.deepEqual(await page.evaluate(() => window.contentFixture.disposals()), []);
    }
    await page.evaluate(() => window.contentFixture.logo(false));
    assert.deepEqual(await page.evaluate(() => window.contentFixture.hero()), original);
    assert.equal(await page.evaluate(() => window.contentFixture.logoVisual()), null);
    await page.evaluate(async () => {
      window.contentFixture.logo(true, 2); window.contentFixture.logo(true, 3); window.contentFixture.logo(false);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    assert.equal(await page.evaluate(() => window.contentFixture.logoVisual()), null, 'A cancelled logo load restored a stale image');
    assert.deepEqual(await page.evaluate(() => window.contentFixture.hero()), original);
    // Repeated 3D -> QR turns reuse the expensive static base correspondence.
    const base = await page.evaluate(() => window.contentFixture.morph().baseIdentity);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.contentFixture.progress(0));
      const measurement = await page.evaluate(() => window.contentFixture.measureProgress(.15));
      assert.equal(measurement.compileMs, 0);
      assert.equal(await page.evaluate(() => window.contentFixture.morph().baseIdentity), base);
      report.cases.push({ repeated: i, measurements: [measurement] });
    }
    for (const [width, height] of [[390, 844], [320, 568]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.designqr-webgl-canvas');
        return canvas?.width === canvas.clientWidth * 2 && canvas.height === canvas.clientHeight * 2;
      });
      await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      await page.evaluate(() => { window.contentFixture.progress(.5); window.contentFixture.logo(true, 2); });
      await page.waitForFunction(() => !!window.contentFixture.logoVisual());
      await page.screenshot({ path: join(directory, `${width}-logo-morph.png`) });
      await page.evaluate(() => window.contentFixture.zoom(3));
      await page.screenshot({ path: join(directory, `${width}-logo-morph-zoom.png`) });
      await page.evaluate(() => { window.contentFixture.zoom(1); window.contentFixture.progress(1); });
      assert.equal(await decode((await page.evaluate(() => window.contentFixture.exported())).bytes), 'https://example.com/shibuya');
      await page.evaluate(() => window.contentFixture.logo(false));
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.contentFixture.unmount()), []);
  console.log(`Sign/logo morph and timing checks passed. Captures: ${directory}`);
} finally {
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
