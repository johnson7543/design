import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, PerspectiveCamera, Scene, Texture } from 'three';
import { cityBuildingPanels, cityFacadePanelGeometry, cityPanelAnchor } from '../src/designs/city/architecture.ts';
import { CITY_CAMERA_YAW_OFFSET, createCityBuildings, fitCityCameraDistance } from '../src/designs/city/layout.ts';
import { buildCityMorphVoxels, cityMorphPose, cityMorphState } from '../src/designs/city/morph.ts';
import { CITY_VEHICLES } from '../src/designs/city/vehicles.ts';
import { cityVehiclePosition } from '../src/designs/city/motion.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_VEHICLE_SCALE, citySurfaceContainsBounds } from '../src/designs/city/road-network.ts';
import { BLOCK_SIZE, resolveQRViewportProjection, VIEW_TRANSITION_DURATION_SECONDS } from '../src/designs/tree/constants.ts';
import { BLUE_MORNING_SWATCHES, SHIBUYA_PALETTE } from '../src/designs/city/palette.ts';
import { DESIGN_QR_THEME_PRESETS } from '../src/designs/tree/themes.ts';
import { cityQRModuleColor } from '../src/designs/city/qr-colors.ts';
import { generateQRMatrix, isFinderPattern } from '../src/designs/tree/qr.ts';
import { ThreeFallbackRenderer } from '../src/renderer/webgl/ThreeFallbackRenderer.ts';

test('source-facing signs and the logo have outward normals and upright unmirrored UVs', () => {
  const buildings = createCityBuildings(generateQRMatrix('Shibuya', 'H').modules);
  for (const b of buildings) for (const panel of cityBuildingPanels(b)) {
    const geometry = cityFacadePanelGeometry(panel);
    const normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < normals.count; i++) {
      // Curved balcony signs follow each segment's outward normal, not the chord.
      const segment = Math.floor(i / 6), a = panel.path[segment], c = panel.path[segment + 1];
      const angle = Math.atan2(-(c.z - a.z), c.x - a.x);
      assert.ok(normals.getX(i) * Math.sin(angle) + normals.getZ(i) * Math.cos(angle) > .999);
      assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1.00001 && uv.getY(i) >= 0 && uv.getY(i) <= 1);
    }
    geometry.dispose();
  }
  const magnet = buildings.find(b => b.kind === 'magnet')!;
  const panels = cityBuildingPanels(magnet);
  const side = cityPanelAnchor(panels.find(p => p.id.endsWith('side-poster'))!);
  const corner = cityPanelAnchor(panels.find(p => p.id.endsWith('corner-poster'))!);
  assert.ok(Math.cos(side.angle - corner.angle) < .95, 'MAGNET needs distinct front and side faces, not overlapping panels.');
  const hero = cityBuildingPanels(buildings[0]).find(panel => panel.hero)!;
  const yaw = Math.PI / 4 + CITY_CAMERA_YAW_OFFSET, anchor = cityPanelAnchor(hero);
  assert.ok(Math.cos(yaw - anchor.angle) > .85, 'The starting view must face QFRONT and its configured logo.');
});

test('mixed vehicle lengths retain a gap in both traffic queues', () => {
  assert.equal(new Set(CITY_VEHICLES.map(vehicle => vehicle.type)).size, 4);
  for (const start of [0, 6]) for (let i = start + 1; i < start + 6; i++) {
    const gap = Math.abs(cityVehiclePosition(i, 5).distance - cityVehiclePosition(i - 1, 5).distance) / CITY_VEHICLE_SCALE
      - (CITY_VEHICLES[i].length + CITY_VEHICLES[i - 1].length) / 2;
    assert.ok(gap > .013, 'Vehicle bodies overlap while waiting.');
  }
});

