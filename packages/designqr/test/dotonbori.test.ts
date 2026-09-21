import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Box3, BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Ray, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBB } from 'three/addons/math/OBB.js';
import { prepareDotonboriLibrary, validateDotonboriData, type DotonboriAssetData, type DotonboriLibrary } from '../src/designs/city/dotonbori-assets.ts';
import { dotonboriPlanGeometry, dotonboriRoofAt } from '../src/designs/city/dotonbori-morph.ts';
import { DotonboriScene } from '../src/renderer/webgl/DotonboriScene.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';
import { DESIGN_QR_THEME_PRESETS } from '../src/designs/tree/themes.ts';
import { decodeDesignQRConfig, encodeDesignQRConfig, normalizeDesignQRConfig } from '../src/config/index.ts';
import { build3DCity } from '../src/designs/city/cityBuilder.ts';
import { DOTONBORI_PEDESTRIAN_COUNT, DotonboriActivity, dotonboriBoatPose, dotonboriPedestrianPose, dotonboriPedestrianPoses } from '../src/designs/city/dotonbori-activity.ts';
import { dotonboriBridgePoint, dotonboriContains } from '../src/designs/city/dotonbori-detail-layout.ts';
import { createDotonboriRiver, DOTONBORI_WATER_REFLECTIONS } from '../src/designs/city/dotonbori-river.ts';
import { createDotonboriWake, DOTONBORI_WAKE_GROUP, DOTONBORI_WAKE_RINGS, DOTONBORI_WAKE_INTERVAL } from '../src/designs/city/dotonbori-wake.ts';
import { createCityQRTargets } from '../src/designs/city/qr-colors.ts';
import { DOTONBORI_REFERENCE_HOSTS } from '../src/designs/city/dotonbori-composition.ts';
import { DOTONBORI_CAMERA_YAW_OFFSET, DOTONBORI_CAMERA_ELEVATION } from '../src/designs/city/dotonbori-layout.ts';
import { CITY_PRESETS } from '../src/designs/city/presets.ts';
import { dotonboriBuildingRanges, type DotonboriFragment } from '../src/designs/city/dotonbori-ownership.ts';
import { DOTONBORI_GLICO_FOLD_RADIANS, DotonboriSurfaceMorph, mapDotonboriSurfaceIntervals, dotonboriFinderCell, dotonboriSurfacePoint } from '../src/designs/city/dotonbori-surface-morph.ts';
import { createDotonboriBuildings, createDotonboriBuildingDetails, dotonboriRoofSupport } from '../src/designs/city/dotonbori-buildings.ts';
import { frontPoint, resolveDotonboriFronts } from '../src/designs/city/dotonbori-facade-layout.ts';
import { DOTONBORI_STOREFRONT_ACCESS } from '../src/designs/city/dotonbori-storefront-access-data.ts';
import type { DotonboriPolygon } from '../src/designs/city/dotonbori-assets.ts';
import { createDotonboriFacades } from '../src/designs/city/dotonbori-facades.ts';
import { resolveDotonboriGroundFloors } from '../src/designs/city/dotonbori-ground-floor-layout.ts';
import { dotonboriBuildingWalls, clipWallPolygon, wallArea, wallCoverage, wallPoint, dotonboriSectionTriangle } from '../src/designs/city/dotonbori-walls.ts';
import { dotonboriFacadeRib } from '../src/designs/city/dotonbori-facade-ribs.ts';
import { createDotonboriKaniFacade } from '../src/designs/city/dotonbori-kani-facade.ts';
import { createDotonboriKaniSign, DOTONBORI_KANI_SIGN, DOTONBORI_KANI_PERIOD } from '../src/designs/city/dotonbori-kani-sign.ts';
import { DotonboriGeometry } from '../src/designs/city/dotonbori-geometry.ts';
import type { DotonboriSurfaceGeometry } from '../src/designs/city/dotonbori-surface-geometry.ts';
import { dotonboriCampaignFrame, dotonboriReferenceCampaigns } from '../src/designs/city/dotonbori-generated-signs.ts';
import { DOTONBORI_LETTERING } from '../src/designs/city/dotonbori-lettering-data.ts';
import { paintDotonboriNightSigns } from '../src/designs/city/dotonbori-sign-artwork.ts';
import { DOTONBORI_SIGN_ATLAS, DOTONBORI_SIGN_PANELS } from '../src/designs/city/dotonbori-sign-layout.ts';
import { DOTONBORI_GLICO_SIGN_ID } from '../src/designs/city/dotonbori-glico-animation.ts';
import { DOTONBORI_CLOTH_GROUP, DOTONBORI_NOREN, DOTONBORI_PENNANT, dotonboriBreeze } from '../src/designs/city/dotonbori-cloth.ts';
import { DOTONBORI_ACTION_GROUP } from '../src/designs/city/dotonbori-action-batch.ts';
import { DOTONBORI_SHOP_ACTIONS, dotonboriServiceState } from '../src/designs/city/dotonbori-shop-activity.ts';
import { DOTONBORI_BOAT_REACTION, DOTONBORI_VISITOR_REACTIONS, DOTONBORI_REACTION_VISITORS, dotonboriVisitorReaction } from '../src/designs/city/dotonbori-reactions.ts';
import { createDotonboriEbisuTower, dotonboriEbisuPath, DOTONBORI_EBISU,
  DOTONBORI_EBISU_CABINS, DOTONBORI_EBISU_PERIOD } from '../src/designs/city/dotonbori-ebisu-tower.ts';

function vertexIndices(geometry: BufferGeometry) {
  return geometry.index?.array ?? Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i);
}

const path = new URL('../../../assets/design-qr/dotonbori/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('study-manifest.json', path), 'utf8'));
const source = JSON.parse(readFileSync(new URL('east-source-meshes.json', path), 'utf8'));
const focus = JSON.parse(readFileSync(new URL('focus-manifest.json', path), 'utf8'));
const layout = JSON.parse(readFileSync(new URL('focus-layout.json', path), 'utf8'));
const bridgeStudy = JSON.parse(readFileSync(new URL('bridge-deck-study.json', path), 'utf8'));
const waterfront = JSON.parse(readFileSync(new URL('waterfront-layout.json', path), 'utf8'));
const data: DotonboriAssetData = { manifest, focus, layout, waterfront, buildings: '', bridge: '', plan: layout.plan };
const scenes: Group[] = [];
for (const filename of ['dotonbori-focus.glb', 'dotonbori-bridge-deck-study.glb']) {
  const bytes = readFileSync(new URL(filename, path));
  scenes.push((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '')).scene);
}
const library = prepareDotonboriLibrary(scenes[0], scenes[1], data);
const modules = generateQRMatrix('https://example.com/道頓堀').modules;
const theme = DESIGN_QR_THEME_PRESETS.dotonbori;

function triangleIntersectionArea(polygon: [number, number][], triangle: [number, number][]) {
  const [a, b, c] = triangle;
  const sign = Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let edge = 0; edge < 3; edge++) {
    const a = triangle[edge], b = triangle[(edge + 1) % 3], next: [number, number][] = [];
    const distance = (p: [number, number]) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length], dp = distance(p), dq = distance(q);
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    polygon = next;
  }
  return wallArea(polygon);
}

test('Dōtonbori survives canonical config round trips and selects its own renderer data', () => {
  const config = normalizeDesignQRConfig({ design: 'city', theme: 'dotonbori', value: '道頓堀', view: 'qr' });
  const decoded = decodeDesignQRConfig(encodeDesignQRConfig(config));
  assert.ok(decoded.ok); assert.deepEqual(decoded.value, config);
  assert.equal(build3DCity(modules, 'dotonbori').city?.preset, 'dotonbori');
  assert.equal(build3DCity(modules).city?.preset, 'shibuya');
});

test('source library preserves all 58 selected buildings and the dimensional bridge at one uniform scale', () => {
  assert.equal(library.templates.length, 59);
  const bounds = new Box3();
  let triangles = 0;
  for (const template of library.templates) {
    bounds.union(template.geometry.boundingBox!);
    triangles += template.geometry.getAttribute('position').count / 3;
  }
  assert.equal(triangles, 3732 + 860);
  assert.ok(Math.abs(bounds.max.y * layout.tileSizeM - Math.max(...focus.objects.map((o: { maximumHeightM: number }) => o.maximumHeightM))) < .00001);
  assert.ok(bounds.min.x >= -.500001 && bounds.max.x <= .500001 && bounds.min.z >= -.500001 && bounds.max.z <= .500001);
  const bad = structuredClone(data); bad.manifest.cropSizeM = 200;
  assert.throws(() => validateDotonboriData(bad), /contract/);
  assert.throws(() => prepareDotonboriLibrary(new Group(), scenes[1], data), /triangle count/);
  const obsolete = structuredClone(data); obsolete.focus.version = 2;
  assert.throws(() => validateDotonboriData(obsolete), /focus contract/);
  assert.ok(focus.objects.every((o: { nonManifoldEdges: number; retainedVertexMaxErrorM: number }) => o.nonManifoldEdges === 0 && o.retainedVertexMaxErrorM < .00003));
});

test('focused assets omit cropped edge remnants while retaining complete small buildings and substantial edge blocks', () => {
  assert.deepEqual(layout.omittedEdgeFragments.map((o: { auditLabel: string }) => o.auditLabel),
    ['B002', 'B013', 'B057', 'B059', 'B086', 'B091', 'B105', 'B115']);
  const bodies = library.templates.filter(t => t.kind === 'building');
  const candidates = [...layout.objects, ...layout.omittedEdgeFragments].sort((a, b) => a.variationIndex - b.variationIndex);
  assert.equal(candidates.length, 66);
  assert.ok(candidates.every(o => o.variationIndex === Number(o.auditLabel.slice(1)) - 1));
  for (const omitted of layout.omittedEdgeFragments) {
    assert.ok(!bodies.some(b => b.id === omitted.sourceId), `${omitted.auditLabel}: no fragment may remain in the GLB`);
    assert.ok(omitted.retainedFootprintAreaM2 < 40 && omitted.retainedFootprintFraction < .5);
  }
  for (const label of ['B001', 'B024', 'B038', 'B051', 'B054', 'B056', 'B058', 'B073', ...Object.keys(DOTONBORI_REFERENCE_HOSTS)]) {
    const selected = layout.objects.find((o: { auditLabel: string }) => o.auditLabel === label)!;
    assert.ok(selected, `${label}: preserve complete small buildings, substantial context and reference hosts`);
    assert.equal(bodies.find(b => b.id === selected.sourceId)!.variationIndex, selected.variationIndex);
  }
});

test('compact diagonal crop preserves source shapes, recorded landmark translation, bridge registration and mapped water', () => {
  const [east, north] = layout.centerEastNorthM, size = layout.tileSizeM;
  // Every interior vertex from the metric master survives the focused export.
  let verified = 0;
  for (const template of library.templates.filter(template => template.kind === 'building')) {
    const record = source.objects.find((record: { id: string }) => record.id === template.id);
    const p = template.geometry.getAttribute('position');
    for (const [e, n, h] of record.vertices) {
      const [de, dn] = layout.landmarkOffsetsEastNorthM[template.id] ?? [0, 0];
      const point = new Vector3(e + de - east, h, -n - dn + north).applyAxisAngle(new Vector3(0, 1, 0), layout.rotationYRadians).divideScalar(size);
      if (Math.abs(point.x) >= .49999 || Math.abs(point.z) >= .49999) continue;
      let error = Infinity;
      for (let i = 0; i < p.count; i++) error = Math.min(error, point.distanceTo(new Vector3().fromBufferAttribute(p, i)) * size);
      assert.ok(error < .00005, `${template.id}: source vertex moved ${error} m`); verified++;
    }
  }
  assert.ok(verified > 300);
  const bridge = library.templates.find(template => template.kind === 'bridge')!;
  const p = bridge.geometry.getAttribute('position'), along = bridgeStudy.registration.alongNorthUnitVector;
  const spans: number[] = [], widths: number[] = [], heights: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const local = new Vector3().fromBufferAttribute(p, i).multiplyScalar(size).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
    local.x += east - bridgeStudy.registration.centerEastNorthM[0];
    local.z -= north - bridgeStudy.registration.centerEastNorthM[1];
    spans.push(local.x * along[0] - local.z * along[1]);
    widths.push(local.x * along[1] + local.z * along[0]); heights.push(local.y);
  }
  assert.ok(Math.abs(Math.max(...spans) - Math.min(...spans) - 26) < .00002);
  assert.ok(Math.abs(Math.max(...widths) - Math.min(...widths) - 18) < .00002);
  assert.ok(Math.abs(Math.min(...spans) - (bridgeStudy.dimensions.southChainageM - bridgeStudy.dimensions.centerChainageM)) < .00002);
  assert.ok(Math.abs(Math.max(...spans) - (bridgeStudy.dimensions.northChainageM - bridgeStudy.dimensions.centerChainageM)) < .00002);
  assert.ok(Math.abs(Math.max(...widths) + Math.min(...widths)) < .00002, 'Circular deck keeps its surveyed registration after recentering the tile.');
  assert.ok(Math.abs(Math.max(...heights) - Math.max(...bridgeStudy.vertices.map((v: number[]) => v[2]))) < .00002);
  const water = dotonboriPlanGeometry(library.plan.water, .0002, layout);
  water.computeBoundingBox();
  assert.ok(water.boundingBox!.max.x - water.boundingBox!.min.x > .90);
  assert.ok(water.boundingBox!.max.z - water.boundingBox!.min.z > .90);
  assert.ok(dotonboriContains(library.plan.water, 55.5, 2), 'The canal stays connected below the compact Donki frontage.');
  water.dispose();
});

test('compact landmark composition centers Ebisubashi and preserves a complete, clear Donki assembly', () => {
  const bridgeCenter = dotonboriBridgePoint(waterfront, library.layout, 0, 0);
  assert.ok(Math.abs(bridgeCenter.x) < 1e-12 && Math.abs(bridgeCenter.z) < 1e-12);
  assert.deepEqual(layout.centerEastNorthM, bridgeStudy.registration.centerEastNorthM);
  assert.equal(layout.tileSizeM, 144);
  const donkiId = DOTONBORI_REFERENCE_HOSTS.B092;
  assert.deepEqual(layout.landmarkOffsetsEastNorthM, { [donkiId]: [-80, 0] });
  for (const id of Object.values(DOTONBORI_REFERENCE_HOSTS)) {
    const item = focus.objects.find((o: { sourceId: string }) => o.sourceId === id);
    assert.ok(item); assert.equal(item.authoringCutFaces, 0, 'Every landmark must retain its complete source envelope.');
  }
  assert.deepEqual(layout.displacedContext.map((o: { auditLabel: string }) => o.auditLabel),
    ['B026', 'B027', 'B029', 'B030', 'B032', 'B033']);
  const donki = library.templates.find(t => t.id === donkiId)!, box = donki.geometry.boundingBox!;
  assert.ok(Math.abs(box.max.y * 144 - 44.57) < .005, 'Donki keeps its source roof height to the published centimetre.');
  const roofTriangles = (geometry: BufferGeometry) => {
    const p = geometry.getAttribute('position'), result: [number, number][][] = [];
    for (let i = 0; i < p.count; i += 3) {
      const triangle = [0, 1, 2].map(j => [p.getX(i + j), p.getZ(i + j)] as [number, number]);
      if (wallArea(triangle) > 1e-10) result.push(triangle);
    }
    return result;
  };
  const hostTriangles = roofTriangles(donki.geometry);
  for (const other of library.templates.filter(t => t.kind === 'building' && t.id !== donkiId)) {
    const b = other.geometry.boundingBox!;
    if (b.max.x <= box.min.x || b.min.x >= box.max.x || b.max.z <= box.min.z || b.min.z >= box.max.z) continue;
    for (const a of hostTriangles) for (const b of roofTriangles(other.geometry)) {
      assert.ok(triangleIntersectionArea(a, b) < 1e-10, `Donki overlaps ${other.id}`);
    }
  }
  const river = createDotonboriRiver(library);
  const reflected = river.fragments.filter(f => f.sourceBuilding === donkiId);
  assert.ok(reflected.length > 0, 'Relocated wheel lighting must move with its host.');
  for (const f of reflected) {
    const p = new Vector3(f.x, f.y, f.z).multiplyScalar(144).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
    assert.ok(Math.abs(p.x + layout.centerEastNorthM[0] - 55.5) < 20);
  }
  river.mesh.geometry.dispose(); river.material.dispose(); river.wake.mesh.geometry.dispose(); river.wake.material.dispose();
});

