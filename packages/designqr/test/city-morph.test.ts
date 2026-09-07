import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Group, Matrix4, Mesh, BoxGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { CityMorphMesh } from '../src/designs/city/morph-mesh.ts';
import { buildCityMorphBase, buildCityMorphPlan, cityMorphActor, createCityMorphCrosswalks, createCityMorphGround, sampleCityMorphMesh,
  type CityMorphTarget } from '../src/designs/city/morph-sources.ts';
import { cohereCityMorphTiles, matchCityMorphBuildings, matchCityMorphDetails } from '../src/designs/city/morph-correspondence.ts';
import { CITY_BUILDING_REVEAL_START, buildCityMorphVoxels, cityBuildingRevealWindows, cityEase, cityMorphPose, cityMorphState, type CityMorphVoxel } from '../src/designs/city/morph.ts';
import { resolveViewTransitionProgress, VIEW_TRANSITION_DURATION_SECONDS } from '../src/designs/tree/constants.ts';
import { SHIBUYA_CROSSWALKS, SHIBUYA_ROAD_MARKINGS, cityPointInPolygon } from '../src/designs/city/road-network.ts';
import { createCityBuildings } from '../src/designs/city/layout.ts';
import { SHIBUYA_PALETTE as P } from '../src/designs/city/palette.ts';
import { cityQRModuleColor } from '../src/designs/city/qr-colors.ts';
import { DESIGN_QR_THEME_PRESETS } from '../src/designs/tree/themes.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';

function fixture(value: string) {
  const matrix = generateQRMatrix(value, 'M').modules, grid = matrix.length;
  const buildings = createCityBuildings(matrix), theme = DESIGN_QR_THEME_PRESETS.shibuya;
  const targets: CityMorphTarget[] = matrix.flatMap((row, r) => row.map((dark, c) => ({
    x: (c + .5) / grid - .5, z: (r + .5) / grid - .5, light: !dark,
    ink: new Color(dark ? cityQRModuleColor(r, c, grid, theme) : theme.groundColor),
  })));
  return { grid, buildings, targets, ground: createCityMorphGround(grid, buildings) };
}

test('whole-city tiles include actual road/paint/pavement and every dark AND light QR cell', () => {
  for (const value of ['TOKYO', 'https://example.com/shibuya', 'https://example.com/' + 'tokyo/'.repeat(32)]) {
    const { grid, targets, buildings, ground } = fixture(value);
    const snapshot = JSON.stringify(targets);
    const plan = buildCityMorphPlan(targets, buildings, ground, []);
    assert.equal(plan.length, grid * grid);
    assert.equal(new Set(plan.map(tile => tile.target)).size, grid * grid);
    assert.deepEqual(new Set(plan.map(tile => tile.source.kind)), new Set(['building', 'road', 'pavement', 'marking']));
    assert.ok(plan.some(tile => tile.target.light && tile.source.kind === 'road'), 'Light cells must visibly originate from the street, not an early pale plate');
    assert.ok(plan.some(tile => !tile.target.light && tile.source.kind === 'road'), 'The road must contribute dark tiles too');
    for (const { source, target, motion } of plan) {
      const end = cityMorphPose(source, target, grid, 1, motion);
      assert.ok(Math.abs(end.x - target.x) < 1e-9 && Math.abs(end.z - target.z) < 1e-9);
      assert.ok(Math.abs(end.y - (target.light ? -.002 : .001)) < 1e-9);
      assert.equal(end.ink, 1); assert.equal(end.angle, 0);
      if (target.light) assert.ok((source as { open?: boolean }).open, 'A light tile starts inside a building/stair well');
    }
    assert.equal(JSON.stringify(targets), snapshot, 'Visual correspondence changed encoded cells or scan inks');
  }
});

test('cached base correspondence matches uncached turns and exact nearest exposed ground', () => {
  for (const value of ['TOKYO', 'https://example.com/shibuya', 'https://example.com/' + 'tokyo/'.repeat(32)]) {
    const { targets, buildings, ground } = fixture(value), base = buildCityMorphBase(targets, buildings, ground);
    const before = JSON.stringify(base), open = ground.filter(g => g.open);
    const plan = buildCityMorphPlan(targets, buildings, ground, createCityMorphCrosswalks(), base);
    assert.deepEqual(plan, buildCityMorphPlan(targets, buildings, ground, createCityMorphCrosswalks()));
    assert.equal(JSON.stringify(base), before, 'Reusing base correspondence mutates the cached plan');
    for (const { source, target } of base.filter(t => t.target.light)) {
      let nearest = open[0], distance = Infinity;
      for (const candidate of open) {
        const d = (candidate.x - target.x) ** 2 + (candidate.z - target.z) ** 2;
        if (d < distance) { distance = d; nearest = candidate; }
      }
      assert.equal(source, nearest, 'Bounded lookup differs from the original full scan');
    }
  }
});