test('the building-to-cell handoff is continuous and ends on every exact QR module', () => {
  for (const value of ['Shibuya', 'https://example.com/' + 'city/'.repeat(30)]) {
    const matrix = generateQRMatrix(value, 'H').modules;
    const targets = matrix.flatMap((row, z) => row.flatMap((dark, x) => dark ? [{ x: (x + .5) / matrix.length - .5, z: (z + .5) / matrix.length - .5 }] : []));
    const buildings = createCityBuildings(matrix);
    const sources = buildCityMorphVoxels(targets, buildings);
    assert.equal(sources.length, targets.length);
    for (const [i, source] of sources.entries()) {
      assert.ok(buildings.some(b => citySurfaceContainsBounds([b.footprint], { minX: source.x - source.width / 2, maxX: source.x + source.width / 2,
        minZ: source.z - source.depth / 2, maxZ: source.z + source.depth / 2 }) && source.y >= CITY_PAVEMENT_HEIGHT && source.y <= CITY_PAVEMENT_HEIGHT + b.height),
      'A morph block did not originate in the generated skyline.');
      const start = cityMorphPose(source, targets[i], matrix.length, 0);
      assert.equal(start.x, source.x); assert.equal(start.y, source.y);
      for (let p = 0; p < 1; p += .01) {
        const pose = cityMorphPose(source, targets[i], matrix.length, p);
        const next = cityMorphPose(source, targets[i], matrix.length, p + .0001);
        assert.ok(pose.width > 0 && pose.height > 0 && pose.depth > 0);
        assert.ok(Math.hypot(next.x - pose.x, next.y - pose.y, next.z - pose.z) < .0004);
      }
      const end = cityMorphPose(source, targets[i], matrix.length, 1);
      assert.ok(Math.abs(end.x - targets[i].x) < 1e-9 && Math.abs(end.z - targets[i].z) < 1e-9);
      assert.ok(Math.abs(end.width - 1.002 / matrix.length) < 1e-9 && Math.abs(end.height - .002) < 1e-9);
    }
    for (let p = 0; p <= 1; p += .01) {
      const state = cityMorphState(p);
      assert.equal(state.cityOpacity + state.voxelOpacity, 1, 'The handoff leaves a blank frame.');
    }
  }
});

test('one logo moves from a depth-tested billboard to the QR center and restores the sign on removal', () => {
  const renderer = Object.create(ThreeFallbackRenderer.prototype);
  let branded = false;
  const anchor = { x: -.30, y: .25, z: -.045, width: .161, height: .070 };
  Object.assign(renderer, {
    scene: new Scene(), camera: new PerspectiveCamera(), treeData: { gridSize: 29, city: {} }, currentProgress: 0,
    logoConfig: { src: 'fixture.png', size: .16, alt: 'Fixture' },
    cityScene: { getLogoAnchor: () => anchor, setLogoPresent: (value: boolean) => { branded = value; } },
  });
  renderer.createLogoVisual(new Texture(), 2);
  assert.equal(branded, true);
  assert.equal(renderer.logoGroup.children.length, 1);
  assert.ok(Math.abs(renderer.logoGroup.position.x - anchor.x * 29 * BLOCK_SIZE) < 1e-9);
  assert.equal(renderer.logoGroup.children[0].material.depthTest, true);
  renderer.updateLogoTransform(1);
  assert.ok(Math.abs(renderer.logoGroup.position.x) < 1e-9 && Math.abs(renderer.logoGroup.position.z) < 1e-9);
  assert.ok(Math.abs(renderer.logoGroup.scale.x - 29 * BLOCK_SIZE * .16) < 1e-9);
  renderer.disposeLogoVisual();
  assert.equal(branded, false);
  assert.equal(renderer.scene.children.length, 0);
});

test('Dōtonbori rebases 1× to the former 0.75× pace in both directions and at every speed', () => {
  for (const preset of [null, undefined, 'shibuya', 'dotonbori', 'tokyo-tower']) {
    const duration = VIEW_TRANSITION_DURATION_SECONDS / (preset === 'dotonbori' ? .75 : 1);
    for (const speed of [.25, .5, .75, 1, 1.25, 1.5, 1.75, 2]) for (const target of [0, 1]) {
      const renderer = Object.create(ThreeFallbackRenderer.prototype);
      Object.assign(renderer, { treeData: preset === null ? {} : { city: { preset } }, _targetProgress: 1 - target,
        currentProgress: 1 - target, transitionSpeed: speed });
      renderer.targetProgress = target;
      assert.ok(Math.abs(renderer.transitionDuration - duration / speed) < 1e-12);
      renderer.transitionStartTime = performance.now() - renderer.transitionDuration * 500;
      renderer.setTransitionSpeed(speed === 2 ? 1 : 2);
      assert.ok(Math.abs(renderer.transitionDuration - duration / (speed === 2 ? 1 : 2)) < 1e-12);
      const elapsedRatio = (performance.now() - renderer.transitionStartTime) / (renderer.transitionDuration * 1000);
      assert.ok(Math.abs(elapsedRatio - .5) < .02, 'Changing speed jumps within the active turn.');
    }
  }
});