test('ground covers all four QR corners and authoring caps appear only on the outer square', () => {
  const datum = dotonboriPlanGeometry([{ type: 'Polygon', coordinates: [layout.outlineEastNorthM] }], 0, layout);
  const p = datum.getAttribute('position'), index = datum.getIndex()!;
  let area = 0;
  const corners = new Set<string>();
  for (let i = 0; i < p.count; i++) corners.add(`${p.getX(i).toFixed(6)},${p.getZ(i).toFixed(6)}`);
  assert.deepEqual(corners, new Set(['-0.500000,-0.500000', '-0.500000,0.500000', '0.500000,-0.500000', '0.500000,0.500000']));
  for (let i = 0; i < index.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, index.getX(i + j)));
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  assert.ok(Math.abs(area - 1) < 1e-6, 'The datum must fill the complete QR footprint.');
  datum.dispose();
  let cutTriangles = 0;
  scenes[0].traverse(object => {
    if (!(object instanceof Mesh) || !object.material.name.endsWith('authoring-cut')) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 3) {
      const points = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(position, i + j)
        .sub(new Vector3(layout.centerEastNorthM[0], 0, -layout.centerEastNorthM[1]))
        .applyAxisAngle(new Vector3(0, 1, 0), layout.rotationYRadians).divideScalar(layout.tileSizeM));
      assert.ok((['x', 'z'] as const).some(axis => [-.5, .5].some(edge => points.every(point => Math.abs(point[axis] - edge) < 1e-6))),
        'A building still has an interior corridor cut.');
      cutTriangles++;
    }
    geometry.dispose();
  });
  assert.ok(cutTriangles > 0);
});

test('QR edits vary context architecture while retaining footprints, landmarks, other players and reversible content', async () => {
  const a = new DotonboriScene(modules, theme, async () => library);
  const b = new DotonboriScene(modules, theme, async () => library);
  await Promise.resolve(); a.update(0, 0, false); b.update(0, 0, false);
  assert.equal(a.assetStatus, 'ready'); assert.equal(b.assetStatus, 'ready');
  const id = library.templates[0].id;
  const first = a.root.getObjectByName(id) as Mesh, second = b.root.getObjectByName(id) as Mesh;
  assert.notEqual(first.geometry, second.geometry); assert.notEqual(first.geometry, library.templates[0].geometry);
  const before = first.geometry.getAttribute('position').array.slice();
  const details = a.root.getObjectByName('dotonbori-qr-building-details') as Mesh;
  const originalDetails = details.geometry.getAttribute('position').array.slice();
  const originalColors = details.geometry.getAttribute('color').array.slice();
  const signs = a.root.getObjectByName('dotonbori-qr-generated-signs') as Mesh;
  const signMaterial = signs.material;
  const landmark = a.root.getObjectByName(DOTONBORI_REFERENCE_HOSTS.B034) as Mesh;
  const landmarkGeometry = landmark.geometry;
  let replaced = 0; first.geometry.addEventListener('dispose', () => replaced++);
  const bodyGeometry = first.geometry, detailGeometry = details.geometry;
  a.updateContent(modules.map(row => [...row]), { ...theme, groundColor: theme.skyTop });
  assert.equal(first.geometry, bodyGeometry, 'Presentation updates with unchanged QR data must reuse the source bodies.');
  assert.equal(details.geometry, detailGeometry, 'A view or theme update must not rebuild the detailed city.');
  assert.equal(replaced, 0);
  a.updateContent(generateQRMatrix('osaka/'.repeat(65)).modules, theme);
  a.update(.65, 0, false); a.update(1, 0, false); a.update(.5, 0, false); a.update(0, 0, false);
  assert.equal(a.root.getObjectByName(id), first); assert.equal(replaced, 1);
  assert.notDeepEqual(first.geometry.getAttribute('position').array, before);
  const edited = first.geometry.getAttribute('position').array;
  for (let i = 0; i < before.length; i++) if (i % 3 !== 1) assert.equal(edited[i], before[i], 'A source footprint moved.');
  assert.notDeepEqual(details.geometry.getAttribute('position').array, originalDetails);
  assert.equal(landmark.geometry, landmarkGeometry); assert.equal(signs.material, signMaterial);
  a.updateContent(modules, theme);
  assert.deepEqual(first.geometry.getAttribute('position').array, before);
  assert.deepEqual(details.geometry.getAttribute('position').array, originalDetails);
  assert.deepEqual(details.geometry.getAttribute('color').array, originalColors);
  assert.deepEqual(first.scale, new Vector3(1, 1, 1));
  let disposed = 0; second.geometry.addEventListener('dispose', () => disposed++);
  a.dispose(); assert.equal(disposed, 0);
  assert.deepEqual(second.geometry.getAttribute('position').array, before);
  b.dispose(); assert.equal(disposed, 1);
});

function assertCompleteCity(scene: DotonboriScene) {
  const bodies = library.templates.filter(template => template.kind === 'building');
  assert.equal(bodies.length, 58);
  const omitted = new Set<string>([...layout.omittedEdgeFragments, ...layout.displacedContext].map((o: { sourceId: string }) => o.sourceId));
  for (const id of omitted) assert.equal(scene.root.getObjectByName(id), undefined);
  for (const body of bodies) assert.equal(scene.root.getObjectByName(body.id)?.visible, true, body.id);
  scene.root.getObjectByName('dotonbori-source-study')!.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry, ranges = dotonboriBuildingRanges(geometry);
    assert.ok(!omitted.has(object.userData.sourceBuilding), `${object.name}: omitted hosts must leave no attached detail`);
    assert.ok(ranges.every(range => !range.building || !omitted.has(range.building)));
    if (!object.userData.sourceBuilding && !ranges.some(range => range.building)) return;
    assert.equal(object.visible, true, `${object.name}: source-owned detail must remain present`);
    assert.equal(geometry.drawRange.start, 0);
    const count = geometry.index?.count ?? geometry.getAttribute('position').count;
    assert.ok(geometry.drawRange.count >= count, `${object.name}: source geometry must draw completely`);
  });
}

function surfaceInventory(scene: DotonboriScene) {
  return scene.root.getObjectByName('dotonbori-complete-surfaces')!.userData.inventory as DotonboriSurfaceMorph['inventory'];
}
function assertSurfaceCoverage(scene: DotonboriScene, grid?: number) {
  const inventory = surfaceInventory(scene), source = scene.root.getObjectByName('dotonbori-source-study')!;
  let triangles = 0;
  source.traverse(object => {
    if (!(object instanceof Mesh) || !object.visible) return;
    triangles += Math.min(object.geometry.drawRange.count, (object.geometry.index?.count ?? object.geometry.getAttribute('position').count)
      - object.geometry.drawRange.start) / 3 * (object instanceof InstancedMesh ? object.count : 1);
  });
  assert.equal(inventory.sourceTriangles + inventory.degenerateTriangles, triangles, 'Every rendered source triangle is inventoried, including concealed faces.');
  assert.equal(inventory.buildings.filter(id => id.startsWith('bldg_')).length, 58);
  if (grid) assert.equal(inventory.cells.length, grid ** 2);
  assert.ok(inventory.cells.every(area => Math.abs(area - 1) < 1e-10), 'Every paper/ink cell is covered exactly once.');
  assert.equal(inventory.wheelCells.length, 33);
  assert.ok(inventory.wheelCells.every(cell => dotonboriFinderCell(cell, Math.sqrt(inventory.cells.length))));
  const buffers = new Set<ArrayBufferLike>();
  let patches = 0;
  for (const object of scene.root.getObjectByName('dotonbori-complete-surfaces')!.children) {
    const geometry = (object as Mesh<DotonboriSurfaceGeometry>).geometry;
    patches += geometry.patchCount;
    for (const attribute of Object.values(geometry.attributes)) buffers.add(attribute.array.buffer);
    if (geometry.index) buffers.add(geometry.index.array.buffer);
    buffers.add(geometry.data.array.buffer);
  }
  assert.equal(patches, inventory.patches, 'Each complete patch retains both triangles.');
  assert.equal(inventory.bytes, [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0), 'Count source vertices, indices and shared motion data, including texture padding.');
  assert.ok(inventory.bytes < 56 * 1024 ** 2, `Bound complete-surface storage, including dense content: ${inventory.bytes} bytes.`);
  return inventory;
}
function assertCapturedSurface(scene: DotonboriScene, name: string) {
  const inventory = assertSurfaceCoverage(scene);
  const source = scene.root.getObjectByName(name) as Mesh;
  assert.ok(inventory.meshes[name] > 0, name + ': complete source surface must contribute');
  const morph = (scene as unknown as { surfaceMorph: DotonboriSurfaceMorph }).surfaceMorph;
  const batches = (morph as unknown as { batches: Map<unknown, { geometry: DotonboriSurfaceGeometry;
    dynamic: { source: { mesh: Mesh; instance: number }; offset: number }[] }> }).batches;
  const expected = new Box3(), actual = new Box3(), point = new Vector3(), matrix = new Matrix4();
  const sourceRoot = scene.root.getObjectByName('dotonbori-source-study')!;
  sourceRoot.updateWorldMatrix(true, true);
  const transform = sourceRoot.matrixWorld.clone().invert().multiply(source.matrixWorld), position = source.geometry.getAttribute('position');
  for (let instance = 0; instance < (source instanceof InstancedMesh ? source.count : 1); instance++) {
    if (source instanceof InstancedMesh) source.getMatrixAt(instance, matrix); else matrix.identity();
    for (let i = 0; i < position.count; i++) expected.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(matrix).applyMatrix4(transform));
  }
  let patches = 0;
  for (const batch of batches.values()) for (const patch of batch.dynamic) if (patch.source.mesh === source) {
    patches++;
    for (const position of batch.geometry.source.position) actual.expandByPoint(point.fromBufferAttribute(position, patch.offset));
  }
  assert.ok(patches > 0, name + ': must copy live vertices rather than sample boxes');
  assert.ok(actual.min.distanceTo(expected.min) < 2e-7 && actual.max.distanceTo(expected.max) < 2e-7, name + ': frozen surface bounds must match the actual pose');
}

test('all buildings and complete surfaces remain present through QR turns, reversals and content edits', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library); await Promise.resolve(); scene.update(0, 0, true);
  const original = new Map<Mesh, BufferGeometry>();
  scene.root.getObjectByName('dotonbori-source-study')!.traverse(o => { if (o instanceof Mesh) original.set(o, o.geometry); });
  const initial = scene.root.getObjectByName('dotonbori-complete-surfaces');
  const geometryIds = initial!.children.map(o => (o as Mesh).geometry.uuid);
  const initialMotion = initial!.children.map(o => (o as Mesh<DotonboriSurfaceGeometry>).geometry.motionTexture);
  let retiredMotionTextures = 0;
  initialMotion.forEach(texture => texture.addEventListener('dispose', () => { retiredMotionTextures++; }));
  for (const object of initial!.children) {
    const geometry = (object as Mesh<DotonboriSurfaceGeometry>).geometry, bounds = new Box3(), point = new Vector3();
    for (const corner of geometry.source.position) for (let i = 0; i < geometry.patchCount; i++) bounds.expandByPoint(point.fromBufferAttribute(corner, i));
    assert.ok(geometry.boundingSphere!.center.distanceTo(bounds.getCenter(point)) < 1e-12, 'Transparent sorting must retain the full source bounds.');
  }
  scene.updateContent(modules, { ...theme, groundColor: theme.qrFinderEyeColor, qrFinderEyeColor: theme.groundColor });
  scene.setLogoPresent(true); scene.update(.1, 0, true); scene.setLogoPresent(false); scene.update(0, 0, true);
  scene.updateContent(modules, theme);
  assert.equal(scene.root.getObjectByName('dotonbori-complete-surfaces'), initial);
  assert.deepEqual(initial!.children.map(o => (o as Mesh).geometry.uuid), geometryIds);
  assert.equal(retiredMotionTextures, 0, 'Presentation-only edits must reuse the motion storage.');
  for (const p of [.001, .08, .42, .2, .8, 1, .8, .42, .08, 0]) {
    scene.update(p, 0, false); assertCompleteCity(scene); assertSurfaceCoverage(scene, modules.length);
    assert.equal(scene.root.getObjectByName('dotonbori-complete-surfaces'), initial);
    for (const [mesh, geometry] of original) assert.equal(mesh.geometry, geometry);
  }
  for (const value of ['https://example.com/dotonbori', 'https://example.com/dotonbora', '夜の道頓堀'.repeat(30)]) {
    const matrix = generateQRMatrix(value).modules; scene.updateContent(matrix, theme);
    for (const p of [.55, 1, .3, 0]) { scene.update(p, 0, true); assertCompleteCity(scene); assertSurfaceCoverage(scene, matrix.length); }
  }
  const omitted = new Set([...layout.omittedEdgeFragments, ...layout.displacedContext].map((o: { sourceId: string }) => o.sourceId));
  assert.ok(surfaceInventory(scene).buildings.every(id => !omitted.has(id)));
  assert.equal(retiredMotionTextures, initialMotion.length, 'Content rebuilds must release every retired motion texture exactly once.');
  const remaining = scene.root.getObjectByName('dotonbori-complete-surfaces')!.children;
  let finalTextureDisposals = 0;
  remaining.forEach(o => (o as Mesh<DotonboriSurfaceGeometry>).geometry.motionTexture.addEventListener('dispose', () => { finalTextureDisposals++; }));
  const expectedDisposals = remaining.length;
  scene.dispose(); scene.dispose();
  assert.equal(finalTextureDisposals, expectedDisposals, 'Player disposal must release all current motion textures exactly once.');
});

test('assets first attached in QR retain every host through the return to settled 3D', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library);
  scene.update(1, 0, true);
  await Promise.resolve(); scene.update(1, 0, true);
  assert.equal(scene.assetStatus, 'ready');
  for (const p of [1, .9, .4, .001, 0]) {
    scene.update(p, 0, true); assertCompleteCity(scene); assert.ok(scene.getLogoAnchor().visible);
  }
  scene.dispose();
});

