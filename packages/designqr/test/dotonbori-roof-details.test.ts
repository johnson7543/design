import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Triangle, Vector3 } from 'three';
import type { DotonboriBuilding } from '../src/designs/city/dotonbori-buildings.ts';
import type { DotonboriFront } from '../src/designs/city/dotonbori-facade-layout.ts';
import { DotonboriGeometry } from '../src/designs/city/dotonbori-geometry.ts';
import { dotonboriBuildingRanges } from '../src/designs/city/dotonbori-ownership.ts';
import { addDotonboriRoofDetails } from '../src/designs/city/dotonbori-roof-details.ts';

const size = 144;
function building() {
  const geometry = new BufferGeometry();
  // A steep roof overlooked by the vertical-window and flat-equipment passes.
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.12, .04, -.1, -.12, .22, -.04, .12, .22, -.04,
    -.12, .04, -.1, .12, .22, -.04, .12, .04, -.1,
  ], 3));
  geometry.computeBoundingBox();
  return { id: 'roof-host', index: 4, geometry, fixed: false, seed: 123,
    floors: 5, facade: 'stone', sign: 0, walls: [], sections: [] } satisfies DotonboriBuilding;
}
function finish(host: DotonboriBuilding, fronts: DotonboriFront[] = []) {
  const detail = new DotonboriGeometry(size, 'roof-test'); detail.buildingId = host.id;
  const counts = addDotonboriRoofDetails(detail, host, fronts);
  return { geometry: detail.finish(), counts };
}

test('steep roof finishes follow the original surface and retain their host for complete QR transport', () => {
  const host = building(), source = host.geometry.getAttribute('position');
  const original = Array.from(source.array), result = finish(host);
  const faces = [0, 3].map(i => new Triangle(...[0, 1, 2].map(j => new Vector3().fromBufferAttribute(source, i + j)) as [Vector3, Vector3, Vector3]));
  assert.ok(result.counts.panels > 20 && result.counts.edges === 4, 'Finish the four roof contours without drawing the internal triangle diagonal.');
  const p = result.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const point = new Vector3().fromBufferAttribute(p, i);
    const distance = Math.min(...faces.map(face => face.closestPointToPoint(point, new Vector3()).distanceTo(point))) * size;
    assert.ok(distance > .017 && distance < .033, `Unsupported or coplanar roof finish at ${distance} m.`);
  }
  const ranges = dotonboriBuildingRanges(result.geometry);
  assert.ok(ranges.length > 0 && ranges.every(range => range.building === host.id));
  assert.deepEqual(Array.from(source.array), original, 'Finishing must not change source roof shape or height.');
  result.geometry.dispose(); host.geometry.dispose();
});

test('roof joints vary deterministically with QR seed and remain inside the tile', () => {
  const host = building(), source = host.geometry.getAttribute('position');
  for (let i = 0; i < source.count; i++) source.setX(i, source.getX(i) + .38);
  const a = finish(host), repeat = finish(host), different = finish({ ...host, seed: 92834 });
  assert.deepEqual(a.geometry.getAttribute('position').array, repeat.geometry.getAttribute('position').array);
  assert.notDeepEqual(a.geometry.getAttribute('position').array, different.geometry.getAttribute('position').array);
  for (const result of [a, different]) {
    const p = result.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getX(i)) <= .5 && Math.abs(p.getZ(i)) <= .5);
  }
  for (const result of [a, repeat, different]) result.geometry.dispose(); host.geometry.dispose();
});

test('existing photographed setback glazing excludes the roof finish entirely', () => {
  const host = building();
  const wall = { nx: 0, nz: -1, dx: 1, dz: 0, plane: .1,
    minU: -.12, maxU: .12, minY: .04, maxY: .22, triangles: [] };
  const base = { ...wall, building: host.id, wall, size, u: 0, width: .24 * size, yaw: Math.PI };
  const fronts = [{ ...base, id: 'B034-east-lower', bottom: 0, top: .04 * size },
    { ...base, id: 'B034-east-upper', bottom: .22 * size, top: .3 * size }];
  const result = finish(host, fronts);
  assert.deepEqual(result.counts, { panels: 0, edges: 0, surfaceAreaM2: 0 });
  result.geometry.dispose(); host.geometry.dispose();
});
