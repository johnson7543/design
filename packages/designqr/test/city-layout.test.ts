import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCityBuildings, CITY_BUILDING_PARCELS } from '../src/designs/city/layout.ts';
import { CITY_PAVEMENT_HEIGHT, SHIBUYA_CARRIAGEWAYS, SHIBUYA_PAVEMENTS, cityPolygonsOverlap, citySurfaceDistance, roadMetres } from '../src/designs/city/road-network.ts';
import { SHIBUYA_BUILDING_DATA } from '../src/designs/city/building-data.ts';
import { SHIBUYA_ROAD_DATA } from '../src/designs/city/road-data.ts';
import { buildCityArchitecturalModel, cityBuildingPanels, createCityRooftopGeometry } from '../src/designs/city/architecture.ts';
import { SHIBUYA_PALETTE } from '../src/designs/city/palette.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';
import { buildCityMorphVoxels } from '../src/designs/city/morph.ts';

test('source parcels never intersect the road, sidewalks, or one another', () => {
  const provenance = SHIBUYA_BUILDING_DATA.provenance;
  assert.equal(provenance.dataset, 'plateau-13113-shibuya-ku-2025');
  assert.equal(provenance.sourceCrs, 'EPSG:6697');
  const roadFileSha = createHash('sha256').update(readFileSync(new URL('../src/designs/city/road-data.ts', import.meta.url))).digest('hex');
  if (provenance.roadSha256 !== roadFileSha) {
    // Pin the original architecture foundation, including every arm point.
    // Lane counts, paint and paving within the original road reservation do
    // not change the source envelopes used to compile the buildings.
    assert.equal(provenance.roadSha256, '99d96b27cc173d1f5b8ac244e5861b4738a842f3418f25bce213299acc505b9b');
    const foundation: Record<string, unknown> = Object.fromEntries(Object.entries(SHIBUYA_ROAD_DATA).filter(([key]) =>
      key !== 'markings' && key !== 'markingInterpretation' && key !== 'surfaceLayout'));
    // This fingerprint also matches the pre-repaint foundation. Only the
    // lane-count hints are omitted; all source coordinates remain pinned.
    foundation.arms = SHIBUYA_ROAD_DATA.arms.map(({ lanes: _lanes, ...geometry }) => geometry);
    assert.equal(createHash('sha256').update(JSON.stringify(foundation)).digest('hex'),
      'ac4f21832c1b638155333c9628234592e5279a5a4fa049d52d1193f94f37c8f2', 'The architecture road foundation changed; regenerate its source assets.');
  }
  assert.equal(CITY_BUILDING_PARCELS.length, 15);
  for (const [index, parcel] of CITY_BUILDING_PARCELS.entries()) {
    assert.ok([...SHIBUYA_CARRIAGEWAYS, ...SHIBUYA_PAVEMENTS].every(p => !cityPolygonsOverlap(p, parcel)), `Parcel ${index} enters a road/sidewalk.`);
    assert.ok(CITY_BUILDING_PARCELS.slice(index + 1).every(p => !cityPolygonsOverlap(p, parcel)));
  }
});

test('QR contents vary contextual heights and facades but preserve measured landmarks and geography', () => {
  const a = generateQRMatrix('Shibuya / A', 'H').modules, b = generateQRMatrix('Shibuya / B', 'H').modules;
  assert.equal(a.length, b.length);
  const original = structuredClone(a), first = createCityBuildings(a), second = createCityBuildings(b);
  assert.deepEqual(first, createCityBuildings(a)); assert.deepEqual(a, original);
  assert.ok(first.filter((building, i) => building.height !== second[i].height).length >= 8);
  for (const buildings of [first, second]) {
    assert.equal(buildings[0].id, 'qfront'); assert.equal(buildings[0].height * 160, 45.9);
    assert.equal(buildings[1].id, 'magnet'); assert.equal(buildings[1].height * 160, 34.2);
    assert.equal(buildings.some(b => 'round' in b), false, 'The out-of-tile cylindrical flagship 109 must not be invented here.');
  }
  assert.deepEqual(first.map(b => b.footprint), second.map(b => b.footprint));
});