test('equal-size QR values change windows, roofs, signs and context height deterministically', () => {
  const site = library;
  const a = generateQRMatrix('https://example.com/dotonbori').modules, b = generateQRMatrix('https://example.com/dotonbora').modules;
  assert.equal(a.length, b.length);
  const first = createDotonboriBuildings(site, a), second = createDotonboriBuildings(site, b);
  assert.ok(first.some((f, i) => !f.fixed && f.geometry.boundingBox!.max.y !== second[i].geometry.boundingBox!.max.y));
  assert.ok(first.filter(f => f.fixed).every(f => f.geometry.boundingBox!.max.y === second.find(s => s.id === f.id)!.geometry.boundingBox!.max.y));
  assert.ok(first.some((f, i) => f.sign !== second[i].sign));
  const d1 = createDotonboriBuildingDetails(first, layout.tileSizeM), d2 = createDotonboriBuildingDetails(second, layout.tileSizeM);
  assert.notDeepEqual(d1.counts, d2.counts);
  assert.notDeepEqual(d1.geometry.getAttribute('color').array, d2.geometry.getAttribute('color').array);
  assert.notDeepEqual(d1.panels.map(p => p.design), d2.panels.map(p => p.design));
  for (const f of [...first, ...second]) f.geometry.dispose(); d1.geometry.dispose(); d2.geometry.dispose();
});

test('foreground and sign-side context stay low through QR edits while landmarks, footprints and full-size storefronts remain intact', () => {
  const nearLabels = ['B050', 'B047', 'B048', 'B077', 'B038'];
  const nearIds = nearLabels.map(label => layout.objects.find((o: { auditLabel: string }) => o.auditLabel === label).sourceId);
  const roofs = new Set<string>();
  for (const value of ['https://example.com/dotonbori', 'https://example.com/dotonbora', '夜の道頓堀'.repeat(30)]) {
    const buildings = createDotonboriBuildings(library, generateQRMatrix(value).modules);
    const fronts = resolveDotonboriFronts(buildings, library.layout);
    const ground = resolveDotonboriGroundFloors(buildings, library, fronts);
    for (const building of buildings) {
      const source = library.templates.find(t => t.id === building.id)!.geometry;
      const before = source.getAttribute('position'), after = building.geometry.getAttribute('position');
      assert.equal(after.count, before.count, 'Keep the complete closed source topology.');
      assert.equal(building.geometry.boundingBox!.min.y, source.boundingBox!.min.y, 'Keep the source ground datum.');
      for (let i = 0; i < after.count; i++) {
        assert.equal(after.getX(i), before.getX(i)); assert.equal(after.getZ(i), before.getZ(i));
        assert.ok(Number.isFinite(after.getY(i)));
        if (building.fixed) assert.equal(after.getY(i), before.getY(i), 'Preserve reference-host dimensions.');
      }
      if (nearIds.includes(building.id)) {
        const bounds = building.geometry.boundingBox!;
        assert.ok(bounds.max.y * layout.tileSizeM < 15, 'Near context must remain low-rise even with dense content.');
        if (building.index === 37) assert.ok(bounds.max.y * layout.tileSizeM < 12.001, 'B038 must stay below the Pip/FANCL sign stack.');
        assert.ok((bounds.max.y - bounds.min.y) * layout.tileSizeM >= 7.999);
        const shops = ground.fronts.filter(f => f.building === building.id);
        assert.ok(shops.length > 0 && shops.every(f => f.top - f.bottom >= 3.09), 'Regenerate normal-height 1F storefronts.');
      }
    }
    roofs.add(buildings.filter(b => nearIds.includes(b.id)).map(b => b.geometry.boundingBox!.max.y).join(','));
    buildings.forEach(b => b.geometry.dispose());
  }
  assert.ok(roofs.size > 1, 'Foreground architecture must retain QR height variation.');
  assert.equal(CITY_PRESETS.dotonbori.yaw, DOTONBORI_CAMERA_YAW_OFFSET);
  assert.ok(Math.abs(-.55 + CITY_PRESETS.dotonbori.pitchOffset + DOTONBORI_CAMERA_ELEVATION) < 1e-12);
  assert.equal(CITY_PRESETS.shibuya.pitchOffset, -.16); assert.equal(CITY_PRESETS['tokyo-tower'].pitchOffset, .16);
});

test('roof equipment requires complete flat support and cannot bridge a roof setback', () => {
  const geometry = new BufferGeometry(), positions: number[] = [];
  for (const [left, right, height] of [[0, 1, 1], [1, 2, 2]]) {
    positions.push(left, height, 0, right, height, 0, right, height, 1, left, height, 0, right, height, 1, left, height, 1);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  assert.equal(dotonboriRoofSupport(geometry, .5, .5, .4, .4), 1);
  assert.equal(dotonboriRoofSupport(geometry, 1.5, .5, .4, .4), 2);
  assert.equal(dotonboriRoofSupport(geometry, .95, .5, .4, .4), undefined);
  assert.equal(dotonboriRoofSupport(geometry, .05, .5, .4, .4), undefined);
  geometry.dispose();
});

test('slightly nonplanar source triangles share one facade rhythm without flattening a setback', () => {
  const g = new BufferGeometry();
  // One quad has a 1 mm discrepancy at its far vertex; the third triangle is
  // a separate, recessed wall and must keep its own plane.
  g.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, .1, 0, 0, .1, .2, .00001,
    0, 0, 0, .1, .2, .00001, 0, .2, 0,
    0, 0, -.02, .1, 0, -.02, .1, .2, -.02,
  ], 3));
  const walls = dotonboriBuildingWalls(g);
  assert.equal(walls.length, 2); assert.deepEqual(walls.map(w => w.triangles.length), [2, 1]);
  g.dispose();
});

test('long warped walls fit outside the source; nearby parallel setback faces stay separate', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, .3, 0, 0, .3, .2, .0007,
    0, 0, 0, .3, .2, .0007, 0, .2, 0,
    0, 0, .0008, .3, 0, .0008, .3, .2, .0008,
  ], 3));
  const walls = dotonboriBuildingWalls(geometry);
  assert.equal(walls.length, 2); assert.equal(walls[0].triangles.length, 2);
  const p = geometry.getAttribute('position'), wall = walls[0];
  for (let i = 0; i < 6; i++) {
    const distance = p.getX(i) * wall.nx + p.getZ(i) * wall.nz - wall.plane;
    assert.ok(distance <= 1e-9 && distance >= -.001, 'Fitted facade must clear the original source wall');
  }
  geometry.dispose();
});

test('all selected buildings have finite faces; QR architecture never overlaps a reserved reference front', () => {
  const buildings = createDotonboriBuildings(library, modules), size = layout.tileSizeM;
  const registered = resolveDotonboriFronts(buildings, layout);
  const fronts = [...registered, ...resolveDotonboriGroundFloors(buildings, library, registered).fronts];
  const details = createDotonboriBuildingDetails(buildings, size, fronts);
  assert.equal(registered.length, 15); assert.ok(fronts.length > 100);
  const p = details.geometry.getAttribute('position'), indices = vertexIndices(details.geometry);
  for (const range of dotonboriBuildingRanges(details.geometry)) {
    const reserved = fronts.filter(f => f.building === range.building);
    for (let i = range.start; i < range.start + range.count; i += 3) {
      const triangle = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, indices[i + j]));
      assert.ok(triangle.every(v => v.toArray().every(Number.isFinite)));
      assert.ok(triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).lengthSq() > 1e-24);
      for (const f of reserved) {
        const w = f.wall, distances = triangle.map(v => v.x * w.nx + v.z * w.nz - w.plane);
        if (Math.max(...distances) - Math.min(...distances) > 1e-7 || distances[0] < .06 / size || distances[0] > .29 / size) continue;
        const projected = triangle.map(v => [v.x * w.dx + v.z * w.dz, v.y] as [number, number]);
        // Allow 0.1 mm along shared edges for the Float32 GPU coordinate round trip.
        const inset = .0001 / size, region = f.groundFloorOnly ? f : w;
        const interior = { minU: region.minU + inset, maxU: region.maxU - inset, minY: region.minY + inset, maxY: region.maxY - inset };
        const clipped = clipWallPolygon(projected, interior);
        // A partial wall's bounding rectangle also includes missing surface.
        // Compare actual support triangles so the adjoining return is allowed.
        const overlap = f.context?.partial ? w.triangles.reduce((n, t) => n + triangleIntersectionArea(clipped, t), 0) : wallArea(clipped);
        assert.ok(overlap < 1e-11, `${f.id}: a QR skin/window covers the reference frontage: ${JSON.stringify({ overlapM2: overlap * size ** 2, distances: distances.map(d => d * size), triangle: projected, rect: interior, building: f.building })}`);
      }
    }
  }
  for (const building of buildings) {
    const vertices = building.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(vertices, i + j));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-24, `${building.id}: broken source triangle`);
    }
    building.geometry.dispose();
  }
  details.geometry.dispose();
});

test('remaining ground floors cover exposed walls, fit narrow alleys and retain source floor levels', () => {
  const buildings = createDotonboriBuildings(library, modules), registered = resolveDotonboriFronts(buildings, layout);
  const result = resolveDotonboriGroundFloors(buildings, library, registered), size = layout.tileSizeM;
  assert.equal(result.byBuilding.length, 58);
  assert.ok(result.byBuilding.reduce((n, b) => n + b.coveredMetres, 0) > 650);
  assert.ok(result.byBuilding.every(b => Math.abs(b.exposedMetres - b.coveredMetres) < 1e-6));
  const noFront = result.byBuilding.filter(b => !b.contextFronts && !b.registeredFronts);
  assert.deepEqual(noFront.map(b => b.building), ['bldg_2de00e94-da2b-43f6-851e-31ccd3170afa', 'bldg_740f4b5a-00b3-43d4-83d6-c45e82f2e494'], 'Only fully enclosed buildings may lack a public frontage');
  assert.ok(noFront.every(b => b.occludedMetres === b.excludedMetres));
  for (const front of result.fronts) {
    if (front.context!.partial) assert.ok(wallCoverage(front.wall, front) > 0);
    else assert.ok(wallCoverage(front.wall, front) >= front.width * 3.1 / size ** 2 * .999);
    assert.ok(front.bottom >= front.wall.minY * size);
    assert.ok(front.context!.projection <= .62 && front.context!.projection > 0);
    if (front.building === DOTONBORI_REFERENCE_HOSTS.B034) assert.ok(['retail', 'service'].includes(front.context!.kind), 'H&M context faces retain retail use');
    if (front.building === DOTONBORI_REFERENCE_HOSTS.B046) assert.ok(['restaurant', 'service'].includes(front.context!.kind), 'The restaurant must not become unrelated food shops around its other faces');
    for (const fraction of [-.49, 0, .49]) {
      const p = frontPoint(front, fraction * front.width, front.bottom + 1.2, front.context!.projection);
      assert.ok(Math.abs(p.x) < .5 && Math.abs(p.z) < .5, 'Shop fittings must stay inside the crop');
      for (const other of buildings) if (other.id !== front.building) {
        const roof = dotonboriRoofAt(other.geometry, p.x, p.z);
        assert.ok(!Number.isFinite(roof) || roof < p.y, 'Opposing ground-floor fittings must not enter another building');
      }
      if (front.context!.entrance) {
        const q = p.clone().multiplyScalar(size).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
        const e = q.x + layout.centerEastNorthM[0], n = -q.z + layout.centerEastNorthM[1];
        const upper = [...library.waterfront.upperWalk, ...DOTONBORI_STOREFRONT_ACCESS.map(a => a.polygon as unknown as DotonboriPolygon)];
        const floor = dotonboriContains(upper, e, n) ? 1.95 : dotonboriContains(library.waterfront.lowerWalk, e, n) ? 1.05 : 0;
        assert.ok(Math.abs(front.bottom - floor) < .16 && !dotonboriContains(library.plan.water, e, n), `${front.id}: an entrance needs a supported walking level (${front.bottom} vs ${floor} at ${e},${n})`);
      }
    }
  }
  const facades = createDotonboriFacades(library, modules, result.fronts);
  facades.root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute('position'); if (!p) return;
    const full = vertexIndices(o.geometry);
    for (const range of dotonboriBuildingRanges(o.geometry)) {
      const candidates = result.fronts.filter(f => f.building === range.building);
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const triangle = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, full[i + j]));
        assert.ok(triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).lengthSq() > 1e-24);
        assert.ok(candidates.some(f => triangle.every(v => {
          const u = v.x * f.wall.dx + v.z * f.wall.dz, depth = (v.x * f.wall.nx + v.z * f.wall.nz - f.wall.plane) * size;
          return u >= f.minU - 1e-7 && u <= f.maxU + 1e-7 && v.y >= f.minY - 1e-7 && v.y <= f.maxY + 1e-7
            && depth > 0 && depth <= f.context!.projection + .0001;
        })), 'Every context fitting triangle must stay inside its owned frontage and alley clearance');
      }
    }
    o.geometry.dispose();
  });
  facades.materials.forEach(m => m.dispose()); buildings.forEach(b => b.geometry.dispose());
});

test('finished perimeter sections retain the closed source contours and never become street walls', () => {
  const buildings = createDotonboriBuildings(library, modules); let changed = 0;
  for (const building of buildings) {
    const source = library.templates.find(t => t.id === building.id)!.geometry;
    const p = building.geometry.getAttribute('position'), original = source.getAttribute('position');
    const color = building.geometry.getAttribute('color'), originalColor = source.getAttribute('color');
    assert.equal(p.count, original.count);
    let capArea = 0;
    for (let i = 0; i < p.count; i += 3) {
      const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j)), cap = dotonboriSectionTriangle(vertices);
      if (cap) capArea += vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).length() / 2;
      for (let j = 0; j < 3; j++) {
        assert.equal(p.getX(i + j), original.getX(i + j)); assert.equal(p.getZ(i + j), original.getZ(i + j));
        const ink = [color.getX(i + j), color.getY(i + j), color.getZ(i + j)];
        const before = [originalColor.getX(i + j), originalColor.getY(i + j), originalColor.getZ(i + j)];
        if (cap) { assert.ok(ink.every(Number.isFinite)); if (ink.some((n, k) => n !== before[k])) changed++; }
        else assert.deepEqual(ink, before, 'Section finishing must not repaint an exterior wall or roof');
      }
    }
    const sectionArea = building.sections.reduce((n, w) => n + w.triangles.reduce((n, t) => n + wallArea(t), 0), 0);
    assert.ok(Math.abs(sectionArea - capArea) < 1e-8,
      `${building.id}: section extraction must retain the whole cap (${sectionArea} / ${capArea}), including disconnected contours`);
    assert.ok(building.sections.every(w => building.walls.every(exterior => exterior !== w)));
    building.geometry.dispose();
  }
  assert.ok(changed > 100);
});

