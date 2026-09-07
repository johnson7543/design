import * as THREE from 'three';
import { ShibuyaScene } from '../../../packages/designqr/src/renderer/webgl/ShibuyaScene';
import { DESIGN_QR_THEME_PRESETS } from '../../../packages/designqr/src/designs/tree/themes';
import { generateQRMatrix } from '../../../packages/designqr/src/designs/tree/qr';
import { createCityBuildings } from '../../../packages/designqr/src/designs/city/layout';
import { cityBuildingPanels, cityPanelAnchor, type CityFacadePanel } from '../../../packages/designqr/src/designs/city/architecture';
import { createShibuyaStationGeometry } from '../../../packages/designqr/src/designs/city/station-geometry';
import { CITY_SIGN_DESIGNS, paintCitySign } from '../../../packages/designqr/src/designs/city/sign-artwork';
import { citySignTextureSize } from '../../../packages/designqr/src/designs/city/sign-rendering';
import { SHIBUYA_PALETTE as P } from '../../../packages/designqr/src/designs/city/palette';

interface TextRun { label: string; fontPixels: number; left: number; right: number; top: number; bottom: number; arguments: number }
const runs = new WeakMap<HTMLCanvasElement, TextRun[]>();
const nativeText = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function(label, x, y, ...rest: number[]) {
  const metrics = this.measureText(label), recorded = runs.get(this.canvas) ?? [];
  recorded.push({ label, fontPixels: Number(this.font.match(/([\d.]+)px/)![1]), arguments: 3 + rest.length,
    left: x - metrics.actualBoundingBoxLeft, right: x + metrics.actualBoundingBoxRight,
    top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent });
  runs.set(this.canvas, recorded);
  if (rest.length) nativeText.call(this, label, x, y, rest[0]);
  else nativeText.call(this, label, x, y);
};

const modules = generateQRMatrix('https://example.com/shibuya', 'H').modules;
const transit = createShibuyaStationGeometry();
const panels = [...createCityBuildings(modules).flatMap(cityBuildingPanels), ...transit.panels];
transit.geometry.dispose(); transit.glassGeometry.dispose();
const city = new ShibuyaScene(modules, DESIGN_QR_THEME_PRESETS.shibuya);
city.root.scale.setScalar(1);
for (let i = 0; i < 200 && city.assetStatus !== 'ready'; i++) {
  city.update(0, 0, true);
  await new Promise(resolve => setTimeout(resolve, 25));
}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1200, 760); renderer.setPixelRatio(1); renderer.localClippingEnabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.pavement);
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const meshFor = (p: CityFacadePanel) => city.root.getObjectByName('shibuya-sign-' + p.id) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
const textureFor = (p: CityFacadePanel) => meshFor(p).material.map as THREE.CanvasTexture;
const textures = () => [...new Set(panels.map(textureFor))];
const pixelBytes = (width: number, height: number) => {
  let pixels = width * height;
  while (width > 1 || height > 1) {
    width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2)); pixels += width * height;
  }
  return pixels * 4;
};
const dispose = (target: ShibuyaScene) => {
  target.dispose();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), maps = new Set<THREE.Texture>();
  target.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    if (object instanceof THREE.InstancedMesh) object.dispose();
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(m); if ('map' in m && m.map instanceof THREE.Texture) maps.add(m.map);
    }
  });
  for (const t of maps) t.dispose(); for (const m of materials) m.dispose(); for (const g of geometries) g.dispose();
};

