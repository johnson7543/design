import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Mesh } from 'three';
import { createTokyoTowerParts, towerFaces, towerSourceColor } from '../src/designs/city/tokyo-tower-parts.ts';
import { mapTokyoTower, towerCollapsePoint, towerSourcePoint, towerTargetPoint } from '../src/designs/city/tokyo-tower-morph.ts';
import { createCityQRTargets } from '../src/designs/city/qr-colors.ts';
import { DESIGN_QR_THEME_PRESETS } from '../src/designs/tree/themes.ts';
import { normalizeDesignQRConfig } from '../src/config/normalize.ts';
import { encodeDesignQRConfig, decodeDesignQRConfig } from '../src/config/codec.ts';
import { TokyoTowerScene } from '../src/renderer/webgl/TokyoTowerScene.ts';
import { TOKYO_TOWER_BLENDER_DATA } from '../src/designs/city/tokyo-tower-blender-data.ts';

const theme = DESIGN_QR_THEME_PRESETS['tokyo-tower'];
const parts = createTokyoTowerParts(), faces = towerFaces(parts);
const matrix = (grid: number) => Array.from({ length: grid }, (_, r) => Array.from({ length: grid }, (_, c) => (r * 7 + c * 13) % 5 < 3));

test('tower runtime retains every evaluated Blender object and complete surface', () => {
  assert.equal(new Set(parts.map(p => p.id)).size, parts.length);
  const sourceFaceCount = parts.reduce((sum, p) => sum + p.surfaces.length, 0);
  assert.equal(new Set(faces.map(face => face.sourceId)).size, sourceFaceCount);
  const inventory = JSON.parse(readFileSync(new URL('../../../assets/design-qr/tokyo-tower/part-inventory.json', import.meta.url), 'utf8'));
  const blend = readFileSync(new URL('../../../assets/design-qr/tokyo-tower/tower.blend', import.meta.url));
  assert.equal(createHash('sha256').update(blend).digest('hex'), TOKYO_TOWER_BLENDER_DATA.blendSha256);
  assert.equal(inventory.counts.parts, parts.length); assert.equal(inventory.counts.surfaces, sourceFaceCount);
  assert.deepEqual(inventory.parts.map((p: { id: string }) => p.id), parts.map(p => p.id));
  assert.deepEqual([...new Set(parts.map(p => p.assembly))].sort(), ['access', 'antenna', 'base', 'lattice', 'legs', 'main-deck', 'top-deck']);
  assert.ok(parts.length > 2000); assert.ok(parts.some(p => p.surfaces.length > 20));
  assert.equal(Math.max(...parts.flatMap(p => p.corners.map(v => v[1]))), 333 / 320);
  // Contractor's construction GL elevations, not the advertised 150m/250m names.
  for (const [id, metres] of [['main-deck-shell', 120], ['top-deck-shell', 223.5]] as const) {
    const p = parts.find(p => p.id === id)!;
    assert.ok(Math.min(...p.corners.map(v => v[1])) < metres / 320);
    assert.ok(Math.max(...p.corners.map(v => v[1])) > metres / 320);
  }
  const spanM = (id: string) => {
    const p = parts.find(p => p.id === id)!;
    return (Math.max(...p.corners.map(v => v[0])) - Math.min(...p.corners.map(v => v[0]))) * 320;
  };
  assert.ok(spanM('main-deck-roof') > 29 && spanM('main-deck-roof') < 32);
  assert.ok(spanM('top-deck-roof') > 13 && spanM('top-deck-roof') < 16);
  const foot = (sx: number, sz: number) => parts.find(p => p.id === `footing-${sx}-${sz}`)!;
  assert.ok(Math.abs((foot(1, 1).center[0] - foot(-1, 1).center[0]) * 320 - 80) < .01);
  assert.ok(parts.some(p => p.id.startsWith('lower-bay-')));
  assert.ok(parts.some(p => p.id.startsWith('antenna-mast-web-')));
  for (const face of faces) {
    assert.ok(face.corners.flat().every(Number.isFinite));
    const [a, b, , d] = face.corners;
    const u = b.map((n, i) => n - a[i]), v = d.map((n, i) => n - a[i]);
    assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 1e-12, face.id);
  }
});