test('reference surface ownership covers complete wall contours without doubling registered rectangles', () => {
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, layout), size = layout.tileSizeM;
  const result = createDotonboriFacades(library, modules, fronts), mesh = result.root.getObjectByName('dotonbori-photo-facade-details') as Mesh;
  const p = mesh.geometry.getAttribute('position'), index = vertexIndices(mesh.geometry), inspected = new Set();
  for (const f of fronts.filter(f => !f.groundFloorOnly)) {
    if (inspected.has(f.wall)) continue; inspected.add(f.wall);
    let covered = 0;
    for (const range of dotonboriBuildingRanges(mesh.geometry).filter(r => r.building === f.building)) {
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const tri = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, index[i + j]));
        if (tri.every(v => Math.abs(v.x * f.wall.nx + v.z * f.wall.nz - f.wall.plane - .055 / size) < 3e-8)) {
          covered += wallArea(tri.map(v => [v.x * f.wall.dx + v.z * f.wall.dz, v.y]));
        }
      }
    }
    const expected = f.wall.triangles.reduce((n, t) => n + wallArea(t), 0);
    assert.ok(Math.abs(covered - expected) * size ** 2 < .005, `${f.id}: incomplete or duplicated structural finish`);
  }
  assert.ok(mesh.userData.marginCoverage.some((r: { fronts: string[]; areaM2: number }) => r.fronts.includes('B031-west') && r.areaM2 > 0));
  const street = fronts.find(f => f.id === 'B046-south')!;
  const normal = new Vector3(street.wall.nx, 0, street.wall.nz).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
  assert.ok(Math.abs(normal.x + .19226348) < 1e-6 && Math.abs(normal.z - .98134334) < 1e-6);
  assert.ok(Math.abs(street.bottom - street.wall.minY * size) < 1e-5, 'Street details retain the source floor datum');
  const group = 'dotonbori-frontage-B046-south';
  assert.ok(result.fragments.filter(f => f.group === group).length > 5);
  assert.ok(result.fragments.filter(f => f.group === group).every(f => f.sourceBuilding === street.building));
  result.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); result.materials.forEach(m => m.dispose()); buildings.forEach(b => b.geometry.dispose());
});

test('bent facade ribs have front, rear, side and end surfaces with no open view through the relief', () => {
  const buildings = createDotonboriBuildings(library, modules), f = resolveDotonboriFronts(buildings, layout).find(f => f.id === 'B034-east-lower')!, size = layout.tileSizeM;
  for (const [bottom, top] of [[18, 26], [27, 30]]) {
    const rect = { minU: f.u - .21 / size, maxU: f.u + .21 / size, minY: bottom / size, maxY: top / size };
    const g = dotonboriFacadeRib(f.wall, rect, size)!, p = g.getAttribute('position'), y = (bottom + top) / 2;
    const bulge = .80 * Math.sin(Math.max(0, Math.min(1, (y - 27) / 15)) * Math.PI);
    const center = wallPoint(f.wall, f.u, y / size, (.24 + bulge) / size);
    for (const direction of [new Vector3(f.wall.nx, 0, f.wall.nz), new Vector3(f.wall.dx, 0, f.wall.dz), new Vector3(0, 1, 0)]) for (const sign of [-1, 1]) {
      const d = direction.clone().multiplyScalar(sign), ray = new Ray(center.clone().addScaledVector(d, -10 / size), d), hits: Vector3[] = [], visible: Vector3[] = [];
      for (let i = 0; i < p.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j));
        assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-24);
        const hit = ray.intersectTriangle(a, b, c, false, new Vector3());
        if (hit && hits.every(p => p.distanceToSquared(hit) > 1e-14)) hits.push(hit.clone());
        const facing = ray.intersectTriangle(a, b, c, true, new Vector3());
        if (facing && visible.every(p => p.distanceToSquared(facing) > 1e-14)) visible.push(facing.clone());
      }
      assert.equal(hits.length, 2, 'A ray must enter and exit the solid rib from every principal direction');
      assert.equal(visible.length, 1, 'Every outside view must hit one correctly oriented opaque surface');
    }
    g.dispose();
  }
  buildings.forEach(b => b.geometry.dispose());
});

test('the street canopy and corner fittings fit the source wall and clear neighbouring buildings', () => {
  const buildings = createDotonboriBuildings(library, modules), front = resolveDotonboriFronts(buildings, layout).find(f => f.id === 'B046-south')!;
  const batch = new DotonboriGeometry(layout.tileSizeM, 'street-clearance-test'); batch.buildingId = front.building;
  const artwork: import('three').PlaneGeometry[] = [], fragments: DotonboriFragment[] = [];
  createDotonboriKaniFacade(batch, front, artwork, fragments);
  const geometry = batch.finish(), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const v = new Vector3().fromBufferAttribute(p, i), u = v.x * front.wall.dx + v.z * front.wall.dz;
    const depth = (v.x * front.wall.nx + v.z * front.wall.nz - front.wall.plane) * layout.tileSizeM;
    assert.ok(u >= front.minU - 1e-7 && u <= front.maxU + 1e-7 && v.y >= front.minY - 1e-7 && v.y <= front.maxY + 1e-7);
    assert.ok(depth > 0 && depth <= .8101, `Street fitting depth ${depth} m at vertex ${i}`);
    for (const other of buildings) {
      if (other.id === front.building || !other.geometry.boundingBox!.containsPoint(v)) continue;
      const roof = dotonboriRoofAt(other.geometry, v.x, v.z);
      assert.ok(!Number.isFinite(roof) || roof < v.y, 'A source-fitted street detail enters its neighbour');
    }
  }
  geometry.dispose(); artwork.forEach(g => g.dispose()); buildings.forEach(b => b.geometry.dispose());
});

test('the new street facade remains in both QR transform directions and survives content edits', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library);
  await Promise.resolve(); scene.update(0, 0, true);
  for (const value of ['https://example.com/dotonbori', '道頓堀'.repeat(70)]) {
    const matrix = generateQRMatrix(value).modules; scene.updateContent(matrix, theme);
    for (const progress of [.1, .55, 1, .55, .1, 0]) {
      scene.update(progress, 0, true); assertCompleteCity(scene);
      if (progress === .1 || progress === .55) {
        const inventory = assertSurfaceCoverage(scene, matrix.length);
        assert.ok(inventory.meshes['dotonbori-photo-facade-details'] > 50000);
      }
    }
  }
  scene.dispose();
});

test('the exterior crab stays on the street wall with closed limbs, clearance and continuous motion', () => {
  const buildings = createDotonboriBuildings(library, modules), front = resolveDotonboriFronts(buildings, layout).find(f => f.id === 'B046-south')!;
  const crab = createDotonboriKaniSign(front), geometry = crab.mesh.geometry, position = geometry.getAttribute('position') as BufferAttribute;
  const original = Array.from(position.array), point = new Vector3();
  assert.equal(crab.parts.filter(p => p.id.endsWith('inner-leg')).length, 8);
  assert.equal(crab.parts.filter(p => p.id.endsWith('claw-palm')).length, 2);
  assert.ok(dotonboriBuildingRanges(geometry).every(r => r.building === front.building));
  for (const part of crab.parts) {
    const g = part.geometry!; if (!g) continue;
    const p = g.getAttribute('position'), ids = vertexIndices(g), edges = new Map<string, number>(); let volume = 0;
    for (let i = 0; i < ids.length; i += 3) {
      const v = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, ids[i + j]));
      volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
      const keys = v.map(v => v.toArray().map(n => Math.round(n * 1e6)).join(','));
      for (let j = 0; j < 3; j++) {
        const key = [keys[j], keys[(j + 1) % 3]].sort().join('|'); edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, `${part.id} must have outward-facing closed surfaces`);
    assert.ok([...edges.values()].every(count => count === 2), `${part.id} has an open or duplicate edge`);
  }
  const version = position.version; crab.update(0); assert.equal(position.version, version);
  for (let time = 0; time <= DOTONBORI_KANI_PERIOD; time += .25) {
    crab.update(time); assert.equal(geometry.getAttribute('position'), position);
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      const u = (point.x * front.wall.dx + point.z * front.wall.dz - front.u) * front.size;
      const y = point.y * front.size - front.bottom, depth = (point.x * front.wall.nx + point.z * front.wall.nz - front.wall.plane) * front.size;
      assert.ok(Math.abs(u) < 3.7 && y > 3.65 && y < 7.44 && depth > .49 && depth < 1.6, `Crab leaves its reserved street-wall clearance at ${time}: ${u}, ${y}, ${depth}`);
      for (const other of buildings) {
        if (other.id === front.building || !other.geometry.boundingBox!.containsPoint(point)) continue;
        const roof = dotonboriRoofAt(other.geometry, point.x, point.z);
        assert.ok(!Number.isFinite(roof) || roof < point.y, 'The crab intersects a neighbouring source building');
      }
    }
    if (time === 3) assert.notDeepEqual(Array.from(position.array), original);
  }
  assert.ok(Array.from(position.array).every((value, i) => Math.abs(value - original[i]) < 1e-8), 'The mechanism must loop without a pose jump');
  geometry.dispose(); crab.material.dispose(); buildings.forEach(b => b.geometry.dispose());
});

test('central 1F shops and reference signs are supported, unique and owned by their building', () => {
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, layout), size = layout.tileSizeM;
  const result = createDotonboriFacades(library, modules, fronts);
  const facade = result.root.getObjectByName('dotonbori-photo-facade-details') as Mesh;
  const shops = facade.userData.storefronts as { front: string; building: string; kind: string; bays: number; entrances: number; counters: number; bottom: number; top: number;
    menus: number; identity: string; finish: number; artVariant: number; bayRoles: string[]; bayWidthsM: number[] }[];
  assert.deepEqual(shops.map(s => s.front).sort(), ['B031-west', 'B034-east-lower', 'B034-south-lower', 'B037', 'B039', 'B040', 'B041', 'B046', 'B046-south', 'B046-west', 'B049-north']);
  assert.ok(shops.every(s => s.bays >= 2 && s.entrances === (s.kind === 'restaurant' ? 0 : 1)));
  assert.ok(shops.filter(s => s.front.startsWith('B034')).every(s => s.kind === 'retail' && s.counters === 0));
  assert.equal(shops.find(s => s.front === 'B040')!.kind, 'lobby');
  assert.equal(shops.find(s => s.front === 'B039')!.kind, 'commercial', 'Unverified sweets-shop assignment must not return below SAMTY');
  const cafe = shops.find(s => s.front === 'B049-north')!;
  assert.ok(cafe.counters < cafe.bays / 2 && cafe.menus === 1, 'One frontage must not repeat a complete service counter/menu at every window');
  assert.ok(['entry', 'seating', 'shelf', 'glazing'].every(role => cafe.bayRoles.includes(role)));
  assert.ok(new Set(cafe.bayWidthsM.map(w => w.toFixed(2))).size > 3, 'Wide frontage needs a deliberate, uneven bay rhythm');
  assert.deepEqual(shops.find(s => s.front === 'B046-west')!.bayRoles, ['tank', 'seating'], 'The known restaurant keeps dining beside its single tank vignette');
  for (const id of ['B034', 'B046']) {
    const group = shops.filter(s => s.front.startsWith(id));
    assert.equal(new Set(group.map(s => `${s.identity}:${s.finish}:${s.artVariant}`)).size, 1, 'Corner faces of the same known store keep a coherent identity');
  }
  for (const shop of shops.filter(s => s.counters > 0)) {
    const front = fronts.find(f => f.id === shop.front)!;
    assert.ok(Math.abs(shop.bottom - library.waterfront.levelsM.upperWalk) <= .05 + 1e-8, 'Food service must meet the modeled riverwalk floor');
    assert.ok(shop.top <= front.top && shop.top < 5.2, '1F detail must clear the main sign row');
    for (const x of [-.35, 0, .35]) {
      const p = frontPoint(front, x * front.width, shop.bottom, .55).multiplyScalar(size)
        .applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
      assert.ok(dotonboriContains([...library.waterfront.upperWalk, ...DOTONBORI_STOREFRONT_ACCESS.map(a => a.polygon as unknown as DotonboriPolygon)], p.x + layout.centerEastNorthM[0], -p.z + layout.centerEastNorthM[1]), 'Food counters require actual riverwalk support');
    }
  }
  assert.ok(result.fragments.every(f => f.sourceBuilding));
  const p = facade.geometry.getAttribute('position'), index = vertexIndices(facade.geometry), faces = new Set<string>();
  for (let i = 0; i < index.length; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, index[i + j]));
    const key = vertices.map(v => v.toArray().map(n => Math.round(n * 1e7)).join(',')).sort().join('|');
    assert.ok(!faces.has(key), 'Duplicate facade triangle would cause z-fighting'); faces.add(key);
    assert.ok(vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() > 1e-24,
      `Collapsed facade triangle ${i}: ${vertices.map(v => v.toArray().join(',')).join(' / ')}`);
  }
  const signs = result.root.getObjectByName('dotonbori-night-signs') as Mesh, pos = signs.geometry.getAttribute('position');
  for (const range of dotonboriBuildingRanges(signs.geometry)) {
    const full = vertexIndices(signs.geometry);
    for (let i = range.start; i < range.start + range.count; i += 6) {
      const vertices = full.slice(i, i + 6);
      const points = Array.from(vertices, v => new Vector3().fromBufferAttribute(pos, v));
      const front = fronts.find(f => f.building === range.building && points.every(v => Math.abs(v.x * f.wall.nx + v.z * f.wall.nz - f.wall.plane - (f.id === 'B046-south' ? .799 : .42) / size) < 1e-7));
      assert.ok(front, 'Sign must be parallel to and in front of its actual source wall');
      const us = points.map(v => v.x * front.wall.dx + v.z * front.wall.dz), ys = points.map(v => v.y);
      const rect = { minU: Math.min(...us), maxU: Math.max(...us), minY: Math.min(...ys), maxY: Math.max(...ys) };
      assert.ok(wallCoverage(front.wall, rect) >= (rect.maxU - rect.minU) * (rect.maxY - rect.minY) * .998, 'Sign must not span a missing building corner/setback');
    }
  }
  const storeArt = result.root.getObjectByName('dotonbori-storefront-artwork') as Mesh;
  const storePos = storeArt.geometry.getAttribute('position'), storeIndices = vertexIndices(storeArt.geometry);
  for (const range of dotonboriBuildingRanges(storeArt.geometry)) {
    assert.ok(range.building, 'Menus and shop lettering must retain their source host');
    for (let i = range.start; i < range.start + range.count; i += 6) {
      const points = Array.from(storeIndices.slice(i, i + 6), v => new Vector3().fromBufferAttribute(storePos, v));
      const front = fronts.find(f => f.building === range.building && points.every(p => {
        const depth = (p.x * f.wall.nx + p.z * f.wall.nz - f.wall.plane) * size;
        return depth >= .2399 && depth <= .5051 && p.y * size <= f.bottom + 3.1;
      }));
      assert.ok(front, 'Store art must remain within the shallow 1F frontage');
      const us = points.map(p => p.x * front.wall.dx + p.z * front.wall.dz), ys = points.map(p => p.y);
      const rect = { minU: Math.min(...us), maxU: Math.max(...us), minY: Math.min(...ys), maxY: Math.max(...ys) };
      assert.ok(wallCoverage(front.wall, rect) >= (rect.maxU - rect.minU) * (rect.maxY - rect.minY) * .998);
    }
  }
  for (const panel of dotonboriReferenceCampaigns(library, modules, fronts)) {
    const front = fronts.find(f => f.id === 'B031-west')!;
    assert.ok(Math.abs(panel.position.x * front.wall.nx + panel.position.z * front.wall.nz - front.wall.plane - .50 / size) < 1e-8);
    assert.equal(panel.width / panel.height, 2);
  }
  result.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); result.materials.forEach(m => m.dispose());
  buildings.forEach(b => b.geometry.dispose());
});

