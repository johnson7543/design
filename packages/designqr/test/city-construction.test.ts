import assert from 'node:assert/strict';
import test from 'node:test';
import { createShibuyaConstructionGeometry } from '../src/designs/city/construction-geometry.ts';
import { SHIBUYA_WORKSITE, isCityWorksiteApproachClear } from '../src/designs/city/construction-layout.ts';
import { HACHIKO_OBSTACLES, HACHIKO_MONUMENT } from '../src/designs/city/hachiko-layout.ts';
import { createCityBuildings } from '../src/designs/city/layout.ts';
import { CITY_PAVEMENT_HEIGHT, SHIBUYA_CARRIAGEWAYS, cityPolygonsOverlap, citySurfaceDistance, citySurveyPoint, roadMetres } from '../src/designs/city/road-network.ts';

test('the worksite and its details stay within the enclosure and preserve public approaches', () => {
  const buildings = createCityBuildings([[true]]);
  for (const obstacle of [...SHIBUYA_CARRIAGEWAYS, ...HACHIKO_OBSTACLES, ...buildings.map(b => b.groundEnvelope ?? b.envelope)]) {
    assert.ok(!cityPolygonsOverlap(SHIBUYA_WORKSITE, obstacle), 'The worksite overlaps a road, garden or building.');
  }
  const { geometry, panels } = createShibuyaConstructionGeometry();
  try {
    const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
    assert.ok(positions.count / 3 < 10000);
    assert.equal(panels.length, 2);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      assert.ok(citySurfaceDistance(x, z, [SHIBUYA_WORKSITE]) >= -1e-6, 'Worksite geometry projects into the public walkway.');
      assert.ok(citySurfaceDistance(x, z, SHIBUYA_CARRIAGEWAYS) < 0);
      assert.ok(y >= CITY_PAVEMENT_HEIGHT - 1e-6 && y <= CITY_PAVEMENT_HEIGHT + roadMetres(6.5));
      for (const c of [colors.getX(i), colors.getY(i), colors.getZ(i)]) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1);
    }
    const inside = citySurveyPoint(30, 60);
    assert.equal(isCityWorksiteApproachClear(inside.x, inside.z), false);
    // The continuous work zone reaches both structures rather than floating
    // separately in the plaza; retain a small facade clearance at each end.
    for (const kind of ['station-front', 'mark-city-passage']) {
      const building = buildings.find(b => b.kind === kind)!;
      const gap = Math.min(...SHIBUYA_WORKSITE.rings[0].map(p =>
        -citySurfaceDistance(p.x, p.z, [building.footprint])));
      assert.ok(gap >= 0 && gap < roadMetres(1), `The worksite is disconnected from ${kind}.`);
    }
    for (const distance of [2, 8, 15, 25, 35]) {
      const p = citySurveyPoint(HACHIKO_MONUMENT.eastMetres + distance, HACHIKO_MONUMENT.southMetres);
      assert.ok(isCityWorksiteApproachClear(p.x, p.z), 'The station-facing photo approach must remain open.');
    }
  } finally { geometry.dispose(); }
});