test('small city details merge locally into encoded cells, retaining every source identity', () => {
  const { grid, targets, buildings, ground } = fixture('TOKYO');
  const details: CityMorphVoxel[] = ['people', 'vehicle', 'train', 'sign', 'station', 'furniture', 'garden'].map((kind, i) => ({
    x: .1 + i * .01, y: .025, z: -.1, width: .007, height: .02, depth: .009,
    color: i % 2 ? P.stone : P.blue, kind: kind as CityMorphVoxel['kind'], id: kind,
  }));
  const plan = buildCityMorphPlan(targets, buildings, ground, details);
  assert.equal(plan.length, grid * grid + details.length);
  details.forEach(source => {
    const tile = plan.find(tile => tile.source.id === source.id)!;
    assert.equal(tile.source, source); assert.ok(targets.includes(tile.target));
    assert.ok(Math.hypot(tile.target.x - source.x, tile.target.z - source.z) < .1);
    const pose = cityMorphPose(source, tile.target, grid, 0);
    assert.equal(pose.x, source.x); assert.equal(pose.z, source.z); assert.equal(pose.y, source.y);
  });
});

test('the detailed city remains through the turn, and uniform paper is endpoint-only', () => {
  assert.equal(cityMorphState(.40).cityOpacity, 1, 'The original city becomes see-through before tiles cover it');
  assert.equal(cityMorphState(.42).tileOpacity, 1, 'Retiring architecture lacks opaque tile coverage');
  for (const p of [0, .1, .3, .5, .7, .9, .94]) assert.equal(cityMorphState(p).plateOpacity, 0);
  for (let p = 0; p <= 1; p += .005) {
    const s = cityMorphState(p);
    assert.ok(s.cityOpacity + s.tileOpacity + s.qrOpacity >= .999999);
    const coverage = 1 - (1 - s.cityOpacity) * (1 - s.tileOpacity) * (1 - s.qrOpacity);
    assert.ok(coverage > .998, `Layer alpha leaves a ghosted frame at ${p}: ${coverage}`);
  }
  assert.equal(cityMorphState(0).tileOpacity, 0);
  assert.equal(cityMorphState(1).tileOpacity, 0);
  assert.equal(cityMorphState(1).qrOpacity, 1);
});

test('transient tile motion changes only uniforms; endpoint frames do not draw it', () => {
  const { grid, targets, buildings, ground } = fixture('TOKYO');
  const plan = buildCityMorphPlan(targets, buildings, ground, []);
  const renderer = new CityMorphMesh(plan, grid);
  const version = () => Object.values(renderer.mesh.geometry.attributes).map(a => (a as { version: number }).version);
  const before = version(), matrices = renderer.mesh.instanceMatrix.array.slice();
  for (const p of [0, .12, .3, .36, .42, .5, .9, 1, .9, .5, .42, .36, .3, .12, 0]) {
    renderer.update(p);
    assert.equal(renderer.mesh.visible, p > CITY_BUILDING_REVEAL_START && p < 1);
    assert.deepEqual(version(), before, 'An animation frame uploaded static tile data');
    assert.deepEqual(renderer.mesh.instanceMatrix.array, matrices);
  }
  const previous = renderer.mesh, root = new Group(); root.add(previous);
  let geometryDisposals = 0, instanceDisposals = 0;
  previous.geometry.addEventListener('dispose', () => geometryDisposals++);
  previous.addEventListener('dispose', () => instanceDisposals++);
  renderer.setTiles([...plan, ...plan], grid);
  assert.equal(geometryDisposals, 1); assert.equal(instanceDisposals, 1);
  assert.equal(root.children.length, 1); assert.equal(renderer.mesh.material, previous.material);
  const capacity = renderer.mesh.instanceMatrix.count;
  renderer.setTiles(plan, grid);
  assert.equal(renderer.mesh.instanceMatrix.count, capacity); assert.equal(renderer.mesh.count, plan.length);
  renderer.mesh.geometry.dispose(); renderer.mesh.material.dispose(); renderer.mesh.dispose();
});