test('every riverbank sign is rendered, keeps separate cabinet space and preserves the bridge-side ground floor', () => {
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, layout), size = layout.tileSizeM;
  const result = createDotonboriFacades(library, modules, fronts), mesh = result.root.getObjectByName('dotonbori-night-signs') as Mesh;
  const panels = mesh.userData.panels as { front: string; building: string; art: number; y: number; width: number; height: number; vertex: number }[];
  assert.equal(panels.length, 21);
  for (const requested of DOTONBORI_SIGN_PANELS) {
    const panel = panels.find(p => p.front === requested.front && p.art === requested.art && (p.art !== 10 || Math.abs(p.y - requested.y) < .3));
    assert.ok(panel, `${requested.front}/${requested.art}: the photographed panel must not silently disappear`);
    const front = fronts.find(f => f.id === panel.front)!;
    const width = 'widthInset' in requested ? front.width - requested.widthInset : requested.width;
    assert.ok(panel.width >= width * .95 && panel.height >= requested.height * .95, 'Unexpected shrinking can leave a blank sign bay');
    const uv = mesh.geometry.getAttribute('uv'), indices = [0, 1, 2, 3].map(i => i + panel.vertex);
    const u = indices.reduce((n, i) => n + uv.getX(i), 0) / 4, v = indices.reduce((n, i) => n + uv.getY(i), 0) / 4;
    assert.equal(Math.floor(u * DOTONBORI_SIGN_ATLAS.columns), panel.art % DOTONBORI_SIGN_ATLAS.columns);
    assert.equal(DOTONBORI_SIGN_ATLAS.rows - 1 - Math.floor(v * DOTONBORI_SIGN_ATLAS.rows), Math.floor(panel.art / DOTONBORI_SIGN_ATLAS.columns));
    for (const other of panels.filter(p => p !== panel && p.front === panel.front)) {
      assert.ok(Math.abs(other.y - panel.y) >= (other.height + panel.height) / 2 + .24 - 1e-6,
        `${panel.front}/${panel.art}/${other.art}: sign cabinets may not overlap vertically`);
    }
    const facade = result.root.getObjectByName('dotonbori-photo-facade-details') as Mesh;
    const position = facade.geometry.getAttribute('position'), index = vertexIndices(facade.geometry);
    const ranges = dotonboriBuildingRanges(facade.geometry).filter(r => r.building === panel.building);
    const direction = new Vector3(-front.wall.nx, 0, -front.wall.nz), hit = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (const x of [-.35, 0, .35]) for (const y of [-.3, 0, .3]) {
      const ray = new Ray(frontPoint(front, x * panel.width, panel.y + y * panel.height, 2), direction);
      for (const range of ranges) for (let i = range.start; i < range.start + range.count; i += 3) {
        a.fromBufferAttribute(position, index[i]); b.fromBufferAttribute(position, index[i + 1]); c.fromBufferAttribute(position, index[i + 2]);
        if (ray.intersectTriangle(a, b, c, false, hit)) assert.ok(ray.origin.distanceTo(hit) * size >= 1.58 - 1e-4,
          `${panel.front}/${panel.art}: a window, rib or fitting obscures the sign artwork`);
      }
    }
  }
  const east = fronts.find(f => f.id === 'B037-east')!;
  const ground = resolveDotonboriGroundFloors(buildings, library, fronts).fronts.filter(f => f.building === east.building && f.wall === east.wall);
  assert.ok(ground.length > 0 && ground.reduce((n, f) => n + f.width, 0) > 8, 'An upper billboard reservation must not remove the existing 1F frontage');
  assert.ok(ground.every(f => f.top < east.bottom), 'Upper signs and the existing ground floor need separate ownership');
  result.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); result.materials.forEach(m => m.dispose());
  buildings.forEach(b => b.geometry.dispose());
});

test('every restored riverbank panel participates in both QR directions through content edits', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library);
  await Promise.resolve(); scene.update(0, 0, true);
  for (const value of ['https://example.com/道頓堀', `https://example.com/${'riverbank'.repeat(32)}`]) {
    const matrix = generateQRMatrix(value).modules; scene.updateContent(matrix, theme);
    for (const progress of [.42, 1, .58, 0]) {
      scene.update(progress, 0, true);
      if (progress > 0 && progress < 1) {
        const inventory = assertSurfaceCoverage(scene, matrix.length);
        assert.ok(inventory.meshes['dotonbori-night-signs'] >= 2 * DOTONBORI_SIGN_PANELS.length);
      }
      assertCompleteCity(scene);
    }
  }
  scene.dispose();
});

test('opening camera faces the Glico runner and the logo replaces only the north Asahi artwork reversibly', async () => {
  const a = new DotonboriScene(modules, theme, async () => library), b = new DotonboriScene(modules, theme, async () => library);
  a.setLogoPresent(true); // Logo can resolve before the city asset request.
  await Promise.resolve(); a.update(0, 0, true); b.update(0, 0, true);
  assertCompleteCity(a);
  const anchor = a.getLogoAnchor(); assert.ok(anchor.visible && anchor.width > 0 && anchor.height > anchor.width);
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, library.layout), front = fronts.find(f => f.id === 'B046')!;
  assert.ok(Math.abs(anchor.x * front.wall.nx + anchor.z * front.wall.nz - front.wall.plane - .60 / layout.tileSizeM) < 1e-7);
  const openingYaw = Math.PI / 4 + DOTONBORI_CAMERA_YAW_OFFSET;
  const glicoFront = fronts.find(f => f.id === 'B040')!;
  assert.ok(new Vector3(Math.sin(openingYaw), 0, Math.cos(openingYaw)).dot(new Vector3(glicoFront.wall.nx, 0, glicoFront.wall.nz)) > .8,
    'The opening view must show the face of the Glico running-man sign.');
  const uvs = (s: DotonboriScene) => Array.from((s.root.getObjectByName('dotonbori-night-signs') as Mesh).geometry.getAttribute('uv').array);
  const original = uvs(b), uploaded = uvs(a);
  assert.equal(original.filter((v, i) => v !== uploaded[i]).length, 8, 'Only one four-vertex panel changes; west Asahi stays original');
  a.updateContent(generateQRMatrix('different content').modules, theme); assert.deepEqual(uvs(a), uploaded); assert.deepEqual(uvs(b), original);
  a.update(.42, 0, true);
  assertSurfaceCoverage(a);
  const batch = (a.root.getObjectByName('dotonbori-complete-surfaces') as Group).children.find(o => o.userData.sourceMeshes.includes('dotonbori-night-signs')) as Mesh;
  const copiedUVs = (batch.geometry as DotonboriSurfaceGeometry).source.uv.flatMap(attribute =>
    Array.from({ length: attribute.count }, (_, i) => [attribute.getX(i), attribute.getY(i)]).flat());
  assert.ok(copiedUVs.every(Number.isFinite));
  assert.deepEqual(uvs(a), uploaded, 'Surface transport must read the personalized source atlas coordinates');
  a.update(0, 0, true); a.setLogoPresent(false); assert.deepEqual(uvs(a), original);
  for (const p of [.1, .5, 1, .5, 0]) {
    a.update(p, 0, true); assert.equal(a.getLogoAnchor().visible, true); assertCompleteCity(a);
  }
  a.dispose(); b.dispose(); buildings.forEach(b => b.geometry.dispose());
});

test('Japanese sign labels paint entirely from finite, bundled outlines without installed fonts', () => {
  for (const label of ['雪印メグミルク', '日商エステム', '改源', 'プロミス', '牧場の朝', 'えびす橋', 'グ', 'リ', 'コ', '明日を、元気に！', '大阪 花ラング', 'FANCL', 'ピップ', 'サロンパス', '12']) {
    const outline = DOTONBORI_LETTERING[label]; assert.ok(outline.width > 0 && outline.commands.length > 5);
    assert.ok(outline.commands.every(c => c.every(Number.isFinite)));
  }
  let paths = 0;
  const ctx = new Proxy({ canvas: { width: 2048, height: 1024 } }, {
    get(target, key) {
      if (key === 'canvas') return target.canvas;
      if (key === 'fillText' || key === 'measureText') return () => { throw new Error('Sign requires a host font'); };
      return () => { if (key === 'bezierCurveTo') paths++; };
    },
  }) as unknown as CanvasRenderingContext2D;
  paintDotonboriNightSigns(ctx); assert.ok(paths > 100);
});

test('boat stays in the mapped channel and pedestrians stay on their riverwalks through a complete loop', () => {
  let visibleSamples = 0;
  for (let time = 0; time <= 255; time += .5) {
    const boat = dotonboriBoatPose(waterfront, layout, time), angle = boat.angle - layout.rotationYRadians;
    for (const x of [-7.8, 0, 6.4, 8.2]) for (const z of [-1.8, 0, 1.8]) {
      if (x > 8 && z !== 0) continue;
      const e = boat.east + x * Math.cos(angle) + z * Math.sin(angle);
      const n = boat.north + x * Math.sin(angle) - z * Math.cos(angle);
      const point = new Vector3(x / layout.tileSizeM, 0, z / layout.tileSizeM)
        .applyAxisAngle(new Vector3(0, 1, 0), boat.angle).add(boat.position);
      if (Math.abs(point.x) < .499 && Math.abs(point.z) < .499) {
        assert.ok(dotonboriContains(layout.plan.water, e, n), `Boat leaves water at ${time}: ${e}, ${n}`); visibleSamples++;
      }
    }
    for (let i = 0; i < DOTONBORI_PEDESTRIAN_COUNT; i++) {
      const pose = dotonboriPedestrianPose(waterfront, layout, i, time);
      assert.ok(pose.visible, `Person ${i} leaves their promenade at ${time}`);
      assert.ok(Math.abs(pose.position.x) < .5 && Math.abs(pose.position.z) < .5);
      if (i >= 16 && i < 44) assert.ok(Math.abs(pose.position.y * layout.tileSizeM - 1.07) < 1e-8);
      const next = dotonboriPedestrianPose(waterfront, layout, i, time + .01);
      assert.ok(next.position.distanceTo(pose.position) * layout.tileSizeM < .016, 'Pedestrian visibly teleports at a loop boundary.');
      if (i < 16) for (let visitor = 44; visitor < 52; visitor++) {
        const standing = dotonboriPedestrianPose(waterfront, layout, visitor, time);
        assert.ok(pose.position.distanceTo(standing.position) * layout.tileSizeM > .8, 'A walker intersects a standing bridge visitor.');
      }
    }
  }
  assert.ok(visibleSamples > 2500);
  const lowBridge = Math.min(...waterfront.bridge.profile.map((p: number[]) => p[1])) - .48;
  assert.ok(lowBridge - (waterfront.levelsM.water + 2.45) > 1, 'Boat mast must clear the bridge fascia.');
});

test('activity freezes through QR reversals, paused edits and reduced motion, then resumes in 3D', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library);
  await Promise.resolve(); scene.update(0, 2, false);
  const people = scene.root.getObjectByName('dotonbori-pedestrians') as InstancedMesh;
  const boat = scene.root.getObjectByName('dotonbori-doton-tour-boat') as Mesh;
  const river = scene.root.getObjectByName('dotonbori-water-reflections') as Mesh;
  const pose = () => [Array.from(people.instanceMatrix.array), boat.matrix.elements.slice(),
    (river.material as { userData: Record<string, { value: number }> }).userData.dotonboriClock.value];
  const before = pose();
  for (const p of [.15, .6, 1, .8, .3, .7]) { scene.update(p, 10, false); assert.deepEqual(pose(), before); }
  scene.updateContent(generateQRMatrix('osaka/'.repeat(65)).modules, theme);
  scene.update(.55, 0, false, false); assert.deepEqual(pose(), before);
  scene.update(0, 7, true); assert.deepEqual(pose(), before);
  scene.update(0, 7, false, false); assert.deepEqual(pose(), before);
  scene.update(0, .5, false); assert.notDeepEqual(pose(), before);
  scene.dispose();
});

test('Glico artwork and reflections freeze together; every sign half and linked effect survives QR edits and reversals', async () => {
  const a = new DotonboriScene(modules, theme, async () => library), b = new DotonboriScene(modules, theme, async () => library);
  await Promise.resolve(); a.update(0, 5, false); b.update(0, 0, false);
  const sign = a.root.getObjectByName(DOTONBORI_GLICO_SIGN_ID) as Mesh;
  const river = a.root.getObjectByName('dotonbori-water-reflections') as Mesh;
  const uniform = (mesh: Mesh) => (mesh.material as { userData: Record<string, { value: number }> }).userData.dotonboriGlicoBlend;
  const signUniform = uniform(sign), reflectionUniform = uniform(river), phase = signUniform.value;
  assert.ok(phase > 0 && phase < 1, 'Test a partially blended live frame, not a static endpoint.');
  assert.equal(reflectionUniform.value, phase);
  const second = b.root.getObjectByName(DOTONBORI_GLICO_SIGN_ID) as Mesh;
  assert.notEqual(uniform(second), signUniform); assert.equal(uniform(second).value, 0);
  const geometry = sign.geometry, material = sign.material;
  const checkSources = () => {
    const inventory = assertSurfaceCoverage(a);
    assert.equal(inventory.meshes[DOTONBORI_GLICO_SIGN_ID], 2);
    const batch = (a.root.getObjectByName('dotonbori-complete-surfaces') as Group).children.find(o => o.userData.sourceMeshes.includes(DOTONBORI_GLICO_SIGN_ID)) as Mesh;
    const surface = batch.geometry as DotonboriSurfaceGeometry;
    const sourceBuildings = createDotonboriBuildings(library, modules);
    const front = resolveDotonboriFronts(sourceBuildings, layout).find(f => f.id === 'B040')!;
    sourceBuildings.forEach(building => building.geometry.dispose());
    const center = frontPoint(front, 0, 15.4, .44), axis = new Vector3(Math.cos(front.yaw), 0, -Math.sin(front.yaw));
    const printedNormal = new Vector3(Math.sin(front.yaw), 0, Math.cos(front.yaw)).applyAxisAngle(axis, DOTONBORI_GLICO_FOLD_RADIANS);
    assert.ok(printedNormal.y > .99999, 'The folding sign must present its printed front to the overhead camera, without mirrored lettering.');
    for (let corner = 0; corner < 4; corner++) for (let i = 0; i < surface.patchCount; i++) {
      const point = new Vector3().fromBufferAttribute(surface.source.position[corner], i).sub(center), uvs = surface.source.uv[corner];
      assert.ok(Math.abs(uvs.getX(i) - (point.dot(axis) * layout.tileSizeM / 10.38 + .5)) < 1e-6);
      assert.ok(Math.abs(uvs.getY(i) - (point.y * layout.tileSizeM / 20 + .5)) < 1e-6);
    }
    assert.ok(inventory.meshes['dotonbori-glico-frame'] > 0);
    assertCapturedSurface(a, 'dotonbori-water-reflections');
    assert.equal(signUniform.value, phase); assert.equal(reflectionUniform.value, phase);
    assertCompleteCity(a);
    assert.equal(sign.geometry, geometry); assert.equal(sign.material, material);
    return Array.from(river.geometry.getAttribute('glicoReflectedColor').array);
  };
  assert.equal(sign.visible, true);
  let colors: number[] | undefined;
  for (const p of [.02, .42, .7, .3, 1, .5]) {
    a.update(p, 100, false); const current = checkSources();
    if (colors) assert.deepEqual(current, colors); else colors = current;
    assert.equal(sign.visible, true);
  }
  for (const value of ['https://example.com/dotonbora', '夜の道頓堀'.repeat(30)]) {
    const grid = generateQRMatrix(value).modules; a.updateContent(grid, theme); checkSources();
    assertSurfaceCoverage(a, grid.length);
  }
  a.update(0, 100, true); assert.equal(signUniform.value, phase); assert.equal(sign.visible, true);
  a.update(0, 100, false, false); assert.equal(signUniform.value, phase);
  a.update(0, .5, false); assert.ok(signUniform.value > phase); assert.equal(signUniform.value, reflectionUniform.value);
  a.update(0, 10.5, false); assert.equal(signUniform.value, 0, 'The loop must return to its original artwork.');
  a.dispose(); assert.equal(uniform(second).value, 0); b.dispose();
});