const fixture = {
  report() {
    const inventory = panels.map(p => {
      const t = textureFor(p), canvas = t.image as HTMLCanvasElement;
      const uv = meshFor(p).geometry.getAttribute('uv');
      return { id: p.id, transit: p.transit, pixels: [canvas.width, canvas.height],
        shapeScale: (p.width / p.height) / (canvas.width / canvas.height),
        uvEnd: Math.max(...Array.from({ length: uv.count }, (_, i) => uv.getX(i))),
        anisotropy: t.anisotropy, runs: runs.get(canvas) ?? [] };
    });
    return { assetStatus: city.assetStatus, inventory, uniqueTextures: textures().length,
      bytesWithMipmaps: textures().reduce((n, t) => n + pixelBytes(t.image.width, t.image.height), 0),
      formerBytesWithMipmaps: panels.reduce((n, p) => {
        const edge = p.transit ? 1536 : 512, minimum = p.transit ? 32 : 128;
        return n + pixelBytes(Math.max(minimum, Math.round(edge * p.width / Math.max(p.width, p.height))),
          Math.max(minimum, Math.round(edge * p.height / Math.max(p.width, p.height))));
      }, 0) };
  },
  allDesigns() {
    const result = [];
    for (const [index, design] of CITY_SIGN_DESIGNS.entries()) for (const aspect of [.35, .6, 1, 2, 4, 10, 20]) {
      const size = citySignTextureSize({ id: 'test', width: aspect, height: 1 });
      const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
      paintCitySign(canvas.getContext('2d')!, design);
      result.push({ index, aspect, ...size, runs: runs.get(canvas) ?? [] });
    }
    return result;
  },
  detail(id: string, magnification = 1, yaw = 0) {
    scene.clear();
    const panel = panels.find(p => p.id === id)!, mesh = meshFor(panel), anchor = cityPanelAnchor(panel);
    scene.add(new THREE.Mesh(mesh.geometry, mesh.material));
    const span = Math.max(panel.height, panel.width / (1200 / 760)) * .60 / magnification;
    const camera = new THREE.OrthographicCamera(-span*1200/760, span*1200/760, span, -span, .001, 10);
    const target = new THREE.Vector3(anchor.x, panel.y, anchor.z);
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(anchor.angle + yaw), 0, Math.cos(anchor.angle + yaw)));
    camera.lookAt(target); renderer.render(scene, camera);
    return { calls: renderer.info.render.calls, width: renderer.domElement.width, height: renderer.domElement.height };
  },
  lifecycle() {
    // Build a second player without loading/attaching another model set.
    const other = new ShibuyaScene(modules, DESIGN_QR_THEME_PRESETS.shibuya, () => new Promise(() => {}));
    const hero = panels.find(p => p.hero)!, mainMap = textureFor(hero);
    const otherMap = (other.root.getObjectByName('shibuya-sign-' + hero.id) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.map as THREE.CanvasTexture;
    const staticIsolated = panels.every(p => {
      const otherMesh = other.root.getObjectByName('shibuya-sign-' + p.id) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      return otherMesh.material.map !== textureFor(p);
    });
    const paired = ['A6a', 'A6b', 'A7a'].every(exit => textureFor(panels.find(p => p.id === `subway-${exit}-entry`)!)
      === textureFor(panels.find(p => p.id === `subway-${exit}-rear`)!));
    const original = (mainMap.image as HTMLCanvasElement).toDataURL();
    const versions = textures().map(t => t.version);
    city.setLogoPresent(true);
    const replaced = (mainMap.image as HTMLCanvasElement).toDataURL() !== original;
    const isolated = otherMap !== mainMap && (otherMap.image as HTMLCanvasElement).toDataURL() === original;
    const unaffected = textures().every((t, i) => t === mainMap || t.version === versions[i]);
    city.setLogoPresent(false);
    const restored = (mainMap.image as HTMLCanvasElement).toDataURL() === original;
    const settledVersions = textures().map(t => t.version);
    const camera = new THREE.OrthographicCamera(-.65, .65, .65, -.65, .001, 10);
    camera.position.set(0, 2, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
    scene.clear(); scene.add(city.root);
    city.update(1, 0, true); renderer.render(scene, camera);
    const qr = renderer.domElement.toDataURL();
    const hiddenAtQR = panels.every(p => !meshFor(p).parent!.visible);
    for (const progress of [.5, .2, 0, .2, .5, 1]) {
      city.update(progress, 0, true); renderer.render(scene, camera);
    }
    const sameQR = qr === renderer.domElement.toDataURL();
    const noUploads = textures().every((t, i) => t.version === settledVersions[i]);
    const count = textures().length;
    dispose(other);
    city.update(0, 0, true);
    return { replaced, isolated, staticIsolated, paired, unaffected, restored, hiddenAtQR, sameQR, noUploads, count };
  },
  dispose() { dispose(city); renderer.dispose(); }
};
(window as unknown as { signFixture: typeof fixture }).signFixture = fixture;
fixture.detail('qfront-vision');
