import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import puppeteer from 'puppeteer-core';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'designqr-streets-'));
const source = join(root, 'packages/designqr/src/designs/city');
await writeFile(join(directory, 'index.html'), '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>');
await writeFile(join(directory, 'main.js'), `
import * as THREE from ${JSON.stringify(join(root, 'node_modules/three/build/three.module.js'))};
import { createShibuyaRoadGeometry, createShibuyaRoadMaterial } from ${JSON.stringify(join(source, 'road-mesh.ts'))};
import { createShibuyaStreetFurniture } from ${JSON.stringify(join(source, 'street-furniture.ts'))};
import { SHIBUYA_CENTER_GAI_ENTRANCE, SHIBUYA_STREET_SIGNALS, cityStreetFrame } from ${JSON.stringify(join(source, 'street-layout.ts'))};
import { citySurveyPoint, roadMetres, CITY_PAVEMENT_HEIGHT } from ${JSON.stringify(join(source, 'road-network.ts'))};
import { SHIBUYA_PALETTE as P } from ${JSON.stringify(join(source, 'palette.ts'))};
document.body.style.margin = '0';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.paper);
const material = new THREE.MeshBasicMaterial({ vertexColors: true });
const street = createShibuyaStreetFurniture();
scene.add(new THREE.Mesh(createShibuyaRoadGeometry(), [createShibuyaRoadMaterial(), material]), new THREE.Mesh(street.geometry, material), new THREE.Mesh(street.lightGeometry, material));
const pos = (p, height) => new THREE.Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(height), p.z);
const moved = (p, d, m) => ({ x: p.x + d.x * roadMetres(m), z: p.z + d.z * roadMetres(m) });
window.streetFixture = {
  view(name, time = 4) {
    let camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .001, 10);
    if (name === 'plan' || name === 'reference-plan') {
      camera = new THREE.OrthographicCamera(-.55 * innerWidth / innerHeight, .55 * innerWidth / innerHeight, .55, -.55, .001, 10);
      camera.position.set(0, 2, 0);
      // Rotate only the inspection camera: Center-Gai is on the right, as in
      // the supplied bird's-eye drawing. Never mirror or rotate the road data.
      camera.up.set(name === 'reference-plan' ? -1 : 0, 0, name === 'reference-plan' ? 0 : -1);
      camera.lookAt(0, 0, 0);
    } else if (name.startsWith('markings-')) {
      const frame = cityStreetFrame(name.slice(9), 18);
      camera = new THREE.OrthographicCamera(-.23 * innerWidth / innerHeight, .23 * innerWidth / innerHeight, .23, -.23, .001, 10);
      camera.position.set(frame.position.x, 2, frame.position.z);
      camera.up.set(frame.forward.x, 0, frame.forward.z); camera.lookAt(pos(frame.position, 0));
    } else if (name === 'entrance') {
      const e = SHIBUYA_CENTER_GAI_ENTRANCE;
      const center = { x: (e.posts[0].x + e.posts[1].x) / 2, z: (e.posts[0].z + e.posts[1].z) / 2 };
      camera.position.copy(pos(moved(center, e.facing, 11), 3.3)); camera.lookAt(pos(center, 3.3));
    } else if (name === 'signal') {
      const s = SHIBUYA_STREET_SIGNALS.find(s => s.crossing === 'jingu' && s.vehicle?.curbSide === 'incoming');
      const head = moved(s.position, s.vehicle.armDirection, 1.9);
      camera.position.copy(pos(moved(head, s.vehicle.facing, 12), 3.9)); camera.lookAt(pos(head, 3.2));
    } else if (name.startsWith('pair-')) {
      const arm = name.slice(5), pair = SHIBUYA_STREET_SIGNALS.filter(s => s.crossing === arm);
      const a = pair[0].position, b = pair[1].position;
      const center = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const span = Math.hypot(a.x - b.x, a.z - b.z) / roadMetres(1), frame = cityStreetFrame(arm, 0);
      const viewpoint = moved(moved(center, frame.forward, Math.max(24, span * 1.1)), frame.lateral, span * .12);
      camera.position.copy(pos(viewpoint, 15)); camera.lookAt(pos(center, 2.5));
    } else {
      camera.position.copy(pos(citySurveyPoint(60, 65), 62)); camera.lookAt(pos(citySurveyPoint(0, 0), 0));
    }
    street.setTime(time); renderer.render(scene, camera);
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      width: renderer.domElement.width, height: renderer.domElement.height,
      lightVersion: street.lightGeometry.getAttribute('color').version,
      vehicleHeads: SHIBUYA_STREET_SIGNALS.filter(s => s.vehicle).length };
  }
};
window.streetFixture.view('plan');
`);
let server, browser;
try {
  await build({ configFile: false, root: directory, logLevel: 'warn', build: { outDir: 'dist' } });
  server = await preview({ configFile: false, root: directory, logLevel: 'warn', preview: { host: '127.0.0.1', port: 4194, strictPort: true } });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4194', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.streetFixture);
  let baseline;
  for (const [view, time] of [['plan', 4], ['reference-plan', 4], ['crossing', 4], ['entrance', 4],
    ['markings-hachiko', 4], ['markings-dogenzaka', 4], ['markings-jingu', 4], ['markings-station-east', 4],
    ['pair-jingu', 4], ['pair-dogenzaka', 4], ['pair-hachiko', 4], ['pair-station-east', 4], ['signal', 4], ['signal', 13]]) {
    const stats = await page.evaluate((v, t) => window.streetFixture.view(v, t), view, time);
    assert.equal(stats.calls, 4, 'Carriageway, pavement, static fixtures and signal aspects must each be one draw call.');
    assert.ok(stats.triangles < 35000, JSON.stringify(stats));
    assert.equal(stats.vehicleHeads, 8, 'Each of the four vehicle approaches needs two overhead heads.');
    assert.equal(stats.width, 1440); assert.equal(stats.height, 1000);
    if (time === 4) {
      if (baseline) assert.equal(stats.lightVersion, baseline.lightVersion, 'Static phases must not upload colors again.');
      baseline = stats;
    } else assert.ok(stats.lightVersion > baseline.lightVersion);
    await page.screenshot({ path: join(directory, view + '-' + time + '.png') });
    console.log(view, time, stats);
  }
  assert.deepEqual(errors, []);
  console.log('Shared road / street detail captures:', directory);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