test('building sections reveal gradually from roof to base without fading the solid city or changing other elements', () => {
  for (const value of ['TOKYO', 'https://example.com/shibuya', 'https://example.com/' + 'tokyo/'.repeat(32)]) {
    const { grid, targets, buildings, ground } = fixture(value);
    const plan = buildCityMorphPlan(targets, buildings, ground, createCityMorphCrosswalks());
    const sources = plan.map(tile => tile.source), before = JSON.stringify(plan);
    const windows = cityBuildingRevealWindows(sources);
    assert.deepEqual(windows, cityBuildingRevealWindows(sources));
    const mesh = new CityMorphMesh(plan, grid), attribute = mesh.mesh.geometry.getAttribute('cityReveal');
    const buildingWindows = windows.filter((window, i) => {
      assert.ok(Math.abs(attribute.getX(i) - window[0]) < 1e-7 && Math.abs(attribute.getY(i) - window[1]) < 1e-7);
      if (sources[i].kind !== 'building') { assert.deepEqual(window, [.30, .42]); return false; }
      const [start, end] = window;
      assert.ok(start >= .08 && start <= .18 && end >= .34 && end <= .42);
      assert.ok(end - start >= .24);
      for (let p = 0; p < 1; p += .005) {
        // Per-building coverage is never lower than the existing handoff floor.
        assert.ok(cityEase(p, start, end) + 1e-8 >= cityMorphState(p).tileOpacity);
        if (p <= .4) assert.equal(cityMorphState(p).cityOpacity, 1);
      }
      return true;
    });
    for (const group of new Set(sources.filter(s => s.kind === 'building').map(s => s.group))) {
      const indices = sources.flatMap((s, i) => s.kind === 'building' && s.group === group ? [i] : []);
      indices.sort((a, b) => sources[b].y - sources[a].y);
      for (let i = 1; i < indices.length; i++) assert.ok(windows[indices[i]][0] >= windows[indices[i - 1]][0] - 1e-9);
    }
    // The actual shared timing curve, both directions and normal/fast speeds:
    // the old simultaneous .30–.42 ramp is too short even without dropped frames.
    for (const fps of [30, 60]) for (const speed of [1, 2]) for (const direction of [1, -1]) {
      const count = Math.ceil(VIEW_TRANSITION_DURATION_SECONDS / speed * fps);
      // Cover different animation-start offsets relative to refresh, not just
      // a conveniently aligned set of frames that can undersample the old jump.
      const samples = [0, .25, .5, .75].map(offset => [direction === 1 ? 0 : 1,
        ...Array.from({ length: count + 1 }, (_, i) => {
          const p = resolveViewTransitionProgress((i + offset) / fps / (VIEW_TRANSITION_DURATION_SECONDS / speed));
          return direction === 1 ? p : 1 - p;
        })]);
      const peak = ([start, end]: readonly number[]) => Math.max(...samples.flatMap(progress => progress.slice(1).map((p, i) =>
        Math.abs(cityEase(p, start, end) - cityEase(progress[i], start, end)))));
      // A 2x turn at 30 fps has very few frames; still improve its worst jump.
      const limit = fps === 30 && speed === 2 ? .9 : .65;
      assert.ok(Math.max(...buildingWindows.map(peak)) < peak([.30, .42]) * limit,
        `${fps} fps / ${speed}x / ${direction}: building reveal still changes too much in one frame`);
    }
    assert.equal(JSON.stringify(plan), before, 'Reveal timing changed shapes, destinations, actor snapshots or palette');
    mesh.mesh.geometry.dispose(); mesh.mesh.material.dispose(); mesh.mesh.dispose();
  }
});

test('object groups preserve relative positions, headings and footprints before resolving into exact cells', () => {
  const { grid, targets, buildings, ground } = fixture('https://example.com/shibuya');
  const details: CityMorphVoxel[] = ['vehicle', 'train', 'sign'].flatMap(kind => Array.from({ length: 3 }, (_, i) => ({
    x: -.12 + i * .012, y: .035, z: -.08 + ['vehicle', 'train', 'sign'].indexOf(kind) * .05,
    width: .018, height: .02, depth: .012, angle: Math.PI / 2, color: P.stone,
    kind: kind as CityMorphVoxel['kind'], group: kind, id: `${kind}-${i}`,
  })));
  const plan = buildCityMorphPlan(targets, buildings, ground, details).slice(grid * grid);
  assert.deepEqual(buildCityMorphPlan(targets, buildings, ground, details).slice(grid * grid), plan);
  for (const kind of ['vehicle', 'train', 'sign']) {
    const group = plan.filter(tile => tile.source.kind === kind);
    assert.equal(new Set(group.map(tile => tile.target)).size, 3, 'An object collapses all pieces into one cell');
    assert.ok(group.every(tile => JSON.stringify(tile.motion) === JSON.stringify(group[0].motion)));
    const poses = group.map(tile => cityMorphPose(tile.source, tile.target, grid, .57, tile.motion));
    poses.forEach((pose, i) => {
      assert.ok(Math.abs(pose.x - poses[0].x - (group[i].source.x - group[0].source.x)) < 1e-10);
      assert.ok(Math.abs(pose.z - poses[0].z - (group[i].source.z - group[0].source.z)) < 1e-10);
      assert.equal(pose.angle, group[i].source.angle); assert.equal(pose.width, group[i].source.width);
      assert.equal(pose.depth, group[i].source.depth);
    });
  }
  for (const tile of plan) for (let p = 0; p <= 1; p += .01) {
    const a = cityMorphPose(tile.source, tile.target, grid, p, tile.motion);
    const b = cityMorphPose(tile.source, tile.target, grid, p + .0001, tile.motion);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .0005);
    assert.ok(a.width > 0 && a.height > 0 && a.depth > 0);
  }
});