test('secondary campaigns keep independent QR identities and freeze their exact blend through turns and edits', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library);
  await Promise.resolve(); scene.update(0, 9, false);
  const source = scene.root.getObjectByName('dotonbori-qr-generated-signs') as Mesh<BufferGeometry, MeshBasicMaterial>;
  const uniform = source.material.userData.dotonboriCampaignFrames as { value: Vector3[] };
  const state = () => uniform.value.map(frame => frame.toArray());
  const opening = state(), material = source.material, geometry = source.geometry;
  assert.equal(opening[0][2], .5); assert.equal(opening[1][2], 0, 'The screens must not change together.');
  for (const p of [.2, .65, 1, .65, .2, 0]) {
    scene.update(p, 100, false, false); assert.deepEqual(state(), opening);
  }
  scene.update(0, 100, true); assert.deepEqual(state(), opening);
  assert.equal(source.geometry, geometry); assert.equal(source.material, material);
  for (const value of ['https://example.com/new-campaign', '大阪'.repeat(50)]) {
    const matrix = generateQRMatrix(value).modules; scene.updateContent(matrix, theme);
    const panels = dotonboriReferenceCampaigns(library, matrix);
    assert.deepEqual(state(), panels.map((panel, screen) => [...dotonboriCampaignFrame(9, screen, panel.design)]));
    scene.update(.4, 100, false);
    const batch = scene.root.getObjectByName('dotonbori-complete-surfaces')!.children.find(o => o.userData.sourceMeshes.includes(source.name)) as Mesh<BufferGeometry, MeshBasicMaterial>;
    assert.equal(batch.material.userData.dotonboriCampaignFrames, uniform);
    const attributes = (batch.geometry as DotonboriSurfaceGeometry).source.dotonboriCampaign;
    assert.ok(attributes && [1, 2].every(screen => attributes.some(attribute =>
      Array.from({ length: attribute.count }, (_, i) => attribute.getX(i)).includes(screen))),
      'Both animated screens must carry their panel coordinates into the complete surface transport.');
    assertSurfaceCoverage(scene, matrix.length);
  }
  const frozen = state(); scene.update(0, .5, false); assert.notDeepEqual(state(), frozen);
  for (const screen of [0, 1]) {
    const duration = screen === 0 ? 30 : 39;
    assert.deepEqual(dotonboriCampaignFrame(0, screen, 7), dotonboriCampaignFrame(duration, screen, 7));
    const last = dotonboriCampaignFrame(duration - 1e-6, screen, 7);
    assert.equal(last[1], 7); assert.ok(last[2] > .9999, 'The last crossfade closes seamlessly onto the QR-selected campaign.');
  }
  scene.dispose();
});

test('surface interval transport conserves every source face and complete target cell', () => {
  for (const weights of [[1], [1, 1000000000, 2, 37], Array.from({ length: 3500 }, (_, i) => i % 31 + 1)]) {
    const sources = weights.map(() => 0), cells = Array.from({ length: 73 }, (_, i) => i), targets = cells.map(() => 0);
    mapDotonboriSurfaceIntervals(weights, cells, patch => {
      assert.ok(patch.sourceEnd > patch.sourceStart && patch.targetEnd > patch.targetStart);
      sources[patch.face] += patch.sourceEnd - patch.sourceStart; targets[patch.cell] += patch.targetEnd - patch.targetStart;
    });
    for (const area of [...sources, ...targets]) assert.ok(Math.abs(area - 1) < 1e-12);
  }
});

test('river surface motion reaches exact source and QR points and freezes buffers across reversals', async () => {
  // Large wall panels must be compact before flight; early expansion creates
  // long slivers across neighbouring buildings and the nearly assembled QR.
  const wall = [[-.25, .1, .2], [.25, .1, .2], [.25, .5, .2], [-.25, .5, .2]] as const;
  const center = [0, .3, .2] as const, destination = [.3, .001, -.3] as const;
  const flow = [.06, -.03, Math.hypot(.25, .2)] as const;
  const target = [.29, .001, -.31] as const;
  const airborne = wall.map(source => new Vector3(...dotonboriSurfacePoint(source, target, center, destination, flow, 29, .60)));
  for (const a of airborne) for (const b of airborne) assert.ok(a.distanceTo(b) <= 1 / 29 + 1e-8);
  for (const ground of [false, true]) for (const source of wall) {
    const settled = dotonboriSurfacePoint(source, target, center, destination, flow, 29, .90, ground);
    settled.forEach((value, axis) => assert.ok(Math.abs(value - target[axis]) < 1e-8, 'Architecture and ground finish at the shared settle.'));
    assert.notDeepEqual(dotonboriSurfacePoint(source, target, center, destination, flow, 29, .88, ground), settled,
      'Every group must still be assembling just before the shared finish.');
  }
  const scene = new DotonboriScene(modules, theme, async () => library); await Promise.resolve(); scene.update(0, 1.4, false); scene.update(.28, 0, false);
  const root = scene.root.getObjectByName('dotonbori-complete-surfaces')!;
  const versions = new Map<DotonboriSurfaceGeometry['data'], number>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const g = object.geometry as DotonboriSurfaceGeometry, centers = g.centers, ends = g.bounds, flows = g.flow;
    versions.set(g.data, g.data.version);
    versions.set(g.vertexData, g.vertexData.version);
    for (let corner = 0; corner < 4; corner++) for (let i = 0; i < g.patchCount; i += 137) {
      const positions = g.source.position[corner];
      const source = [positions.getX(i), positions.getY(i), positions.getZ(i)] as const;
      const cell = Math.floor(g.target.getX(i) / 8);
      const ground = g.target.getY(i) === 0;
      const target = [corner === 0 || corner === 3 ? ends.getX(i) : ends.getY(i), ground ? -.002 : .001,
        corner < 2 ? ends.getZ(i) : ends.getW(i)] as const;
      const center = [centers.getX(i), centers.getY(i), centers.getZ(i)] as const;
      const destination = [(cell % modules.length + .5) / modules.length - .5, target[1], (Math.floor(cell / modules.length) + .5) / modules.length - .5] as const;
      const flow = [flows.getX(i), flows.getY(i), flows.getZ(i)] as const;
      assert.ok(flow[2] >= 0 && Number.isFinite(flow[2]), 'Surface bounds cap intermediate pieces at one cell.');
      const first = dotonboriSurfacePoint(source, target, center, destination, flow, modules.length, 0, ground);
      const last = dotonboriSurfacePoint(source, target, center, destination, flow, modules.length, 1, ground);
      for (let axis = 0; axis < 3; axis++) { assert.ok(Math.abs(first[axis] - source[axis]) < 1e-8); assert.ok(Math.abs(last[axis] - target[axis]) < 1e-8); }
    }
  });
  for (const p of [.6, 1, .6, .28]) scene.update(p, 100, false);
  for (const [attribute, version] of versions) assert.equal(attribute.version, version, 'Only the progress uniform changes during a turn.');
  assertSurfaceCoverage(scene, modules.length); scene.dispose();
});

test('night City preserves Shibuya canonical QR inks, centers and paper', () => {
  for (const value of ['https://example.com/osaka', '夜の道頓堀'.repeat(50)]) {
    const matrix = generateQRMatrix(value).modules;
    const dotonbori = createCityQRTargets(matrix, theme), shibuya = createCityQRTargets(matrix, DESIGN_QR_THEME_PRESETS.shibuya);
    assert.deepEqual(dotonbori, shibuya);
    assert.equal(dotonbori.filter(t => !t.light).length, matrix.flat().filter(Boolean).length);
  }
});

test('visitors occupy varied bridge lanes and irregular gaps, with independent stops and viewing pairs', () => {
  const across = (p: Vector3) => p.clone().multiplyScalar(layout.tileSizeM).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians).x;
  const initial = Array.from({ length: 64 }, (_, i) => dotonboriPedestrianPose(waterfront, layout, i, 0));
  assert.ok(new Set(initial.slice(0, 16).map(p => Math.round(across(p.position) * 2))).size >= 7, 'Bridge walkers form a regimented line.');
  const bankEast = initial.slice(16, 30).map(p => p.east!).sort((a, b) => a - b);
  const gaps = bankEast.slice(1).map((e, i) => e - bankEast[i]);
  const mean = gaps.reduce((a, b) => a + b) / gaps.length;
  const variation = Math.sqrt(gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length) / mean;
  assert.ok(variation > .45, 'Bank visitors are evenly spaced.');
  for (const time of [0, 12, 35, 78]) {
    const poses = Array.from({ length: 44 }, (_, i) => dotonboriPedestrianPose(waterfront, layout, i, time));
    assert.ok(poses.some(p => p.walking) && poses.some(p => !p.walking), 'Everyone walks/stops in unison.');
    assert.ok(new Set(poses.filter(p => p.walking).map(p => Math.round(p.pace * 20))).size > 1);
  }
  assert.ok(initial[44].position.distanceTo(initial[45].position) * layout.tileSizeM < 1.1, 'Viewing companions should be grouped.');
});

test('bridge visitors cross between destinations, linger and turn in place instead of circling', () => {
  const up = new Vector3(0, 1, 0), [east, north] = waterfront.bridge.alongNorth;
  const local = (position: Vector3) => {
    const p = position.clone().multiplyScalar(layout.tileSizeM).applyAxisAngle(up, -layout.rotationYRadians);
    return { across: p.x * north + p.z * east, along: p.x * east - p.z * north };
  };
  const stats = Array.from({ length: 16 }, () => ({ minAcross: Infinity, maxAcross: -Infinity, minAlong: Infinity,
    maxAlong: -Infinity, stopped: 0, longestStop: 0, northbound: false, southbound: false, looking: false }));
  for (let tick = 0; tick <= 3000; tick++) for (let i = 0; i < 16; i++) {
    const time = tick / 5, pose = dotonboriPedestrianPose(waterfront, layout, i, time);
    const next = dotonboriPedestrianPose(waterfront, layout, i, time + .2), p = local(pose.position), q = local(next.position), stat = stats[i];
    stat.minAcross = Math.min(stat.minAcross, p.across); stat.maxAcross = Math.max(stat.maxAcross, p.across);
    stat.minAlong = Math.min(stat.minAlong, p.along); stat.maxAlong = Math.max(stat.maxAlong, p.along);
    const movement = next.position.clone().sub(pose.position), distance = movement.length() * layout.tileSizeM;
    stat.stopped = distance < .00001 ? stat.stopped + .2 : 0; stat.longestStop = Math.max(stat.longestStop, stat.stopped);
    stat.looking ||= stat.stopped > 2 && Math.abs(pose.headTurn) > .1;
    stat.northbound ||= q.along - p.along > .05; stat.southbound ||= p.along - q.along > .05;
    const turn = Math.abs(Math.atan2(Math.sin(next.heading - pose.heading), Math.cos(next.heading - pose.heading)));
    assert.ok(turn < .35, `Visitor ${i} snaps to a new heading at ${time}.`);
    if (pose.pace > .2 && next.pace > .2) {
      const alignment = (movement.x * Math.sin(pose.heading) + movement.z * Math.cos(pose.heading)) / Math.hypot(movement.x, movement.z);
      assert.ok(alignment > .99, `Visitor ${i} slides sideways or backwards at ${time}.`);
    }
  }
  for (const [i, stat] of stats.entries()) {
    assert.ok(stat.longestStop > (i < 8 ? 7 : 18), `Visitor ${i} never waits at a destination.`);
    assert.ok(stat.looking, `Visitor ${i} never looks around while waiting.`);
    if (i < 8) {
      assert.ok(stat.maxAlong - stat.minAlong > 22 && stat.northbound && stat.southbound, 'Through visitors must cross the full bridge in both directions.');
      assert.ok(stat.maxAcross - stat.minAcross < .3, 'Crossers must not return around a circular walking track.');
    } else assert.ok(Math.hypot(stat.maxAcross - stat.minAcross, stat.maxAlong - stat.minAlong) < 3.2, 'Local visitors should stay around their viewing or waiting destination.');
  }
});

test('night reflections stay inside the mapped water and retain per-player animation ownership', () => {
  const first = createDotonboriRiver(library), second = createDotonboriRiver(library);
  const positions = first.mesh.geometry.getAttribute('position');
  assert.ok(positions.count > 1500 && positions.count < 5000);
  for (let i = 0; i < positions.count; i++) {
    const p = new Vector3().fromBufferAttribute(positions, i).multiplyScalar(layout.tileSizeM)
      .applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
    assert.ok(dotonboriContains(layout.plan.water, p.x + layout.centerEastNorthM[0], -p.z + layout.centerEastNorthM[1]));
  }
  first.update(9); assert.equal(first.material.userData.dotonboriClock.value, 9);
  assert.equal(second.material.userData.dotonboriClock.value, 0);
  assert.ok(first.fragments.length > 12);
  for (const river of [first, second]) { river.mesh.geometry.dispose(); river.material.dispose(); river.wake.mesh.geometry.dispose(); river.wake.material.dispose(); }
});

test('walkers preserve physical separation, independent stops and continuous travel over an hour of circulation', () => {
  const size = layout.tileSizeM;
  for (let tick = 0; tick <= 18000; tick++) {
    const time = tick / 5, poses = dotonboriPedestrianPoses(waterfront, layout, time);
    for (let i = 0; i < 44; i++) {
      assert.ok(poses[i].visible, `Walker ${i} leaves supported pavement at ${time}.`);
      for (let j = i + 1; j < 64; j++) {
        if (Math.abs(poses[i].position.y - poses[j].position.y) * size > 1.65) continue;
        const separation = Math.hypot(poses[i].position.x - poses[j].position.x, poses[i].position.z - poses[j].position.z) * size;
        assert.ok(separation > .94, `People ${i}/${j} overlap at ${time}: ${separation} m.`);
      }
    }
    if (tick % 101 === 0) {
      const next = dotonboriPedestrianPoses(waterfront, layout, time + .01);
      for (let i = 0; i < 44; i++) {
        assert.ok(next[i].position.distanceTo(poses[i].position) * size < .016, 'Spacing correction must never teleport or push a pedestrian sideways.');
        assert.ok(next[i].distance >= poses[i].distance, 'A follower must slow down without sliding backward.');
      }
    }
  }
});