test('changing city presets preserves the active phase and restores each design’s 1× baseline', () => {
  const renderer = Object.create(ThreeFallbackRenderer.prototype);
  Object.assign(renderer, { treeData: {}, _targetProgress: 0, currentProgress: 0, transitionSpeed: 1,
    rebuildMeshes() {}, renderOnce() {} });
  renderer.targetProgress = 1;
  for (const preset of ['dotonbori', 'shibuya', 'dotonbori', 'tokyo-tower', 'dotonbori', null]) {
    renderer.transitionStartTime = performance.now() - renderer.transitionDuration * 500;
    renderer.setTreeData(preset === null ? {} : { city: { preset } });
    assert.equal(renderer.transitionSpeed, 1, 'The configured speed and 1× label stay at 1.');
    assert.equal(renderer.transitionDuration, VIEW_TRANSITION_DURATION_SECONDS / (preset === 'dotonbori' ? .75 : 1));
    const elapsedRatio = (performance.now() - renderer.transitionStartTime) / (renderer.transitionDuration * 1000);
    assert.ok(Math.abs(elapsedRatio - .5) < .02, 'Changing presets jumps within the active turn.');
  }
  renderer.setProgressImmediate(1);
  renderer.setTreeData({ city: { preset: 'dotonbori' } });
  assert.equal(renderer.currentProgress, 1);
  assert.equal(renderer.isTransitioning, false, 'A preset update preserves an immediate/reduced-motion endpoint.');
  renderer.targetProgress = 0;
  assert.equal(renderer.transitionDuration, VIEW_TRANSITION_DURATION_SECONDS / .75);
});

test('City shares 1× framing with only a bounded narrow-host clipping guard', () => {
  for (const [width, height] of [[1440, 900], [1059, 1273], [707, 1157], [390, 844], [320, 568], [480, 480], [600, 600]]) {
    const projection = resolveQRViewportProjection(width, height);
    assert.equal(projection.designDistance, 2.45 + .4 * projection.landscapeBlend);
    const fit = fitCityCameraDistance(projection.aspect, projection.verticalFov, Math.PI / 4 + CITY_CAMERA_YAW_OFFSET, -.71);
    assert.ok(fit <= projection.designDistance * 1.04, `${width}×${height}: City diverges from the standard 3D scale.`);
  }
  // The common 3D baseline stays stable across the portrait/square QR-density ramp.
  assert.equal(resolveQRViewportProjection(390, 844).designDistance,
    resolveQRViewportProjection(480, 480).designDistance);
});

test('Shibuya resolves all theme roles through its morning palette', () => {
  const swatches = new Set<string>(Object.values(SHIBUYA_PALETTE));
  assert.equal(SHIBUYA_PALETTE.blue, BLUE_MORNING_SWATCHES.blue);
  assert.equal(SHIBUYA_PALETTE.coolLight, BLUE_MORNING_SWATCHES.mist);
  const checkColors = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('#')) {
      assert.ok(swatches.has(value), `Off-palette City color: ${value}`);
    } else if (value && typeof value === 'object') Object.values(value).forEach(checkColors);
  };
  checkColors(DESIGN_QR_THEME_PRESETS.shibuya);
  checkColors(CITY_VEHICLES.flatMap(vehicle => vehicle.color));
});

test('City QR uses four contrasting inks on mist paper and keeps deep-blue finders', () => {
  const theme = DESIGN_QR_THEME_PRESETS.shibuya;
  const luminance = (color: Color) => .2126 * color.r + .7152 * color.g + .0722 * color.b;
  assert.equal(theme.groundColor, SHIBUYA_PALETTE.qrPaper);
  assert.equal(new Set(theme.qrFoliagePaletteColors).size, 4);
  assert.deepEqual(new Set(theme.qrFinderPaletteColors), new Set([BLUE_MORNING_SWATCHES.shadow]));
  const light = new Color(theme.groundColor);
  for (const source of [...theme.qrFoliagePaletteColors, ...theme.qrFinderPaletteColors]) {
    const dark = new Color(source);
    assert.ok((luminance(light) + .05) / (luminance(dark) + .05) > 4.5,
      `${source} becomes too pale on the scan face.`);
  }
  for (const value of ['Shibuya', 'https://example.com/shibuya', 'https://example.com/' + 'tokyo/'.repeat(32)]) {
    const matrix = generateQRMatrix(value, 'M').modules;
    const counts = new Map<string, number>();
    for (let row = 0; row < matrix.length; row++) for (let col = 0; col < matrix.length; col++) {
      if (!matrix[row][col]) continue;
      const ink = cityQRModuleColor(row, col, matrix.length, theme);
      assert.ok(theme.qrFoliagePaletteColors.includes(ink));
      if (isFinderPattern(row, col, matrix.length)) assert.equal(ink, BLUE_MORNING_SWATCHES.shadow);
      counts.set(ink, (counts.get(ink) ?? 0) + 1);
    }
    assert.equal(counts.size, 4, 'The settled artwork should retain all four ink roles at every density.');
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    assert.ok(counts.get(SHIBUYA_PALETTE.qrWarm)! / total < .08, 'Warm reflections should remain small accents.');
  }
});