test('ground subdivision preserves whole Blender faces and baked light in both dimensions', () => {
  const sourceFaces = new Map<string, typeof faces>();
  for (const face of faces) {
    const group = sourceFaces.get(face.sourceId) ?? []; group.push(face); sourceFaces.set(face.sourceId, group);
  }
  for (const part of parts) part.surfaces.forEach((indices, index) => {
    const tiles = sourceFaces.get(`${part.id}/face-${index}`)!;
    const source = { ...tiles[0], corners: indices.map(i => part.corners[i]), colors: part.cornerLight.slice(index * 4, index * 4 + 4) };
    const original = source as unknown as typeof faces[number];
    let area = 0;
    for (const tile of tiles) {
      const [u0, v0, u1, v1] = tile.sourceUV;
      area += (u1 - u0) * (v1 - v0);
      const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      uv.forEach(([u, v], i) => {
        assert.deepEqual(tile.corners[i], towerSourcePoint(original, u, v));
        assert.deepEqual(tile.colors[i], towerSourceColor(original, u, v));
      });
      if (part.ground) for (let i = 0; i < 4; i++) {
        const edge = tile.corners[i].map((n, axis) => n - tile.corners[(i + 1) % 4][axis]);
        assert.ok(Math.hypot(...edge) <= 1 / 24 + 1e-12, 'A long ground ribbon escaped subdivision.');
      }
    }
    assert.ok(Math.abs(area - 1) < 1e-12, 'The original Blender face lost surface coverage.');
    // Every row tiles the original width once; all rows tile its height once.
    const rows = new Map<number, typeof tiles>();
    for (const tile of tiles) { const row = rows.get(tile.sourceUV[1]) ?? []; row.push(tile); rows.set(tile.sourceUV[1], row); }
    let endV = 0;
    for (const [startV, row] of [...rows].sort(([a], [b]) => a - b)) {
      assert.equal(startV, endV); let endU = 0;
      for (const tile of row.sort((a, b) => a.sourceUV[0] - b.sourceUV[0])) {
        assert.equal(tile.sourceUV[0], endU); endU = tile.sourceUV[2]; assert.equal(tile.sourceUV[3], row[0].sourceUV[3]);
      }
      assert.equal(endU, 1); endV = row[0].sourceUV[3];
    }
    assert.equal(endV, 1);
  });
});

test('all supported grids preserve complete source surfaces and exact nonoverlapping QR cell coverage', () => {
  for (let grid = 21; grid <= 57; grid += 4) {
    const targets = createCityQRTargets(matrix(grid), theme), patches = mapTokyoTower(faces, targets);
    const source = new Map<string, [number, number][]>(), destination = new Map<number, [number, number][]>();
    for (const patch of patches) {
      const a = source.get(patch.face.id) ?? [], b = destination.get(patch.cell) ?? [];
      a.push([patch.sourceStart, patch.sourceEnd]); b.push([patch.targetStart, patch.targetEnd]);
      source.set(patch.face.id, a); destination.set(patch.cell, b);
      assert.ok(patch.sourceEnd > patch.sourceStart); assert.ok(patch.targetEnd > patch.targetStart);
      if (patch.face.part.assembly !== 'base') {
        assert.equal(targets[patch.cell].light, false);
        assert.ok(Math.abs(targets[patch.cell].x) >= .1 + 1 / grid || Math.abs(targets[patch.cell].z) >= .1 + 1 / grid);
      }
    }
    assert.equal(source.size, faces.length); assert.equal(destination.size, grid * grid);
    for (const ranges of [...source.values(), ...destination.values()]) {
      ranges.sort((a, b) => a[0] - b[0]); let end = 0;
      for (const [a, b] of ranges) { assert.ok(Math.abs(a - end) < 1e-12); end = b; }
      assert.equal(end, 1);
    }
    assert.ok(patches.length <= faces.length + grid * grid);
  }
});