test('actual walking limbs do not intersect other people and stay over the promenade through turns and stops', () => {
  const activity = new DotonboriActivity(library), second = new DotonboriActivity(library), size = layout.tileSizeM;
  const deck = library.templates.find(t => t.kind === 'bridge')!.geometry;
  const unit = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)), matrix = new Matrix4(), up = new Vector3(0, 1, 0);
  const people = Array.from({ length: 64 }, () => ({ bounds: new Box3(), parts: Array.from({ length: 8 }, () => new OBB()), active: [] as OBB[] }));
  // Includes the old bank and bridge collisions at 23.4 s and 91.8 s, plus
  // repeated trips with every displayed arm, bag and swinging leg.
  const times = [23.4, 91.8, ...Array.from({ length: 1201 }, (_, i) => i / 2)];
  for (const time of times) {
    activity.update(time);
    for (let i = 0; i < 64; i++) {
      people[i].bounds.makeEmpty(); people[i].active.length = 0;
      for (let slot = 0; slot < 8; slot++) {
        activity.people.getMatrixAt(i * 8 + slot, matrix);
        if (matrix.determinant() === 0) continue;
        people[i].parts[slot].fromBox3(unit).applyMatrix4(matrix);
        people[i].active.push(people[i].parts[slot]);
        people[i].bounds.union(unit.clone().applyMatrix4(matrix));
        if (i >= 44 || ![3, 4].includes(slot)) continue;
        for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
          const v = new Vector3(x, y, z).applyMatrix4(matrix);
          if (i < 16) {
            assert.ok(Number.isFinite(dotonboriRoofAt(deck, v.x, v.z)), `Visitor ${i}'s stride leaves the source bridge at ${time}.`);
            continue;
          }
          v.multiplyScalar(size).applyAxisAngle(up, -layout.rotationYRadians);
          assert.ok(dotonboriContains(waterfront.lowerWalk, v.x + layout.centerEastNorthM[0], -v.z + layout.centerEastNorthM[1]),
            `Walker ${i}'s stride leaves the bank at ${time}.`);
        }
      }
    }
    for (let i = 0; i < 44; i++) for (let j = i + 1; j < 64; j++) {
      if (!people[i].bounds.intersectsBox(people[j].bounds)) continue;
      assert.ok(!people[i].active.some(a => people[j].active.some(b => a.intersectsOBB(b))), `Rendered body parts intersect: ${i}/${j} at ${time}.`);
    }
  }
  activity.update(91.8); second.update(91.8);
  assert.deepEqual(activity.people.instanceMatrix.array, second.people.instanceMatrix.array, 'Seeking or a different frame rate must produce the same spaced poses.');
  for (const item of [activity, second]) {
    item.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); item.material.dispose(); item.pennant.material.dispose(); item.people.dispose();
  }
});

test('drifting water and spreading wake remain on the mapped canal through emissions and the boat loop', () => {
  const river = createDotonboriRiver(library), second = createDotonboriWake(library), wake = river.wake;
  const position = river.mesh.geometry.getAttribute('position'), wakePosition = wake.mesh.geometry.getAttribute('position');
  const wakeColor = wake.mesh.geometry.getAttribute('color'), geometry = wake.mesh.geometry;
  const firstWater = Array.from(position.array), initialSecond = Array.from(second.mesh.geometry.getAttribute('position').array);
  const inside = (p: Vector3) => {
    assert.ok(Math.abs(p.x) < .5 && Math.abs(p.z) < .5, 'Water detail leaves the QR tile.');
    p.multiplyScalar(layout.tileSizeM).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
    assert.ok(dotonboriContains(layout.plan.water, p.x + layout.centerEastNorthM[0], -p.z + layout.centerEastNorthM[1]), 'Animated detail crosses a shoreline.');
  };
  let active = 0, smallest = Infinity, largest = 0;
  const times = [0, .719999, .72, .720001, ...Array.from({ length: 240 }, (_, i) => i * 1.03)];
  for (const time of times) {
    river.update(time);
    assert.equal(river.mesh.geometry.getAttribute('position'), position); assert.equal(wake.mesh.geometry, geometry);
    for (let i = 0; i < position.count; i++) inside(new Vector3().fromBufferAttribute(position, i));
    for (let i = 0; i < wakePosition.count; i++) if (wakeColor.getW(i) > 0) {
      inside(new Vector3().fromBufferAttribute(wakePosition, i)); active++;
    }
    const snapshot = wake.snapshot(); smallest = Math.min(smallest, snapshot.length); largest = Math.max(largest, snapshot.length);
    assert.ok(snapshot.length <= DOTONBORI_WAKE_RINGS * 6);
  }
  assert.ok(active > 10000 && largest > 48 && smallest === 0, 'The complete trip must include entering, visible and departed wake states.');
  assert.notDeepEqual(Array.from(position.array), firstWater);
  assert.deepEqual(Array.from(second.mesh.geometry.getAttribute('position').array), initialSecond, 'Each player owns its wave buffers.');
  wake.update(4.25); const before = wake.snapshot(); wake.update(4.5); const after = wake.snapshot();
  const common = before.find(a => after.some(b => a.id === b.id && b.width > a.width))!;
  assert.ok(common, 'A surviving crest should spread.');
  const moved = after.find(f => f.id === common.id)!;
  assert.ok(Math.hypot(moved.x - common.x, moved.z - common.z) * layout.tileSizeM < .25 * 1.35 * .8,
    'Existing waves must stay behind instead of following the boat rigidly.');
  second.update(.3); second.update(4.5);
  assert.deepEqual(Array.from(second.mesh.geometry.getAttribute('position').array), Array.from(wakePosition.array), 'Wave state cannot depend on frame rate.');
  const epsilon = .00001, seam = DOTONBORI_WAKE_INTERVAL * 8;
  wake.update(seam - epsilon); const left = wake.snapshot(); wake.update(seam + epsilon); const right = wake.snapshot();
  for (const a of left) {
    const b = right.find(b => b.id === a.id); if (!b) continue;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) * layout.tileSizeM < .001, 'A live crest jumps at a slot recycle.');
  }
  river.mesh.geometry.dispose(); river.material.dispose();
  for (const item of [wake, second]) { item.mesh.geometry.dispose(); item.material.dispose(); }
});

test('every live wake segment and water sample keeps its frozen pose through QR turns and dense content edits', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library), reference = createDotonboriRiver(library);
  await Promise.resolve(); scene.update(0, 4.25, false); reference.update(4.25);
  const river = scene.root.getObjectByName('dotonbori-water-reflections') as Mesh;
  const wake = scene.root.getObjectByName(DOTONBORI_WAKE_GROUP) as Mesh;
  const state = () => [Array.from(river.geometry.getAttribute('position').array), Array.from(wake.geometry.getAttribute('position').array),
    Array.from(wake.geometry.getAttribute('color').array)];
  const frozen = state(), expected = reference.snapshot();
  assert.ok(expected.filter(f => f.group === DOTONBORI_WAKE_GROUP).length > 48);
  assert.ok(expected.some(f => f.group === DOTONBORI_WATER_REFLECTIONS));
  const verify = () => {
    assert.deepEqual(state(), frozen);
    for (const name of ['dotonbori-water-reflections', DOTONBORI_WAKE_GROUP]) assertCapturedSurface(scene, name);

  };
  for (const p of [.05, .42, .7, .3, 1, .65, .2]) { scene.update(p, 10, false); verify(); }
  for (const value of ['https://example.com/dotonbora', '道頓堀の水面'.repeat(45)]) {
    const next = generateQRMatrix(value).modules; scene.updateContent(next, theme); verify();
    assertSurfaceCoverage(scene, next.length);
  }
  scene.update(0, 10, true); assert.deepEqual(state(), frozen);
  scene.update(0, 10, false, false); assert.deepEqual(state(), frozen);
  scene.update(0, .25, false); assert.notDeepEqual(state(), frozen);
  let disposed = false; wake.geometry.addEventListener('dispose', () => { disposed = true; });
  scene.dispose(); assert.ok(disposed);
  reference.mesh.geometry.dispose(); reference.material.dispose(); reference.wake.mesh.geometry.dispose(); reference.wake.material.dispose();
});

test('cloth seams stay pinned, split flaps stay separated and all fabric clears its source wall and mast', () => {
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, layout);
  const facades = createDotonboriFacades(library, modules, fronts), activity = new DotonboriActivity(library), size = layout.tileSizeM;
  assert.equal(facades.cloth.panels.length, 12, 'Only the three existing four-flap noren are animated.');
  const batches = [facades.cloth, activity.pennant];
  const originals = batches.map(batch => Array.from(batch.mesh.geometry.getAttribute('position').array));
  const attributes = batches.map(batch => batch.mesh.geometry.getAttribute('position') as BufferAttribute);
  const pinned = batches.map((batch, b) => batch.panels.flatMap((panel, p) => {
    const range = dotonboriBuildingRanges(batch.mesh.geometry)[p], vertices: number[] = [];
    for (let i = range.start; i < range.start + range.count; i++) {
      const point = new Vector3().fromArray(originals[b], i * 3).sub(panel.anchor).applyAxisAngle(new Vector3(0, 1, 0), -panel.yaw);
      if (Math.abs(panel.kind === 'noren' ? point.y : point.x) < 1e-8) vertices.push(i);
    }
    assert.ok(vertices.length > 4); return vertices;
  }));
  const local = new Vector3(), corners = [new Vector3(), new Vector3(), new Vector3()];
  for (const time of Array.from({ length: 73 }, (_, i) => i * .5)) {
    for (const [b, batch] of batches.entries()) {
      batch.update(time);
      assert.equal(batch.mesh.geometry.getAttribute('position'), attributes[b]);
      assert.equal(batch.material.side, DoubleSide); assert.ok(batch.material.depthTest && batch.material.forceSinglePass);
      for (const vertex of pinned[b]) for (let axis = 0; axis < 3; axis++) assert.equal(attributes[b].array[vertex * 3 + axis], originals[b][vertex * 3 + axis], 'An attached seam must never drift.');
      for (const [p, panel] of batch.panels.entries()) {
        const range = dotonboriBuildingRanges(batch.mesh.geometry)[p];
        for (let i = range.start; i < range.start + range.count; i++) {
          local.fromBufferAttribute(attributes[b], i).sub(panel.anchor).applyAxisAngle(new Vector3(0, 1, 0), -panel.yaw).multiplyScalar(size);
          if (panel.kind === 'noren') {
            assert.ok(Math.abs(local.x) <= panel.widthM / 2 + .0061, 'Neighboring flaps retain at least .022 m of their .035 m split.');
            assert.ok(local.z >= -.0041 && local.z < .0931, 'Fabric must stay in front of the doorway and inside the .79 m facade relief.');
            assert.ok(local.y >= -.5301 && local.y <= .0001);
            const front = fronts.find(front => panel.id.startsWith(`dotonbori-noren-${front.id}-`))!;
            const point = new Vector3().fromBufferAttribute(attributes[b], i);
            const u = point.x * front.wall.dx + point.z * front.wall.dz;
            assert.ok(u >= front.minU && u <= front.maxU && point.y >= front.minY && point.y <= front.maxY);
            assert.ok(Math.abs(point.x) < .5 && Math.abs(point.z) < .5);
          } else {
            assert.ok(local.x >= -.0001 && local.x <= .3801 && Math.abs(local.z) < .057);
            assert.ok(local.y >= -.261 && local.y <= .0001, 'Pennant stays below the mast tip and above the boat fittings.');
          }
        }
      }
      for (let i = 0; i < attributes[b].count; i += 3) {
        corners.forEach((v, j) => v.fromBufferAttribute(attributes[b], i + j));
        assert.ok(corners[1].sub(corners[0]).cross(corners[2].sub(corners[0])).lengthSq() > 1e-24, 'Animated cloth must not invert into a degenerate triangle.');
      }
    }
  }
  for (const batch of batches) {
    batch.update(0); const position = batch.mesh.geometry.getAttribute('position') as BufferAttribute, version = position.version;
    for (const time of [1, 2, 16, 17, 18, 19]) { assert.equal(dotonboriBreeze(time), 0); batch.update(time); assert.equal(position.version, version); }
    batch.update(6.25); const first = Array.from(position.array); batch.update(9); batch.update(6.25);
    assert.deepEqual(Array.from(position.array), first, 'Fabric evaluation must be independent of frame rate and previous samples.');
  }
  const tips = facades.cloth.snapshot().filter(f => f.id?.endsWith('-4'));
  assert.ok(new Set(tips.slice(0, 4).map(f => Math.round(f.depth * size * 1e5))).size > 2, 'Individual flaps must not move in lockstep.');
  facades.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); facades.materials.forEach(m => m.dispose());
  activity.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); activity.material.dispose(); activity.pennant.material.dispose(); activity.people.dispose();
  buildings.forEach(b => b.geometry.dispose());
});

test('every cloth strip joins the QR morph in its current pose, retaining phase through edits and reversals', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library), second = new DotonboriScene(modules, theme, async () => library);
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, layout);
  const reference = createDotonboriFacades(library, modules, fronts), actors = new DotonboriActivity(library);
  await Promise.resolve(); scene.update(0, 6.25, false); second.update(0, 0, false);
  reference.cloth.update(6.25); actors.update(6.25);
  const cloth = (s: DotonboriScene) => [DOTONBORI_NOREN, DOTONBORI_PENNANT].map(name => s.root.getObjectByName(name) as Mesh);
  const state = (s = scene) => cloth(s).map(mesh => Array.from(mesh.geometry.getAttribute('position').array));
  const frozen = state(), other = state(second), materials = cloth(scene).map(m => m.material);
  assert.notDeepEqual(frozen, other); assert.notEqual(materials[0], cloth(second)[0].material);
  const expected = [...reference.cloth.snapshot(), ...reference.fragments.filter(f => f.group === DOTONBORI_CLOTH_GROUP),
    ...actors.snapshot().filter(f => f.group === DOTONBORI_CLOTH_GROUP)];
  assert.equal(expected.length, 67, 'All sixty noren strips, three support rods and four pennant strips require reserved morph slots.');
  const verify = () => {
    assert.deepEqual(state(), frozen); assert.deepEqual(state(second), other);
    assert.deepEqual(cloth(scene).map(m => m.material), materials);
    for (const name of [DOTONBORI_NOREN, DOTONBORI_PENNANT]) assertCapturedSurface(scene, name);
    const noren = cloth(scene)[0];
    assert.ok(noren.visible && noren.geometry.drawRange.count >= (noren.geometry.index?.count ?? noren.geometry.getAttribute('position').count), 'All shop fabric must remain present.');
  };
  for (const p of [.08, .42, .7, 1, .7, .42, .08]) { scene.update(p, 20, false); verify(); }
  let replaced = false; cloth(scene)[0].geometry.addEventListener('dispose', () => { replaced = true; });
  for (const value of ['https://example.com/dotonbora', '道頓堀の暖簾'.repeat(45)]) {
    const next = generateQRMatrix(value).modules; scene.updateContent(next, theme); verify();
    assertSurfaceCoverage(scene, next.length);
  }
  assert.ok(replaced, 'Content regeneration releases the superseded cloth geometry.');
  scene.update(0, 20, true); assert.deepEqual(state(), frozen);
  scene.update(0, 20, false, false); assert.deepEqual(state(), frozen);
  assertCompleteCity(scene); scene.update(.42, 20, false); verify(); scene.update(0, 0, true);
  scene.update(0, .25, false); assert.notDeepEqual(state(), frozen); assert.deepEqual(state(second), other);
  let disposed = 0; cloth(scene).forEach(m => m.geometry.addEventListener('dispose', () => { disposed++; }));
  scene.dispose(); second.dispose(); assert.equal(disposed, 2);
  reference.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); reference.materials.forEach(m => m.dispose());
  actors.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); actors.material.dispose(); actors.pennant.material.dispose(); actors.people.dispose();
  buildings.forEach(b => b.geometry.dispose());
});

