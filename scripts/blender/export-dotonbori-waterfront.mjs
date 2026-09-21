/** Snapshot the actual runtime geometry in metric ENU for editable Blender review.
 * node --experimental-strip-types scripts/blender/export-dotonbori-waterfront.mjs
 * Add --artwork to render the same original canvas painters with local Chromium.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Color, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readDotonboriAssets } from '../dotonbori-asset-plugin.mjs';
import { prepareDotonboriLibrary } from '../../packages/designqr/src/designs/city/dotonbori-assets.ts';
import { DotonboriScene } from '../../packages/designqr/src/renderer/webgl/DotonboriScene.ts';
import { DESIGN_QR_THEME_PRESETS } from '../../packages/designqr/src/designs/tree/themes.ts';
import { OSAKA_NIGHT_SWATCHES } from '../../packages/designqr/src/designs/city/palette.ts';
import { DOTONBORI_PALETTE } from '../../packages/designqr/src/designs/city/dotonbori-geometry.ts';
import { paintDotonboriGlico, paintDotonboriBridgeName } from '../../packages/designqr/src/designs/city/dotonbori-landmark.ts';
import { paintDotonboriStorefronts } from '../../packages/designqr/src/designs/city/dotonbori-storefront-artwork.ts';
import { paintDotonboriNightSigns } from '../../packages/designqr/src/designs/city/dotonbori-facades.ts';
import { DOTONBORI_SIGN_ARTWORK, DOTONBORI_SIGN_ATLAS, DOTONBORI_SIGN_GREEN } from '../../packages/designqr/src/designs/city/dotonbori-sign-layout.ts';
import { paintDotonboriGeneratedSigns, DOTONBORI_GENERATED_SIGN_DESIGNS } from '../../packages/designqr/src/designs/city/dotonbori-generated-signs.ts';
import { paintDotonboriLabel } from '../../packages/designqr/src/designs/city/dotonbori-lettering.ts';
import { DOTONBORI_LETTERING } from '../../packages/designqr/src/designs/city/dotonbori-lettering-data.ts';
import { paintCitySign } from '../../packages/designqr/src/designs/city/sign-artwork.ts';
import { paintCitySignText } from '../../packages/designqr/src/designs/city/sign-rendering.ts';
import { generateQRMatrix } from '../../packages/designqr/src/designs/tree/qr.ts';
import { dotonboriBuildingRanges } from '../../packages/designqr/src/designs/city/dotonbori-ownership.ts';
import { DOTONBORI_CAMERA_YAW_OFFSET, DOTONBORI_CAMERA_ELEVATION } from '../../packages/designqr/src/designs/city/dotonbori-layout.ts';

const root = new URL('../../', import.meta.url), out = new URL('assets/design-qr/dotonbori/', root);
const inputs = ['dotonbori-assets.ts', 'dotonbori-layout.ts', 'dotonbori-detail-layout.ts', 'dotonbori-geometry.ts', 'dotonbori-waterfront.ts', 'dotonbori-landmark.ts', 'dotonbori-activity.ts', 'dotonbori-facades.ts', 'dotonbori-sign-artwork.ts', 'dotonbori-storefronts.ts', 'dotonbori-storefront-artwork.ts', 'dotonbori-storefront-access.ts', 'dotonbori-storefront-access-data.ts', 'dotonbori-lettering.ts', 'dotonbori-lettering-data.ts', 'dotonbori-facade-layout.ts', 'dotonbori-walls.ts', 'dotonbori-river.ts', 'dotonbori-lighting.ts', 'dotonbori-composition.ts', 'dotonbori-ownership.ts', 'dotonbori-buildings.ts', 'dotonbori-generated-signs.ts', 'dotonbori-morph.ts', 'building-variation.ts', 'sign-artwork.ts', 'sign-rendering.ts']
  .map(name => `packages/designqr/src/designs/city/${name}`);
inputs.push('packages/designqr/src/renderer/webgl/DotonboriScene.ts', 'packages/designqr/src/designs/content-variation.ts',
  'packages/designqr/src/designs/city/dotonbori-transition.ts', 'packages/designqr/src/designs/city/dotonbori-surface-morph.ts', 'packages/designqr/src/designs/city/morph.ts',
  'packages/designqr/src/designs/city/morph-mesh.ts', 'packages/designqr/src/designs/city/morph-signs.ts',
  'assets/design-qr/dotonbori/focus-layout.json', 'assets/design-qr/dotonbori/focus-manifest.json', 'assets/design-qr/dotonbori/dotonbori-focus.glb',
  'assets/design-qr/dotonbori/waterfront-layout.json', 'scripts/blender/export-dotonbori-waterfront.mjs',
  'packages/designqr/src/designs/city/dotonbori-ground-floor-layout.ts', 'packages/designqr/src/designs/city/dotonbori-ground-floor-details.ts',
  'packages/designqr/src/designs/city/dotonbori-storefront-design.ts', 'packages/designqr/src/designs/city/dotonbori-storefront-displays.ts',
  'packages/designqr/src/designs/city/dotonbori-glico-animation.ts', 'packages/designqr/src/designs/city/dotonbori-cloth.ts',
  'packages/designqr/src/designs/city/dotonbori-action-batch.ts', 'packages/designqr/src/designs/city/dotonbori-shop-activity.ts', 'packages/designqr/src/designs/city/dotonbori-reactions.ts',
  'packages/designqr/src/designs/city/dotonbori-surface-finishes.ts', 'packages/designqr/src/designs/city/dotonbori-kani-facade.ts',
  'packages/designqr/src/designs/city/dotonbori-kani-sign.ts',
  'packages/designqr/src/designs/city/dotonbori-roof-details.ts',
  'packages/designqr/src/designs/city/dotonbori-depth-shading.ts', 'scripts/build-dotonbori-lettering.py',
  'packages/designqr/src/designs/city/dotonbori-facade-ribs.ts', 'packages/designqr/src/designs/city/dotonbori-ebisubashi-facade.ts',
  'packages/designqr/src/designs/city/dotonbori-sign-layout.ts',
  'packages/designqr/src/designs/city/dotonbori-wake.ts', 'packages/designqr/src/designs/city/dotonbori-water-area.ts',
  'packages/designqr/src/designs/city/dotonbori-ebisu-tower.ts', 'assets/design-qr/dotonbori/east-source-meshes.json');
const hashes = {};
for (const path of inputs) hashes[path] = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const data = await readDotonboriAssets(), groups = [];
for (const filename of ['dotonbori-focus.glb', 'dotonbori-bridge-deck-study.glb']) {
  const bytes = await readFile(new URL(filename, out));
  groups.push((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene);
}
const library = prepareDotonboriLibrary(groups[0], groups[1], data);
const value = 'https://example.com/dotonbori', modules = generateQRMatrix(value).modules;
const scene = new DotonboriScene(modules, DESIGN_QR_THEME_PRESETS.dotonbori, async () => library);
await Promise.resolve(); scene.update(0, 0, true); scene.root.updateMatrixWorld(true);
const reviewViews = {};
const openingYaw = Math.PI / 4 + DOTONBORI_CAMERA_YAW_OFFSET;
// Keep the established orbit distance when lowering the opening camera.
const eye = new Vector3(Math.sin(openingYaw) * Math.cos(DOTONBORI_CAMERA_ELEVATION),
  Math.sin(DOTONBORI_CAMERA_ELEVATION), Math.cos(openingYaw) * Math.cos(DOTONBORI_CAMERA_ELEVATION))
  .applyAxisAngle(new Vector3(0, 1, 0), -data.layout.rotationYRadians).multiplyScalar(data.layout.tileSizeM * 1.88);
const openingEye = [data.layout.centerEastNorthM[0] + eye.x, data.layout.centerEastNorthM[1] - eye.z, 10 + eye.y];
for (const [name, eye] of [['east', [211, 128, 245]], ['default', openingEye]]) {
  reviewViews[name] = { eye, target: [...data.layout.centerEastNorthM, 10] };
}
scene.root.updateMatrixWorld(true);
const inverse = scene.root.matrixWorld.clone().invert(), objects = new Map(), vertexMaps = new Map();
const round = n => Math.round(n * 1e6) / 1e6;
const add = (mesh, matrix, id, instanceColor, range) => {
  const geometry = mesh.geometry, pos = geometry.getAttribute('position'), color = geometry.getAttribute('color'), index = geometry.index;
  const sourceBuilding = range?.building ?? mesh.userData.sourceBuilding;
  const record = objects.get(id) ?? { id, evidence: mesh.userData.evidence ?? (id.startsWith('bldg_') ? 'source footprint; QR-generated height'
    : id.includes('qr-') ? 'QR-generated illustrative architecture/artwork'
      : id.includes('pedestrian') || id.includes('boat') ? 'reference-directed miniature; representative activity pose' : 'source-linked illustrative detail'
    ), sourceBuilding,
    positions: [], colors: [], uv: [], triangles: [] };
  const uv = geometry.getAttribute('uv');
  const vertexMap = vertexMaps.get(id) ?? new Map(); vertexMaps.set(id, vertexMap);
  if (mesh.name === 'dotonbori-glico-sign') record.texture = 'glico-panel.png';
  if (mesh.name === 'dotonbori-storefront-artwork') record.texture = 'storefronts.png';
  if (mesh.name === 'dotonbori-night-signs') record.texture = 'night-signs.png';
  if (mesh.name === 'dotonbori-qr-generated-signs') record.texture = 'generated-signs.png';
  if (mesh.name.startsWith('dotonbori-bridge-name')) record.texture = 'bridge-name.png';
  const point = new Vector3(), sitePoint = new Vector3(), ink = new Color();
  const start = range?.start ?? 0, count = range?.count ?? index?.count ?? pos.count;
  for (let i = start; i < start + count; i++) {
    const v = index ? index.getX(i) : i;
    // Inactive wave slots have no rendered geometry. Alpha is uniform per quad.
    if ((i - start) % 3 === 0 && color?.itemSize === 4 && color.getW(v) <= .0001) { i += 2; continue; }
    sitePoint.fromBufferAttribute(pos, v).applyMatrix4(matrix);
    point.copy(sitePoint).multiplyScalar(data.layout.tileSizeM)
      .applyAxisAngle(new Vector3(0, 1, 0), -data.layout.rotationYRadians);
    const coordinates = [round(point.x + data.layout.centerEastNorthM[0]), round(-point.z + data.layout.centerEastNorthM[1]), round(point.y)];
    // Node has no canvas, so textured meshes use a colored runtime fallback.
    // The Blender review loads the actual artwork; do not tint it by that fallback.
    if (record.texture) ink.setScalar(1); else if (color) ink.fromBufferAttribute(color, v); else ink.copy(mesh.material.color);
    if (instanceColor) ink.multiply(instanceColor);
    if (color?.itemSize === 4) ink.lerp(new Color(DOTONBORI_PALETTE.water), 1 - color.getW(v));
    mesh.material.userData.dotonboriLightAt?.(sitePoint, ink);
    const paint = ink.toArray().map(round), textureUV = record.texture && uv ? [uv.getX(v), uv.getY(v)] : [];
    const key = [...coordinates, ...paint, ...textureUV].join(',');
    let target = vertexMap.get(key);
    if (target === undefined) {
      target = record.positions.length / 3; vertexMap.set(key, target);
      record.positions.push(...coordinates); record.colors.push(...paint); record.uv.push(...textureUV);
    }
    record.triangles.push(target);
  }
  objects.set(id, record);
};
scene.root.getObjectByName('dotonbori-source-study').traverse(object => {
  if (!(object instanceof Mesh)) return;
  const ranges = dotonboriBuildingRanges(object.geometry);
  if (!object.visible) return;
  const base = new Matrix4().multiplyMatrices(inverse, object.matrixWorld);
  if (object instanceof InstancedMesh) for (let i = 0; i < object.count; i++) {
    const instance = new Matrix4(), color = new Color(); object.getMatrixAt(i, instance); object.getColorAt(i, color);
    add(object, base.clone().multiply(instance), `${object.name}-${object.name === 'dotonbori-ebisu-cabins' ? i : Math.floor(i / 8)}`, color);
  }
  else if (!object.userData.sourceBuilding && ranges.some(r => r.building)) {
    for (const range of ranges) if (range.count) add(object, base, range.building ? `${object.name}--${range.building}` : object.name, undefined, range);
  } else add(object, base, object.name);
});
const result = { schema: 'designqr-dotonbori-waterfront-review', version: 3, axes: ['east', 'north', 'height'], units: 'metres',
  status: 'All 58 selected buildings visible from every rotation, with QR-generated architecture and compact, bridge-centered Ebisu Tower placement; 8 cropped edge fragments and 6 displaced context buildings omitted; not a surveyed reconstruction',
  content: { value, grid: modules.length },
  reviewViews,
  sources: hashes, objects: [...objects.values()] };
await writeFile(new URL('waterfront-review-meshes.json', out), JSON.stringify(result) + '\n');
const frontages = [...scene.root.getObjectByName('dotonbori-photo-facade-details').userData.storefronts,
  scene.root.getObjectByName('dotonbori-ebisu-tower').userData.storefront];
const byBuilding = scene.root.userData.groundFloorCoverage;
const totals = Object.fromEntries(['bays', 'entrances', 'counters', 'menus', 'lanterns'].map(key => [key, frontages.reduce((n, f) => n + f[key], 0)]));
await writeFile(new URL('docs/designqr-package/cities/dotonbori/references/ground-floor-coverage.json', root), JSON.stringify({
  schema: 'designqr-dotonbori-ground-floor-coverage', version: 2, content: { value, grid: modules.length },
  status: 'All eligible exposed ground-floor source-wall intervals receive fitted detail; generated uses are not a surveyed tenant inventory.',
  method: 'Ground-level source walls, 0.45 m maximum sample spacing, full 3.1 m wall support for generated shop fittings, clipped surface detail for partial walls, existing frontage reservation, neighbor/crop clearance and source floor levels. Context relief uses at most 42% of available clearance, capped at 0.62 m. Functional entrances require a supported pavement level within 0.16 m. B046-south has a source-fitted 3.65 m entrance/eave composition; its pictured entrance reveal is not counted as a functional entrance because the street walking datum is unresolved. Covered metres sum wall-section widths, including partial sections at different heights.',
  exclusions: 'Tile-cut caps, shared/blocked walls, unsupported source-wall intervals and strips narrower than 0.65 m remain structural. All 58 selected building bodies are retained; 8 cropped edge fragments and 6 displaced context buildings are omitted at asset generation.',
  frontageDesign: 'Uneven bay widths and complementary service/display/seating/glazing roles replace cloned complete shops. Known corner hosts share finishes; context display arrangements respond to QR content. Layout keys identify illustrative facade treatments, not real tenants. Menus and awnings are localized to the service area. Four coordinated artwork variants occupy 48 cells in one retained 2048x1536 atlas.',
  sources: hashes, summary: { buildings: byBuilding.length, detailedBuildings: byBuilding.filter(b => b.contextFronts || b.registeredFronts).length,
    fronts: frontages.length, contextFronts: frontages.filter(f => f.context).length,
    coveredContextMetres: byBuilding.reduce((n, b) => n + b.coveredMetres, 0), ...totals },
  byBuilding, frontages,
}, null, 2) + '\n');
scene.dispose(); library.templates.forEach(t => t.geometry.dispose());
groups.forEach(group => group.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.material.dispose(); } }));
if (process.argv.includes('--artwork')) {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    for (const [name, w, h, painter] of [['glico-panel.png', 512, Math.round(512 * 20 / 10.38), paintDotonboriGlico], ['bridge-name.png', 512, 84, paintDotonboriBridgeName], ['night-signs.png', DOTONBORI_SIGN_ATLAS.width, DOTONBORI_SIGN_ATLAS.height, paintDotonboriNightSigns], ['storefronts.png', 2048, 1536, paintDotonboriStorefronts], ['generated-signs.png', 2048, 1024, paintDotonboriGeneratedSigns]]) {
      const png = await page.evaluate(({ w, h, paint, swatches, palette, designs, signPainter, textPainter, lettering, labelPainter, nightArtwork, nightAtlas, signGreen }) => {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        // Evaluate only this repository's own painter in the authoring browser.
        new Function('ctx', 'S', 'P', 'DOTONBORI_GENERATED_SIGN_DESIGNS', 'DOTONBORI_LETTERING', 'DOTONBORI_SIGN_ARTWORK', 'DOTONBORI_SIGN_ATLAS', 'DOTONBORI_SIGN_GREEN',
          `const paintDotonboriLabel = ${labelPainter}; const paintCitySignText = ${textPainter}; const paintCitySign = ${signPainter}; (${paint})(ctx)`)
          (canvas.getContext('2d'), swatches, palette, designs, lettering, nightArtwork, nightAtlas, signGreen);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { w, h, paint: painter.toString(), swatches: OSAKA_NIGHT_SWATCHES, palette: DOTONBORI_PALETTE,
        designs: DOTONBORI_GENERATED_SIGN_DESIGNS, signPainter: paintCitySign.toString(), textPainter: paintCitySignText.toString(), lettering: DOTONBORI_LETTERING, labelPainter: paintDotonboriLabel.toString(),
        nightArtwork: DOTONBORI_SIGN_ARTWORK, nightAtlas: DOTONBORI_SIGN_ATLAS, signGreen: DOTONBORI_SIGN_GREEN });
      await writeFile(new URL(name, out), Buffer.from(png, 'base64'));
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ file: fileURLToPath(new URL('waterfront-review-meshes.json', out)), objects: objects.size,
  triangles: result.objects.reduce((n, o) => n + o.triangles.length / 3, 0) }));