test('the full ground supplies QR paper across the square without shrinking into a corner', () => {
  for (let grid = 21; grid <= 57; grid += 4) {
    const targets = createCityQRTargets(matrix(grid), theme), patches = mapTokyoTower(faces, targets);
    const paper = new Set<number>(), islandQuadrants = [0, 0, 0, 0];
    let islandArea = 0;
    for (const patch of patches) {
      assert.equal(patch.face.part.ground, targets[patch.cell].light);
      if (!patch.face.part.ground) continue;
      paper.add(patch.cell);
      if (patch.face.part.id === 'island') {
        const area = patch.targetEnd - patch.targetStart, target = targets[patch.cell];
        islandArea += area;
        islandQuadrants[Number(target.x >= 0) + 2 * Number(target.z >= 0)] += area;
      }
    }
    assert.equal(paper.size, targets.filter(t => t.light).length);
    assert.ok(islandArea > paper.size * .6, 'Broad island area was reduced to a detail-sized allotment.');
    assert.ok(islandQuadrants.every(area => area > paper.size * .1), 'The island must reach all four quarters of the QR paper.');
    const ground = patches.filter(p => p.face.part.ground);
    for (const progress of [0, .15, .35, .55, .75, .94, 1]) {
      const low = [Infinity, Infinity], high = [-Infinity, -Infinity];
      for (const patch of ground) for (const u of [0, 1]) for (const v of [0, 1]) {
        const source = towerSourcePoint(patch.face, patch.sourceStart + u * (patch.sourceEnd - patch.sourceStart), v);
        const target = towerTargetPoint(patch, targets[patch.cell], grid, u, v);
        const pose = towerCollapsePoint(source, patch.face.part.center, target, progress, true);
        [pose[0], pose[2]].forEach((n, axis) => { low[axis] = Math.min(low[axis], n); high[axis] = Math.max(high[axis], n); });
        assert.ok(pose[1] <= .003 && pose[1] >= -.01, 'The ground must stay level below the falling structure.');
      }
      assert.ok(low.every(n => n < -.4) && high.every(n => n > .4), `Ground contracted at ${grid}/${progress}.`);
    }
  }
});

test('Blender light reaches every source corner and survives QR subdivision without seams', () => {
  assert.equal(TOKYO_TOWER_BLENDER_DATA.lighting.engine, 'Cycles');
  assert.equal(TOKYO_TOWER_BLENDER_DATA.lighting.landmarkFixtures, 180);
  let gradients = 0, warm = 0, shadowed = 0;
  for (const part of parts) {
    assert.equal(part.cornerLight.length, part.surfaces.length * 4);
    for (const [r, g, b] of part.cornerLight) {
      assert.ok([r, g, b].every(c => Number.isFinite(c) && c >= 0 && c <= 1));
      if (r > .08 && r > g && g > b * 1.5) warm++;
      if (Math.max(r, g, b) < .03) shadowed++;
    }
  }
  for (const face of faces) {
    assert.deepEqual(towerSourceColor(face, 0, 0), face.colors[0]);
    assert.deepEqual(towerSourceColor(face, 1, 1), face.colors[2]);
    if (Math.abs(face.colors[0][0] - face.colors[2][0]) > .02) gradients++;
    const cut = .37, before = towerSourceColor(face, cut, 0);
    const left = { ...face, colors: [face.colors[0], before, towerSourceColor(face, cut, 1), face.colors[3]] as const };
    const right = { ...face, colors: [before, face.colors[1], face.colors[2], towerSourceColor(face, cut, 1)] as const };
    assert.deepEqual(towerSourceColor(left, 1, .6), towerSourceColor(right, 0, .6));
  }
  assert.ok(warm > 1000 && shadowed > 1000 && gradients > 1000, 'Night lighting lost warm floodlight, occlusion, or surface variation.');
});