test('distinct shop actions fit the actual counter openings and tank, keep the tray supported and loop continuously', () => {
  const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, layout);
  const facades = createDotonboriFacades(library, modules, fronts), actions = facades.actions;
  assert.deepEqual(actions.anchors.map(a => [a.front.id, a.kind]).sort(), [['B037', 'service'], ['B041', 'prep'], ['B046-west', 'tank']]);
  const frames = actions.anchors.map(a => ({ ...a, inverse: new Matrix4().makeBasis(new Vector3(a.front.wall.dx, 0, a.front.wall.dz),
    new Vector3(0, 1, 0), new Vector3(a.front.wall.nx, 0, a.front.wall.nz))
    .scale(new Vector3(1, 1, 1).divideScalar(a.front.size)).setPosition(frontPoint(a.front, 0, a.front.bottom, 0)).invert() }));
  const geometry = actions.mesh.geometry, identity = geometry.uuid, full = vertexIndices(geometry);
  const service = frames.find(a => a.kind === 'service')!;
  const center = (f: DotonboriFragment) => new Vector3(f.x, f.y, f.z).applyMatrix4(service.inverse);
  for (let time = 0; time < 66; time += .25) {
    actions.update(time); assert.equal(geometry.uuid, identity);
    const position = geometry.getAttribute('position');
    for (const range of dotonboriBuildingRanges(geometry)) {
      const frame = frames.find(a => a.front.building === range.building)!, bounds = new Box3();
      for (let i = range.start; i < range.start + range.count; i++) bounds.expandByPoint(new Vector3().fromBufferAttribute(position, full[i]).applyMatrix4(frame.inverse));
      assert.ok(bounds.min.x > frame.x - frame.width / 2 && bounds.max.x < frame.x + frame.width / 2, 'Activity must stay inside its own bay, clear of the adjacent entrance.');
      assert.ok(bounds.min.z > .33 && bounds.max.z < 1.45, 'Actors must clear the solid source wall and stay within the tested promenade clearance.');
      if (frame.kind === 'tank') {
        assert.ok(bounds.min.y > .975 && bounds.max.y < 1.275, 'All legs/claws must clear the pedestal and upper tank frame.');
        assert.ok(bounds.min.z > .395 && bounds.max.z < .55, 'Crabs must remain between the tank back and front frame.');
      }
    }
    const fragments = actions.snapshot(), tray = fragments.find(f => f.id === 'dotonbori-B037-service-tray')!;
    const state = dotonboriServiceState(time), holder = state.carry > 0 ? 'customer' : 'worker';
    for (const side of [-1, 1]) {
      const hand = fragments.find(f => f.id === `dotonbori-B037-service-${holder}-${side}-hand`)!;
      const t = center(tray), h = center(hand);
      assert.ok(Math.abs(t.x - h.x) < .185 && Math.abs(t.z - h.z) < .035, 'A pair of hands must support the tray throughout the exchange.');
      assert.ok(Math.abs(t.y - h.y - .045) < 1e-9, 'The hands meet the tray underside without floating props.');
    }
  }
  actions.update(0); const start = actions.snapshot().filter(f => f.id?.includes('B037'));
  actions.update(40); assert.deepEqual(actions.snapshot().filter(f => f.id?.includes('B037')), start, 'The tray and customer must return continuously to the start pose.');
  actions.update(10); const resting = actions.snapshot().filter(f => f.id?.includes('B041'));
  actions.update(12); assert.deepEqual(actions.snapshot().filter(f => f.id?.includes('B041')), resting, 'Food preparation includes real still intervals.');
  actions.update(17); const tankRest = actions.snapshot().filter(f => f.id?.includes('B046-west'));
  actions.update(18); assert.deepEqual(actions.snapshot().filter(f => f.id?.includes('B046-west')), tankRest, 'Crabs rest between short, independent movements.');
  facades.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); facades.materials.forEach(m => m.dispose());
  buildings.forEach(b => b.geometry.dispose());
});

test('bridge phones stay in their hands and greetings respond to the nearby boat without adding duplicate people', () => {
  const activity = new DotonboriActivity(library), second = new DotonboriActivity(library);
  assert.equal(activity.people.count, 64 * 8);
  assert.equal(dotonboriVisitorReaction(50, 3, 40).wave, 0);
  assert.ok(dotonboriVisitorReaction(50, 3, 10).wave > .9);
  assert.notEqual(dotonboriVisitorReaction(45, 3, 10).photo, dotonboriVisitorReaction(48, 3, 10).photo);
  const matrix = new Matrix4();
  for (let time = 0; time < 40; time += .5) {
    activity.update(time);
    for (const index of DOTONBORI_REACTION_VISITORS) for (const slot of [5, 6]) {
      activity.people.getMatrixAt(index * 8 + slot, matrix);
      assert.equal(new Vector3().setFromMatrixScale(matrix).length(), 0, 'Original rigid arms are replaced, not superimposed.');
    }
    const fragments = activity.reactions.snapshot(activity.boat.matrix);
    for (const index of [45, 48]) {
      const phone = fragments.find(f => f.id === `dotonbori-person-${index}-phone`)!, hand = fragments.find(f => f.id === `dotonbori-person-${index}-gesture-1-hand`)!;
      assert.ok(Math.hypot(phone.x - hand.x, phone.y - hand.y, phone.z - hand.z) * layout.tileSizeM < .12, 'The phone must remain in the same hand throughout raising/lowering.');
    }
    const boat = activity.reactions.boatMesh.geometry.getAttribute('position');
    for (let i = 0; i < boat.count; i++) {
      assert.ok(Math.abs(boat.getZ(i) * layout.tileSizeM) < 1.72, 'The waving seated passenger stays inside the boat railing.');
      assert.ok(boat.getY(i) * layout.tileSizeM > .47, 'Passenger feet remain above the deck.');
    }
  }
  activity.update(11); second.update(11);
  for (const field of ['mesh', 'boatMesh'] as const) assert.deepEqual(activity.reactions[field].geometry.getAttribute('position').array,
    second.reactions[field].geometry.getAttribute('position').array, 'Gestures must not depend on frame rate or another player.');
  for (const item of [activity, second]) {
    item.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); item.material.dispose(); item.pennant.material.dispose(); item.people.dispose();
  }
});

test('every moving shop fitting, crab limb, phone and reacting visitor retains its exact pose in the complete QR surface morph', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library), second = new DotonboriScene(modules, theme, async () => library);
  const buildings = createDotonboriBuildings(library, modules), reference = createDotonboriFacades(library, modules, resolveDotonboriFronts(buildings, layout));
  const actors = new DotonboriActivity(library), groups = new Set([DOTONBORI_ACTION_GROUP, ...DOTONBORI_REACTION_VISITORS.map(i => `dotonbori-person-${i}`)]);
  await Promise.resolve(); scene.update(0, 11, false); second.update(0, 0, false); reference.actions.update(11); actors.update(11);
  const names = [DOTONBORI_SHOP_ACTIONS, DOTONBORI_VISITOR_REACTIONS, DOTONBORI_BOAT_REACTION, DOTONBORI_KANI_SIGN];
  const meshes = (s = scene) => names.map(name => s.root.getObjectByName(name) as Mesh);
  const state = (s = scene) => meshes(s).map(m => Array.from(m.geometry.getAttribute('position').array));
  const expected = [...reference.actions.snapshot(), ...actors.snapshot().filter(f => groups.has(f.group!))];
  assert.equal(expected.length, 146); assert.equal(new Set(expected.map(f => f.id)).size, expected.length);
  const frozen = state(), other = state(second), materials = meshes().map(m => m.material);
  const verify = () => {
    assert.deepEqual(state(), frozen); assert.deepEqual(state(second), other); assert.deepEqual(meshes().map(m => m.material), materials);
    for (const name of names) assertCapturedSurface(scene, name);
    assert.ok(meshes()[0].visible && meshes()[0].geometry.drawRange.count >= (meshes()[0].geometry.index?.count ?? meshes()[0].geometry.getAttribute('position').count), 'All shop actors must remain present.');
  };
  for (const p of [.08, .42, .7, 1, .7, .42, .08]) { scene.update(p, 20, false); verify(); }
  let replaced = false; meshes()[0].geometry.addEventListener('dispose', () => { replaced = true; });
  for (const value of ['https://example.com/dotonbora', '道頓堀の店と観光客'.repeat(40)]) {
    const next = generateQRMatrix(value).modules; scene.updateContent(next, theme); verify();
    assertSurfaceCoverage(scene, next.length);
  }
  assert.ok(replaced); scene.update(0, 20, true); assert.deepEqual(state(), frozen);
  scene.update(0, 20, false, false); assert.deepEqual(state(), frozen);
  assertCompleteCity(scene); scene.update(.42, 20, false); verify(); scene.update(0, 0, true);
  scene.update(0, .25, false); assert.notDeepEqual(state(), frozen); assert.deepEqual(state(second), other);
  let disposed = 0; meshes().forEach(m => m.geometry.addEventListener('dispose', () => { disposed++; }));
  scene.dispose(); second.dispose(); assert.equal(disposed, names.length);
  reference.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); reference.materials.forEach(m => m.dispose());
  actors.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); actors.material.dispose(); actors.pennant.material.dispose(); actors.people.dispose();
  buildings.forEach(b => b.geometry.dispose());
});

test('Ebisu Tower follows the registered Donki facade and the operator height, cabin count and ride period', () => {
  const wheel = createDotonboriEbisuTower(library), size = library.layout.tileSizeM;
  assert.equal(wheel.front.building, 'bldg_62a12ed7-ad07-4a43-8a33-c8720026bbaa');
  assert.equal(wheel.cabins.count, 32); assert.equal(DOTONBORI_EBISU_PERIOD, 900);
  const center = frontPoint(wheel.front, 0, 0, 0).multiplyScalar(size)
    .applyAxisAngle(new Vector3(0, 1, 0), -library.layout.rotationYRadians);
  assert.ok(Math.abs(center.x + layout.centerEastNorthM[0] - 55.52) < .15);
  assert.ok(Math.abs(-center.z + layout.centerEastNorthM[1] - 15.91) < .03);
  const { radiusM: r, upperM: high, lowerM: low, cabinRadiusM: cabin, groundM: ground } = DOTONBORI_EBISU;
  assert.ok(Math.abs(high + r + cabin - ground - 77.4) < 1e-9);
  assert.ok(Math.abs(low - r - cabin - ground - 10.5) < 1e-9);
  const period = 2 * (high - low) + Math.PI * 2 * r;
  for (const fraction of [0, (high - low) / period, (high - low + Math.PI * r) / period, 1]) {
    const a = dotonboriEbisuPath(fraction - 1e-7), b = dotonboriEbisuPath(fraction + 1e-7);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .00004, 'The rail has no jumps at its arc/straight joins.');
  }
  const initial = wheel.snapshot(), matrix = new Matrix4();
  const right = new Vector3(Math.cos(wheel.front.yaw), 0, -Math.sin(wheel.front.yaw));
  const reliefX = (id: string) => {
    const f = initial.find(f => f.id === id)!;
    return new Vector3(f.x, f.y, f.z).dot(right);
  };
  assert.ok(reliefX('ebisu-relief-3') < reliefX('ebisu-relief-1'), 'The reference fish is to the river-facing viewer’s left of Ebisu.');
  assert.ok(reliefX('ebisu-relief-0') < reliefX('ebisu-relief-4'), 'Donpen is left of the bag in the manufacturer photograph.');
  for (let time = 0; time < 900; time += 7.3) {
    wheel.update(time);
    const centers: Vector3[] = [];
    for (let i = 0; i < DOTONBORI_EBISU_CABINS; i++) {
      wheel.cabins.getMatrixAt(i, matrix);
      assert.ok(Math.abs(matrix.elements[5] * size - 1) < 1e-6, 'Cabin floors remain horizontal through the rounded ends.');
      for (const element of [1, 4, 6, 9]) assert.equal(matrix.elements[element], 0);
      const p = new Vector3().setFromMatrixPosition(matrix); centers.push(p);
      assert.ok(Math.abs(p.x) < .5 && Math.abs(p.z) < .5);
      assert.ok(p.y * size >= ground + 10.5 + cabin - .00002 && p.y * size <= ground + 77.4 - cabin + .00002);
    }
    for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) {
      assert.ok(centers[i].distanceTo(centers[j]) * size > 4.8, 'Cabins must clear one another throughout the circuit.');
    }
  }
  wheel.update(900); assert.deepEqual(wheel.snapshot(), initial, 'The complete ride returns to the same pose without drift.');
  wheel.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); wheel.cabins.dispose(); wheel.material.dispose();
});

test('every Ebisu cabin and structural fragment retains its pose through QR turns, edits, pause and reduced motion', async () => {
  const scene = new DotonboriScene(modules, theme, async () => library), reference = createDotonboriEbisuTower(library);
  await Promise.resolve(); scene.update(0, 147, false); reference.update(147);
  const cabins = scene.root.getObjectByName('dotonbori-ebisu-cabins') as InstancedMesh;
  const structure = scene.root.getObjectByName('dotonbori-ebisu-structure') as Mesh;
  const geometry = structure.geometry, frozen = Array.from(cabins.instanceMatrix.array);
  const verify = () => {
    assert.deepEqual(Array.from(cabins.instanceMatrix.array), frozen); assert.equal(structure.geometry, geometry);
    for (const name of ['dotonbori-ebisu-cabins']) assertCapturedSurface(scene, name);

  };
  for (const p of [.04, .42, .9, 1, .9, .42]) { scene.update(p, 30, false); verify(); }
  for (const value of ['別の道頓堀', 'えびすタワーの観覧車'.repeat(40)]) {
    scene.updateContent(generateQRMatrix(value).modules, theme); verify();
  }
  scene.update(0, 30, true); assert.deepEqual(Array.from(cabins.instanceMatrix.array), frozen);
  scene.update(0, 30, false, false); assert.deepEqual(Array.from(cabins.instanceMatrix.array), frozen);
  scene.update(0, .5, false); assert.notDeepEqual(Array.from(cabins.instanceMatrix.array), frozen);
  let disposed = 0;
  for (const object of [cabins, structure]) object.geometry.addEventListener('dispose', () => { disposed++; });
  scene.dispose(); assert.equal(disposed, 2);
  reference.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); reference.cabins.dispose(); reference.material.dispose();
});

test('late assets wait for a running endpoint and never attach to a disposed scene', async () => {
  let finish!: (value: DotonboriLibrary) => void;
  const pending = new Promise<DotonboriLibrary>(resolve => { finish = resolve; });
  const scene = new DotonboriScene(modules, theme, () => pending);
  finish(library); await Promise.resolve(); assert.equal(scene.assetStatus, 'pending');
  scene.update(.5, 0, false); assert.equal(scene.assetStatus, 'pending');
  scene.update(1, 0, false, false); assert.equal(scene.assetStatus, 'pending');
  scene.update(1, 0, true); assert.equal(scene.assetStatus, 'ready');
  assert.equal(scene.root.getObjectByName('dotonbori-source-study')?.visible, false);
  scene.dispose();
  let late!: (value: DotonboriLibrary) => void;
  const abandoned = new DotonboriScene(modules, theme, () => new Promise(resolve => { late = resolve; }));
  abandoned.dispose(); late(library); await Promise.resolve(); abandoned.update(0, 0, false);
  assert.equal(abandoned.root.children.length, 0);
  const failed = new DotonboriScene(modules, theme, async () => { throw new Error('offline'); });
  await Promise.resolve(); await Promise.resolve(); assert.equal(failed.assetStatus, 'error');
  failed.update(1, 0, true); assert.equal(failed.root.getObjectByName('dotonbori-qr-modules')?.visible, true);
  failed.dispose();
});
