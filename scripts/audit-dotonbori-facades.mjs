/** Inspect the current crop and facade coverage without changing player assets.
 * node --experimental-strip-types scripts/audit-dotonbori-facades.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readDotonboriAssets } from './dotonbori-asset-plugin.mjs';
import { prepareDotonboriLibrary } from '../packages/designqr/src/designs/city/dotonbori-assets.ts';
import { createDotonboriBuildings, createDotonboriBuildingDetails } from '../packages/designqr/src/designs/city/dotonbori-buildings.ts';
import { frontPoint, resolveDotonboriFronts } from '../packages/designqr/src/designs/city/dotonbori-facade-layout.ts';
import { wallArea, wallPatch } from '../packages/designqr/src/designs/city/dotonbori-walls.ts';
import { generateQRMatrix } from '../packages/designqr/src/designs/tree/qr.ts';
import { createDotonboriFacades } from '../packages/designqr/src/designs/city/dotonbori-facades.ts';
import { Mesh } from 'three';
import { DOTONBORI_SIGN_ARTWORK, DOTONBORI_SIGN_ATLAS } from '../packages/designqr/src/designs/city/dotonbori-sign-layout.ts';

const root = new URL('../', import.meta.url), assets = new URL('assets/design-qr/dotonbori/', root);
const readJSON = async name => JSON.parse(await readFile(new URL(name, assets), 'utf8'));
const [data, source, focus, focusLayout] = await Promise.all([
  readDotonboriAssets(), readJSON('east-source-meshes.json'), readJSON('focus-manifest.json'), readJSON('focus-layout.json'),
]);
const groups = [];
for (const name of ['dotonbori-focus.glb', 'dotonbori-bridge-deck-study.glb']) {
  const bytes = await readFile(new URL(name, assets));
  if (name === 'dotonbori-focus.glb' && createHash('sha256').update(bytes).digest('hex') !== focus.glbSha256) {
    throw new Error('Focused GLB does not match its topology manifest.');
  }
  groups.push((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '')).scene);
}
const library = prepareDotonboriLibrary(groups[0], groups[1], data);
const value = 'https://example.com/dotonbori', modules = generateQRMatrix(value).modules;
const buildings = createDotonboriBuildings(library, modules), fronts = resolveDotonboriFronts(buildings, library.layout);
const details = createDotonboriBuildingDetails(buildings, library.layout.tileSizeM, fronts);
const facades = createDotonboriFacades(library, modules, fronts);
const finishedMargins = facades.root.getObjectByName('dotonbori-photo-facade-details').userData.marginCoverage;
const size = library.layout.tileSizeM, up = new Vector3(0, 1, 0), round = n => Math.round(n * 1000) / 1000;
const triangleArea = points => points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() / 2;
const geometryArea = geometry => {
  if (!geometry) return 0;
  const position = geometry.getAttribute('position'); let area = 0;
  for (let i = 0; i < position.count; i += 3) area += triangleArea([0, 1, 2].map(j => new Vector3().fromBufferAttribute(position, i + j)));
  return area * size ** 2;
};
const records = buildings.map(building => {
  const manifest = focus.objects.find(o => o.sourceId === building.id);
  const footprint = focusLayout.objects.find(o => o.sourceId === building.id);
  const original = source.objects.find(o => o.id === building.id);
  const position = building.geometry.getAttribute('position'), capAreas = {};
  for (let i = 0; i < position.count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(position, i + j));
    for (const axis of ['x', 'z']) for (const edge of [-.5, .5]) {
      if (vertices.every(v => Math.abs(v[axis] - edge) < 1e-6)) {
        const key = `${axis}=${edge * size}`;
        capAreas[key] = (capAreas[key] ?? 0) + triangleArea(vertices) * size ** 2;
      }
    }
  }
  const offset = library.layout.landmarkOffsetsEastNorthM[building.id] ?? [0, 0];
  const sourcePoints = original.vertices.map(([east, north]) => new Vector3(east + offset[0] - library.layout.centerEastNorthM[0], 0,
    library.layout.centerEastNorthM[1] - north - offset[1]).applyAxisAngle(up, library.layout.rotationYRadians));
  const sourceBounds = ['x', 'z'].map(axis => [Math.min(...sourcePoints.map(p => p[axis])), Math.max(...sourcePoints.map(p => p[axis]))]);
  const sourceWalls = building.walls.map((wall, wallIndex) => {
    const registered = fronts.filter(f => f.building === building.id && f.wall === wall && !f.groundFloorOnly);
    const remainder = registered.length ? wallPatch(wall, wall, 0, registered) : undefined;
    const unreservedArea = geometryArea(remainder); remainder?.dispose();
    const direction = new Vector3(wall.nx, 0, wall.nz).applyAxisAngle(up, -library.layout.rotationYRadians);
    return { wallIndex, outwardEastNorth: [round(direction.x), round(-direction.z)],
      areaM2: round(wall.triangles.reduce((n, t) => n + wallArea(t), 0) * size ** 2),
      referenceFronts: registered.map(f => f.id),
      outsideReferenceRectanglesM2: registered.length ? round(unreservedArea) : null,
      treatment: registered.length ? 'Single reference owner: source-clipped structural base and finished rectangle remainders, with source-linked facade relief.'
        : 'Source exterior with existing illustrative QR-driven architecture; no new photographic claim.',
      referenceMarginFinishM2: registered.length ? round(finishedMargins.find(r => r.building === building.id && r.fronts.some(id => registered.some(f => f.id === id)))?.areaM2 ?? 0) : null };
  });
  return { sourceId: building.id, label: manifest.auditLabel, lod: manifest.lod,
    presentationTranslationEastNorthM: offset,
    sourceTopM: round(library.templates.find(t => t.id === building.id).geometry.boundingBox.max.y * size),
    presentationTopM: round(building.geometry.boundingBox.max.y * size),
    heightRule: building.fixed ? 'Retained source dimensions.' : 'QR-generated height within a static foreground envelope; not a surveyed height.',
    retainedFootprintPercent: round(footprint.retainedFootprintFraction * 100),
    manifestCutFaces: manifest.authoringCutFaces, manifestNonManifoldEdges: manifest.nonManifoldEdges,
    boundaryAreaM2: round(Object.values(capAreas).reduce((n, area) => n + area, 0)),
    boundaryPlanesM2: Object.fromEntries(Object.entries(capAreas).map(([key, area]) => [key, round(area)])),
    boundaryTreatment: Object.keys(capAreas).length ? 'Existing closed cap recoloured with building/stone mineral finish and section edge shading; narrow contour-clipped edge strips; no doors, ads or window grid.' : null,
    completeSourceTileBoundsM: sourceBounds.map(pair => pair.map(round)),
    completeSourceOverflowM: round(Math.max(0, ...sourceBounds.flat().map(n => Math.abs(n) - size / 2))),
    roofFinish: { panels: details.counts[building.id].roofPanels, edges: details.counts[building.id].roofEdges,
      areaM2: round(details.counts[building.id].roofAreaM2),
      treatment: 'QR-derived panel joints and edge flashing follow existing flat/sloping source triangles; existing B034 east glazing retains exclusive ownership. Structural interpretation, not a surveyed roof specification.' },
    sourceWalls };
});
const inputs = ['assets/design-qr/dotonbori/east-source-meshes.json', 'assets/design-qr/dotonbori/focus-layout.json',
  'assets/design-qr/dotonbori/focus-manifest.json', 'assets/design-qr/dotonbori/dotonbori-focus.glb',
  'packages/designqr/src/designs/city/dotonbori-assets.ts', 'packages/designqr/src/designs/city/dotonbori-layout.ts',
  'packages/designqr/src/designs/city/dotonbori-buildings.ts', 'packages/designqr/src/designs/city/dotonbori-facade-layout.ts',
  'packages/designqr/src/designs/city/dotonbori-walls.ts', 'packages/designqr/src/designs/city/building-variation.ts',
  'packages/designqr/src/designs/city/dotonbori-surface-finishes.ts', 'packages/designqr/src/designs/city/dotonbori-kani-facade.ts',
  'packages/designqr/src/designs/city/dotonbori-kani-sign.ts', 'packages/designqr/src/designs/city/dotonbori-storefronts.ts',
  'packages/designqr/src/designs/city/dotonbori-roof-details.ts',
  'packages/designqr/src/designs/city/dotonbori-facade-ribs.ts', 'packages/designqr/src/designs/city/dotonbori-ebisubashi-facade.ts',
  'packages/designqr/src/designs/city/dotonbori-facades.ts',
  'packages/designqr/src/designs/city/dotonbori-sign-layout.ts', 'packages/designqr/src/designs/city/dotonbori-sign-artwork.ts',
  'packages/designqr/src/designs/content-variation.ts', 'scripts/audit-dotonbori-facades.mjs'];
const hashes = {};
for (const path of inputs) hashes[path] = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const result = { schema: 'designqr-dotonbori-facade-audit', version: 1,
  status: 'Implemented perimeter/reference-wall finishes, B046 street facade, B034 closed ribs/setback and riverbank sign completion; source/coverage audit, not a photographic survey.',
  content: { value, grid: modules.length },
  method: 'Use current runtime building geometry. Boundary triangles have all three vertices within 0.000001 tile of x/z = +/-0.5. Areas include QR-generated heights. Closed-topology counts are read from the focused asset manifest. Registered-wall residuals subtract the union of reference rectangles; they are inspection candidates, not proof of a hole. Complete-source bounds use the original ENU vertices and current tile rotation.',
  edgeSelection: { ...focusLayout.edgeSelection, omitted: focusLayout.omittedEdgeFragments, displacedContext: focusLayout.displacedContext },
  summary: { buildings: records.length, omittedEdgeFragments: focusLayout.omittedEdgeFragments.length,
    omittedFootprintAreaM2: round(focusLayout.omittedEdgeFragments.reduce((n, r) => n + r.retainedFootprintAreaM2, 0)),
    buildingsWithBoundaryCuts: records.filter(r => r.manifestCutFaces > 0).length,
    boundaryCutFaces: records.reduce((n, r) => n + r.manifestCutFaces, 0),
    closedBuildingsInManifest: records.filter(r => r.manifestNonManifoldEdges === 0).length,
    boundaryAreaM2: round(records.reduce((n, r) => n + r.boundaryAreaM2, 0)),
    retainedUnderTenPercent: records.filter(r => r.retainedFootprintPercent < 10).map(r => r.label),
    registeredFullHeightFronts: fronts.filter(f => !f.groundFloorOnly).length,
    registeredBuildings: new Set(fronts.filter(f => !f.groundFloorOnly).map(f => f.building)).size,
    finishedReferenceMarginsM2: round(finishedMargins.reduce((n, r) => n + r.areaM2, 0)),
    photographedStreetFront: 'B046-south',
    buildingsWithRoofFinish: records.filter(r => r.roofFinish.panels > 0).length,
    finishedRoofAreaM2: round(records.reduce((n, r) => n + r.roofFinish.areaM2, 0)),
    supportedSourceWalls: records.reduce((n, r) => n + r.sourceWalls.length, 0) },
  riverbankSigns: { atlas: DOTONBORI_SIGN_ATLAS,
    method: 'Inspect six canal-facing views across both banks and isolated reference elevations. Panels below are actual fitted runtime quads; Glico and the Kani street fascia have separate owners. Context walls retain generated architecture; structural margins and source-cut caps are not missing advertisements.',
    panels: facades.root.getObjectByName('dotonbori-night-signs').userData.panels.map(({ vertex: _vertex, ...panel }) => ({
      ...panel, artwork: DOTONBORI_SIGN_ARTWORK[panel.art][0], projectionM: .42,
    })) },
  referenceRegistrations: fronts.map(f => {
    const p = frontPoint(f, 0, 0, 0).multiplyScalar(size).applyAxisAngle(up, -library.layout.rotationYRadians);
    return { front: f.id, sourceBuilding: f.building,
      centerEastNorthM: [round(p.x + library.layout.centerEastNorthM[0]), round(-p.z + library.layout.centerEastNorthM[1])],
      widthM: round(f.width), bottomTPM: round(f.bottom), topTPM: round(f.top), wallYawRadians: round(f.yaw),
      ...(f.groundFloorOnly ? { groundFloorOnly: true } : {}) };
  }),
  sources: hashes, buildings: records };
await writeFile(new URL('docs/designqr-package/cities/dotonbori/references/facade-audit.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.summary));
buildings.forEach(b => b.geometry.dispose()); library.templates.forEach(t => t.geometry.dispose());
details.geometry.dispose();
facades.root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); facades.materials.forEach(m => m.dispose());
for (const group of groups) group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