test('collapse is finite, reversible, starts on the source and ends on the exact QR patches', () => {
  const grid = 25, targets = createCityQRTargets(matrix(grid), theme);
  for (const patch of mapTokyoTower(faces, targets)) for (const u of [0, 1]) {
    const source = towerSourcePoint(patch.face, patch.sourceStart + u * (patch.sourceEnd - patch.sourceStart), 0);
    const target = towerTargetPoint(patch, targets[patch.cell], grid, u, 0), center = patch.face.part.center;
    for (const p of [0, .15, .35, .55, .75, .94, 1, .75, .35, 0]) {
      const point = towerCollapsePoint(source, center, target, p, patch.face.part.ground);
      assert.ok(point.every(Number.isFinite));
      if (p === 0) point.forEach((n, i) => assert.ok(Math.abs(n - source[i]) < 1e-12));
      if (p === 1) assert.deepEqual(point, target);
    }
  }
});

test('canonical config and scan colors preserve Tokyo Tower across links', () => {
  const config = normalizeDesignQRConfig({ value: '東京鐵塔 🌃', design: 'city', theme: 'tokyo-tower' });
  assert.deepEqual(decodeDesignQRConfig(encodeDesignQRConfig(config)), { ok: true, value: config });
  assert.deepEqual(createCityQRTargets(matrix(25), theme), createCityQRTargets(matrix(25), DESIGN_QR_THEME_PRESETS.shibuya));
});

test('one persistent mesh owns both endpoints, edits retain all parts, instances dispose independently', () => {
  const a = new TokyoTowerScene(matrix(25), theme), b = new TokyoTowerScene(matrix(21), theme);
  const mesh = a.root.children[0];
  for (const p of [0, .35, 1, .5, 0]) {
    a.update(p); assert.equal(a.root.children.length, 1); assert.equal(a.root.children[0], mesh); assert.equal(mesh.visible, true);
  }
  a.update(.45); a.updateContent(matrix(57), theme);
  assert.equal(a.root.userData.inventory.parts, parts.length);
  assert.equal(a.root.userData.inventory.cells, 57 ** 2);
  a.dispose(); a.dispose(); assert.equal(a.root.children.length, 0); assert.equal(b.root.children.length, 1); b.dispose();
});

test('a mid-turn QR version edit retains both sides of every old surface cut', () => {
  const scene = new TokyoTowerScene(matrix(25), theme), p = .45;
  const poses = (corrected: boolean) => {
    const geometry = (scene.root.children[0] as Mesh).geometry;
    const source = geometry.getAttribute('position'), center = geometry.getAttribute('towerCenter');
    const end = geometry.getAttribute('towerEnd'), delta = geometry.getAttribute('towerCorrection'), ground = geometry.getAttribute('towerGround');
    const result = new Map<string, number[][]>();
    for (let i = 0; i < source.count; i++) {
      const a = [source.getX(i), source.getY(i), source.getZ(i)] as const;
      const b = [center.getX(i), center.getY(i), center.getZ(i)] as const;
      const c = [end.getX(i), end.getY(i), end.getZ(i)] as const;
      const pose = [...towerCollapsePoint(a, b, c, p, ground.getX(i) > .5)];
      if (corrected) { pose[0] += delta.getX(i); pose[1] += delta.getY(i); pose[2] += delta.getZ(i); }
      const key = [...a, ...b].map(n => n.toFixed(7)).join(',');
      const group = result.get(key) ?? []; group.push(pose); result.set(key, group);
    }
    return result;
  };
  scene.update(p); const before = poses(false); scene.updateContent(matrix(57), theme); const after = poses(true);
  for (const [key, points] of before) for (const point of points) {
    assert.ok(after.get(key)?.some(candidate => candidate.every((n, i) => Math.abs(n - point[i]) < 2e-7)), `Lost an existing cut vertex at ${key}`);
  }
  scene.dispose();
});