test('every authored roof, facade and sign stays in its full polygon envelope', () => {
  const palette = new Set<string>(Object.values(SHIBUYA_PALETTE));
  for (let value = 0; value < 40; value++) {
    const buildings = createCityBuildings(generateQRMatrix(`Shibuya ${value} ${'city/'.repeat(value)}`, 'H').modules);
    for (const b of buildings) {
      assert.ok(b.height >= .03 && b.height <= .45);
      const model = buildCityArchitecturalModel(b);
      for (const layer of [model, ...(model.glass ? [model.glass] : [])]) {
        for (let i = 0; i < layer.positions.length; i += 3) {
          assert.ok(citySurfaceDistance(layer.positions[i], layer.positions[i + 2], [b.envelope]) > -1e-7, `${b.id}: unreserved facade/roof/glass vertex.`);
        }
        assert.ok(layer.swatches.every(c => palette.has(c)));
      }
      for (const panel of cityBuildingPanels(b)) for (const p of panel.path) {
        assert.ok(citySurfaceDistance(p.x, p.z, [b.envelope]) > -1e-7, `${panel.id}: unreserved sign.`);
      }
    }
  }
});

test('Mark City spans the road with clear air below its fixed concourse and QR volume', () => {
  const buildings = createCityBuildings(generateQRMatrix('Mark City passage', 'H').modules);
  const passage = buildings.find(b => b.kind === 'mark-city-passage')!;
  assert.ok(passage && passage.groundEnvelope && passage.baseHeight);
  assert.equal(passage.height, roadMetres(11.0));
  assert.deepEqual(cityBuildingPanels(passage), [], 'A connecting passage must not inherit generic tower advertisements.');
  const model = buildCityArchitecturalModel(passage);
  let roadTriangles = 0, supportTriangles = 0;
  for (let i = 0; i < model.positions.length; i += 9) {
    const points = [0, 3, 6].map(j => model.positions.slice(i + j, i + j + 3));
    const low = Math.min(...points.map(p => p[1])) - CITY_PAVEMENT_HEIGHT;
    const center = points.reduce((v, p) => ({ x: v.x + p[0] / 3, z: v.z + p[2] / 3 }), { x: 0, z: 0 });
    if (citySurfaceDistance(center.x, center.z, SHIBUYA_CARRIAGEWAYS) >= 0) {
      roadTriangles++;
      assert.ok(low >= roadMetres(4.6) - 1e-8, 'The bridge obstructs vehicle clearance.');
    }
    if (low < passage.baseHeight - 1e-8) {
      supportTriangles++;
      for (const p of points) assert.ok(citySurfaceDistance(p[0], p[2], [passage.groundEnvelope!]) >= -1e-8);
    }
  }
  assert.ok(roadTriangles > 0, 'The concourse lost its span above the road.');
  assert.ok(supportTriangles > 0, 'The station-side supports are missing.');
  const targets = Array.from({ length: 64 }, () => ({ x: passage.x, z: passage.z }));
  for (const voxel of buildCityMorphVoxels(targets, [passage])) {
    assert.ok(voxel.y - voxel.height / 2 >= CITY_PAVEMENT_HEIGHT + roadMetres(4.6) - 1e-8,
      'QR massing fills the underpass with a ground-level tower.');
  }
});

test('MAGNET campaigns vary with content while preserving signage placement and identity', () => {
  const panels = (value: string) => cityBuildingPanels(createCityBuildings(generateQRMatrix(value, 'H').modules)[1]);
  const a = panels('Shibuya / A'), b = panels('Shibuya / B');
  assert.notDeepEqual(a.map(panel => panel.design), b.map(panel => panel.design));
  assert.deepEqual(a.map(({ design: _design, ...placement }) => placement),
    b.map(({ design: _design, ...placement }) => placement));
  assert.deepEqual(panels('Shibuya / A'), a);
});


test('each landmark regenerates rooftop placement rather than only equipment height', () => {
  const a = createCityBuildings(generateQRMatrix('Shibuya / A', 'H').modules);
  const b = createCityBuildings(generateQRMatrix('Shibuya / B', 'H').modules);
  for (let i = 0; i < 2; i++) {
    const roofs = [a[i], b[i], a[i]].map(building => createCityRooftopGeometry([building]));
    const positions = roofs.map(roof => Array.from(roof.getAttribute('position').array));
    assert.notDeepEqual(positions[0].filter((_, j) => j % 3 !== 1), positions[1].filter((_, j) => j % 3 !== 1), a[i].id);
    assert.deepEqual(positions[0], positions[2]);
    roofs.forEach(roof => roof.dispose());
  }
});
