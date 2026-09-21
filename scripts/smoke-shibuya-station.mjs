import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { shibuyaAssetPlugin } from './shibuya-asset-plugin.mjs';
import { dotonboriAssetPlugin } from './dotonbori-asset-plugin.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'designqr-station-'));
const src = join(root, 'packages/designqr/src'), port = Number(process.env.DESIGNQR_STATION_PORT ?? 4195);
await writeFile(join(directory, 'index.html'), '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `
import * as THREE from ${JSON.stringify(join(root, 'node_modules/three/build/three.module.js'))};
import { ShibuyaScene } from ${JSON.stringify(join(src, 'renderer/webgl/ShibuyaScene.ts'))};
import { DESIGN_QR_THEME_PRESETS } from ${JSON.stringify(join(src, 'designs/tree/themes.ts'))};
import { generateQRMatrix } from ${JSON.stringify(join(src, 'designs/tree/qr.ts'))};
import { citySurveyPoint, roadMetres, CITY_PAVEMENT_HEIGHT } from ${JSON.stringify(join(src, 'designs/city/road-network.ts'))};
import { SHIBUYA_SUBWAY_ENTRANCES, citySubwayPoint } from ${JSON.stringify(join(src, 'designs/city/station-layout.ts'))};
import { SHIBUYA_PALETTE as P } from ${JSON.stringify(join(src, 'designs/city/palette.ts'))};
import { createCityBuildings } from ${JSON.stringify(join(src, 'designs/city/layout.ts'))};
import { cityStationFrontageFrame } from ${JSON.stringify(join(src, 'designs/city/station-frontage-layout.ts'))};
import { HACHIKO_MONUMENT } from ${JSON.stringify(join(src, 'designs/city/hachiko-layout.ts'))};
document.body.style.margin = '0';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.localClippingEnabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.paper);
let city;
const pos = (p, h) => new THREE.Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(h), p.z);
const geo = (east, south, height) => pos(citySurveyPoint(east, south), height);
const frontage = cityStationFrontageFrame(createCityBuildings([[true]]).find(b => b.kind === 'station-front'));
const front = (u, depth, height) => pos(frontage.point(u, depth), height);
const dispose = () => {
  if (!city) return;
  city.dispose(); scene.remove(city.root);
  const geometries = new Set(), materials = new Set();
  city.root.traverse(o => { if (!o.isMesh) return;
    geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    if (o.isInstancedMesh) o.dispose();
  });
  for (const g of geometries) g.dispose(); for (const m of materials) { m.map?.dispose(); m.dispose(); }
};
window.stationFixture = {
  async init() {
    dispose(); city = new ShibuyaScene(generateQRMatrix('https://github.com/johnson7543/design', 'H').modules,
      DESIGN_QR_THEME_PRESETS.shibuya); city.root.scale.setScalar(1); scene.add(city.root);
    for (let i = 0; i < 200 && city.assetStatus !== 'ready'; i++) {
      city.update(0, 0, true); await new Promise(resolve => setTimeout(resolve, 25));
    }
    return city.assetStatus;
  },
  view(name, progress = 0) {
    renderer.setSize(innerWidth, innerHeight);
    city.update(progress, 0, true);
    let camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .001, 10);
    const entrance = SHIBUYA_SUBWAY_ENTRANCES.find(e => name === e.id || name === e.id + '-stairs');
    if (entrance) {
      const stairs = name.endsWith('-stairs');
      camera.position.copy(pos(citySubwayPoint(entrance, stairs ? -1.8 : -4.5, entrance.length / 2 + (stairs ? 5 : 10)), stairs ? 5.4 : 4.3));
      camera.lookAt(pos(citySubwayPoint(entrance, 0, stairs ? .8 : 0), stairs ? -.25 : 1.1));
    } else if (name.startsWith('hachiko-')) {
      const { eastMetres: e, southMetres: s } = HACHIKO_MONUMENT;
      const views = { 'hachiko-square': [26, 15, 24], 'hachiko-front': [9, .5, 3.8],
        'hachiko-profile': [5, 8, 4.5], 'hachiko-rear': [-6, 2, 4] };
      const [east, south, height] = views[name];
      camera.position.copy(geo(e + east, s + south, height));
      camera.lookAt(geo(e, s + (name === 'hachiko-square' ? -3 : 0), 1.5));
    } else if (name === 'station-trees') {
      camera.position.copy(geo(12, -8, 12)); camera.lookAt(geo(29, 20, 4));
    } else if (name === 'west-south-alleys') {
      camera = new THREE.OrthographicCamera(-.30, .30, .23, -.23, .001, 10);
      camera.position.copy(geo(-48, 28, 120)); camera.up.set(-Math.SQRT1_2, 0, -Math.SQRT1_2);
      camera.lookAt(geo(-48, 28, 0));
    } else if (name === 'construction') {
      camera.position.copy(geo(-8, 110, 43)); camera.lookAt(geo(20, 66, 2));
    } else if (name === 'construction-front') {
      camera.position.copy(geo(8, 44, 8)); camera.lookAt(geo(31, 60, 2));
    } else if (name === 'mark-city') {
      camera.position.copy(geo(-5, 33, 17)); camera.lookAt(geo(-17, 77, 7));
    } else if (name === 'mark-city-underpass') {
      camera.position.copy(geo(-16, 47, 2.8)); camera.lookAt(geo(-19, 85, 3));
    } else if (name === 'police') {
      camera.position.copy(front(2.2, -16, 6.0)); camera.lookAt(front(4.8, .3, 4.1));
    } else if (name === 'police-balcony') {
      camera.position.copy(front(1.2, -9, 7.0)); camera.lookAt(front(5.3, .5, 4.6));
    } else if (name === 'station-entry') {
      camera.position.copy(front(15, -22, 5)); camera.lookAt(front(17.5, 1.2, 4.5));
    } else if (name === 'station-roof') {
      camera.position.copy(front(15, 18, 19)); camera.lookAt(front(21, 1, 9));
    } else if (name === 'facade') {
      camera.position.copy(geo(-4, 19, 16)); camera.lookAt(geo(45, 37, 6.5));
    } else if (name === 'bridge') {
      camera.position.copy(geo(27, 5, 5)); camera.lookAt(geo(67, 6, 5.8));
    } else if (name === 'bridge-approach') {
      camera.position.copy(geo(0, -4, 23)); camera.lookAt(geo(48, 6, 1));
    } else if (name === 'station') {
      camera.position.copy(geo(-48, -33, 55)); camera.lookAt(geo(28, 26, 3));
    } else if (name === 'plan' || name === 'qr') {
      const span = name === 'qr' ? .58 : .65, aspect = innerWidth / innerHeight;
      camera = new THREE.OrthographicCamera(-span * aspect, span * aspect, span, -span, .001, 10);
      camera.position.set(0, 2, 0); camera.up.set(Math.SQRT1_2, 0, -Math.SQRT1_2); camera.lookAt(0, 0, 0);
    } else {
      camera.position.copy(geo(0, 150, 120)); camera.lookAt(geo(0, 0, 5));
    }
    renderer.render(scene, camera);
    const structure = city.root.getObjectByName('shibuya-station-and-subway-entrances');
    const glass = city.root.getObjectByName('shibuya-subway-glazing');
    const balcony = city.root.getObjectByName('shibuya-police-balcony-glazing');
    return { assetStatus: city.assetStatus, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      structureTriangles: structure.geometry.attributes.position.count / 3,
      cityVisible: structure.parent.visible, glassOpacity: glass.material.opacity,
      balconyOpacity: balcony.material.opacity,
      buffers: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  }
};
await window.stationFixture.init(); window.stationFixture.view('station');
`);
let server, browser;
try {
  await build({ configFile: false, root: directory, plugins: [shibuyaAssetPlugin(), dotonboriAssetPlugin()], logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.stationFixture);
  assert.equal(await page.evaluate(() => window.stationFixture.view('station').assetStatus), 'ready');
  for (const name of ['plan', 'west-south-alleys', 'crossing', 'station', 'station-trees', 'construction', 'construction-front', 'mark-city', 'mark-city-underpass', 'hachiko-square', 'hachiko-front', 'hachiko-profile', 'hachiko-rear',
    'facade', 'police', 'police-balcony', 'station-entry', 'station-roof', 'bridge', 'bridge-approach', 'A6a', 'A6b', 'A7a', 'A6b-stairs']) {
    const stats = await page.evaluate(name => window.stationFixture.view(name), name);
    assert.ok(stats.structureTriangles < 16000); assert.equal(stats.glassOpacity, .28);
    assert.equal(stats.balconyOpacity, .38);
    await page.screenshot({ path: join(directory, name + '.png') });
    console.log(name, stats);
  }
  const qrFrame = () => page.evaluate(() => { window.stationFixture.view('qr', 1); return document.querySelector('canvas').toDataURL(); });
  const baseline = await qrFrame();
  for (const p of [1, .24, .12, 0, .12, .24, 1]) {
    const stats = await page.evaluate(p => window.stationFixture.view('qr', p), p);
    assert.equal(stats.cityVisible, p < .32); assert.ok(stats.glassOpacity >= 0 && stats.glassOpacity <= .28);
    assert.ok(stats.balconyOpacity >= 0 && stats.balconyOpacity <= .38);
  }
  assert.equal(await qrFrame(), baseline, 'The completed QR changed after returning from 3D.');
  assert.deepEqual(errors, []);
  console.log('Station and subway detail captures:', directory);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