test('dense details use bounded local occupancy without changing QR bits or input snapshots', () => {
  const { grid, targets } = fixture('TOKYO');
  const sources: CityMorphVoxel[] = Array.from({ length: 180 }, (_, i) => ({
    x: (i % 15 - 7) * .007, z: (Math.floor(i / 15) - 6) * .007, y: .015,
    width: .007, height: .012, depth: .006, color: i % 2 ? P.stone : P.blue, kind: 'people', id: `person-${i}`,
  }));
  const snapshot = JSON.stringify({ sources, targets });
  const pairs = matchCityMorphDetails(sources, targets, grid);
  const counts = new Map<CityMorphTarget, number>();
  for (const { source, target } of pairs) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
    assert.ok(Math.hypot(source.x - target.x, source.z - target.z) < 6 / grid, 'Crowd tiles left their six-cell neighborhood');
  }
  assert.ok(Math.max(...counts.values()) <= 2, 'The crowd piled onto a few destination cells');
  assert.equal(JSON.stringify({ sources, targets }), snapshot);
  const single = targets.slice(0, 1);
  assert.equal(matchCityMorphDetails(sources, single, grid).length, sources.length, 'A sparse compatible palette loses sources');
  assert.deepEqual(matchCityMorphDetails(sources, [], grid), []);
  assert.deepEqual(cohereCityMorphTiles([]), []);
});

test('building correspondence shortens paths without crossing parcel ownership', () => {
  const { targets, buildings } = fixture('https://example.com/shibuya');
  const dark = targets.filter(target => !target.light), sources = buildCityMorphVoxels(dark, buildings);
  const before = sources.reduce((sum, s, i) => sum + (s.x - dark[i].x) ** 2 + (s.z - dark[i].z) ** 2, 0);
  const pairs = matchCityMorphBuildings(sources, dark);
  const after = pairs.reduce((sum, p) => sum + (p.source.x - p.target.x) ** 2 + (p.source.z - p.target.z) ** 2, 0);
  assert.ok(after < before * .9, 'Unnecessarily crossing building paths remain');
  assert.equal(new Set(pairs.map(p => p.target)).size, dark.length);
  for (const { source, target } of pairs) assert.equal(source.group, sources[dark.indexOf(target)].group);
});

test('crosswalk fragments retain actual stripe proportions, orientation and crossing groups', () => {
  const stripes = createCityMorphCrosswalks();
  assert.equal(stripes.length, 60);
  assert.deepEqual(createCityMorphCrosswalks(), stripes);
  const paint = SHIBUYA_ROAD_MARKINGS.find(marking => marking.role === 'paper')!.polygons;
  for (const crossing of SHIBUYA_CROSSWALKS) assert.equal(stripes.filter(s => s.group === `crosswalk-${crossing.id}`).length, 12);
  for (const stripe of stripes) {
    assert.ok(stripe.width > stripe.depth * 4, 'A zebra stripe was replaced by a square');
    const cos = Math.cos(stripe.angle!), sin = Math.sin(stripe.angle!);
    assert.ok(paint.some(polygon => [-1, 1].every(i => [-1, 1].every(j => cityPointInPolygon({
      x: stripe.x + i * stripe.width / 2 * cos + j * stripe.depth / 2 * sin,
      z: stripe.z - i * stripe.width / 2 * sin + j * stripe.depth / 2 * cos,
    }, polygon)))), 'A proxy stripe extends beyond the source paint');
  }
});

test('actor snapshots and seeded static sampling leave live geometry and poses untouched', () => {
  const matrix = new Matrix4().makeRotationY(.8).scale(new Vector3(.02, .01, .03)).setPosition(.1, .02, -.1);
  const before = matrix.clone();
  const actor = cityMorphActor(matrix, P.blue, 'vehicle', 'car', new Vector3(), new Vector3(1, 1, 1));
  assert.deepEqual(matrix, before); assert.equal(actor.x, .1); assert.equal(actor.y, .02);
  assert.ok(Math.abs(actor.angle! - .8) < 1e-9);
  const mesh = new Mesh(new BoxGeometry(.1, .2, .1), new MeshBasicMaterial());
  const positions = mesh.geometry.getAttribute('position').array.slice();
  assert.deepEqual(sampleCityMorphMesh(mesh, 'station', 24), sampleCityMorphMesh(mesh, 'station', 24));
  assert.deepEqual(mesh.geometry.getAttribute('position').array, positions);
  mesh.geometry.dispose(); mesh.material.dispose();
});
