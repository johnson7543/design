import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeDesignQRConfig,
  encodeDesignQRConfig,
  normalizeDesignQRConfig,
  parseDesignQRConfig,
} from '../src/config/index.ts';
import type { ResolvedTreeTheme } from '../src/config/types.ts';
import {
  BLOCK_SIZE,
  QR_2D_DEPTH_FILTER,
  QR_2D_LIGHT_FILTER,
  QR_COMPACT_DISTANCE_SCALE_MAX,
  QR_SCAN_DESKTOP_DISTANCE,
  QR_SCAN_DESKTOP_VERTICAL_FOV,
  QR_SCAN_MOBILE_DISTANCE,
  QR_VISUAL_REFERENCE_GRID_SIZE,
  VIEW_TRANSITION_DURATION_SECONDS,
  VIEW_TRANSITION_SPEED_DEFAULT,
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
  getAutoRotateDelta,
  resolveQR2DLightDisplayRgb,
  resolveQRViewportProjection,
  resolveViewTransitionProgress,
} from '../src/designs/tree/constants.ts';
import {
  createTreeParticleOverrides,
  createTreeTheme,
  resolveTreeFoliageMorph,
  resolveTreeQRDarkModuleRole,
  resolveTreeTheme,
  TREE_THEME_PRESETS,
} from '../src/designs/tree/themes.ts';
import { resolveQRErrorCorrectionLevel } from '../src/designs/tree/qr.ts';

test('uses the configured transition duration at 1x', () => {
  assert.equal(VIEW_TRANSITION_SPEED_DEFAULT, 1);
  assert.equal(VIEW_TRANSITION_DURATION_SECONDS, 5 / 9);
});

test('starts view transitions on the first frame and settles smoothly', () => {
  assert.equal(resolveViewTransitionProgress(-1), 0);
  assert.equal(resolveViewTransitionProgress(0), 0);
  assert.equal(resolveViewTransitionProgress(1), 1);
  assert.equal(resolveViewTransitionProgress(2), 1);

  const nominalFrameRatio = (1 / 60) / VIEW_TRANSITION_DURATION_SECONDS;
  const firstFrameProgress = resolveViewTransitionProgress(nominalFrameRatio);
  const finalFrameRemaining = 1 - resolveViewTransitionProgress(1 - nominalFrameRatio);

  assert.ok(firstFrameProgress > 0.01);
  assert.ok(finalFrameRemaining < firstFrameProgress);

  let previous = 0;
  for (let step = 1; step <= 100; step += 1) {
    const progress = resolveViewTransitionProgress(step / 100);
    assert.ok(progress > previous);
    previous = progress;
  }
});

test('keeps one shared depth filter for settled 2D dark modules', () => {
  assert.equal(Object.isFrozen(QR_2D_DEPTH_FILTER), true);
  assert.deepEqual(QR_2D_DEPTH_FILTER, {
    saturationScale: 1.12,
    lightnessScale: 0.874,
  });
});

test('derives the shared 2D light lift from each theme ground color', () => {
  assert.equal(Object.isFrozen(QR_2D_LIGHT_FILTER), true);
  const liftedSpring = resolveQR2DLightDisplayRgb(TREE_THEME_PRESETS.spring.groundColor)
    .map((channel) => Math.round(channel * 255));
  const liftedSummer = resolveQR2DLightDisplayRgb(TREE_THEME_PRESETS.summer.groundColor)
    .map((channel) => Math.round(channel * 255));

  assert.deepEqual(liftedSpring, [249, 232, 223]);
  assert.deepEqual(liftedSummer, [251, 250, 237]);
  assert.notDeepEqual(liftedSpring, liftedSummer);
});

test('scales intermediate portraits and crosses orientation continuously', () => {
  const mobile = resolveQRViewportProjection(390, 844);
  const narrowDesktop = resolveQRViewportProjection(900, 1_217);
  const tabletPortrait = resolveQRViewportProjection(1_022, 1_217);
  const tallDesktop = resolveQRViewportProjection(1_190, 1_217);
  const square = resolveQRViewportProjection(1_217, 1_217);
  const justLandscape = resolveQRViewportProjection(1_218, 1_217);
  const landscape = resolveQRViewportProjection(1_440, 900);

  assert.equal(mobile.compactDistanceScale, 1);
  assert.equal(mobile.landscapeBlend, 0);
  assert.equal(mobile.scanDistance, QR_SCAN_MOBILE_DISTANCE);
  assert.ok(narrowDesktop.compactDistanceScale > 1);
  assert.ok(tabletPortrait.compactDistanceScale > 1.3);
  assert.equal(
    tallDesktop.compactDistanceScale,
    QR_COMPACT_DISTANCE_SCALE_MAX
  );

  const projectedQrPixelSize = (
    height: number,
    projection: ReturnType<typeof resolveQRViewportProjection>
  ) => (
    height
    * QR_VISUAL_REFERENCE_GRID_SIZE
    * BLOCK_SIZE
    / (2 * projection.scanDistance
      * Math.tan((projection.verticalFov * Math.PI) / 360))
  );
  const narrowDesktopQrSize = projectedQrPixelSize(1_217, narrowDesktop);
  const tabletPortraitQrSize = projectedQrPixelSize(1_217, tabletPortrait);
  const tallDesktopQrSize = projectedQrPixelSize(1_217, tallDesktop);
  assert.ok(
    tabletPortraitQrSize < narrowDesktopQrSize,
    'the intermediate portrait should reduce before growing toward square'
  );
  assert.ok(tallDesktopQrSize > tabletPortraitQrSize);

  assert.equal(square.landscapeBlend, 0);
  assert.ok(justLandscape.landscapeBlend > 0);
  assert.ok(justLandscape.landscapeBlend < 0.001);
  assert.ok(
    Math.abs(
      projectedQrPixelSize(1_217, square)
      - projectedQrPixelSize(1_217, justLandscape)
    ) < 2,
    'crossing square must not produce a visible size jump'
  );

  assert.equal(landscape.landscapeBlend, 1);
  assert.equal(landscape.scanDistance, QR_SCAN_DESKTOP_DISTANCE);
  assert.equal(landscape.verticalFov, QR_SCAN_DESKTOP_VERTICAL_FOV);
});

test('normalizes defaults into the canonical v1 shape', () => {
  const config = normalizeDesignQRConfig({ value: 'https://example.com' });

  assert.deepEqual(config, {
    schemaVersion: 1,
    value: 'https://example.com',
    design: {
      type: 'tree',
      options: { shape: 'dome', seed: 0.5 },
    },
    theme: { type: 'preset', preset: 'spring' },
    view: { initial: 'design' },
    details: { title: '', showValue: false, border: false },
    interaction: {
      dragToRotate: true,
      tapToToggleView: true,
      autoRotate: false,
      autoRotateDirection: 'clockwise',
      transitionSpeed: 1,
      motionBlur: true,
    },
    logo: false,
  });
  assert.equal(config.transparentBackground ?? false, false);
  assert.equal('transparentBackground' in config, false);
});

test('normalizes transparent backgrounds as a sparse backward-compatible v1 field', () => {
  const enabled = normalizeDesignQRConfig({
    value: 'https://example.com/transparent',
    transparentBackground: true,
  });
  assert.equal(enabled.schemaVersion, 1);
  assert.equal(enabled.transparentBackground, true);

  const disabled = normalizeDesignQRConfig({
    value: 'https://example.com/opaque',
    transparentBackground: false,
  });
  assert.equal('transparentBackground' in disabled, false);

  const invalid = normalizeDesignQRConfig({
    value: 'https://example.com/invalid-transparency',
    transparentBackground: 'true',
  });
  assert.equal('transparentBackground' in invalid, false);

  const previousV1 = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com/previous-v1',
  });
  assert.equal(previousV1.ok, true);
  if (previousV1.ok) {
    assert.equal(previousV1.value.transparentBackground ?? false, false);
  }
});

test('normalizes safe raster logos and selects high QR error correction', () => {
  const config = normalizeDesignQRConfig({
    value: 'https://example.com/branded',
    logo: {
      src: 'data:image/png;base64,iVBORw0KGgo=',
      alt: `  ${'Brand '.repeat(20)}  `,
      size: 0.5,
    },
  });

  assert.notEqual(config.logo, false);
  if (config.logo !== false) {
    assert.equal(config.logo.src, 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(config.logo.alt.length, 80);
    assert.equal(config.logo.size, 0.2);
  }
  assert.equal(resolveQRErrorCorrectionLevel(config.logo !== false), 'H');
  assert.equal(resolveQRErrorCorrectionLevel(false), 'M');

  const minimum = normalizeDesignQRConfig({
    value: 'https://example.com/minimum-logo',
    logo: { src: '/brand.webp', size: 0.01 },
  });
  assert.notEqual(minimum.logo, false);
  if (minimum.logo !== false) assert.equal(minimum.logo.size, 0.08);

  for (const source of [
    '/logo.webp',
    './assets/logo.png',
    '/assets/logo.a1b2c3.jpg',
    'https://cdn.example.com/logo.webp',
  ]) {
    const withPath = normalizeDesignQRConfig({
      value: 'https://example.com/logo-path',
      logo: { src: source },
    });
    assert.notEqual(withPath.logo, false);
    if (withPath.logo !== false) assert.equal(withPath.logo.src, source);
  }
});

test('rejects unsafe or unsupported logo sources', () => {
  for (const source of [
    'http://example.com/logo.png',
    '//example.com/logo.png',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  ]) {
    const result = parseDesignQRConfig({
      schemaVersion: 1,
      value: 'https://example.com/logo-source',
      logo: { src: source },
    });
    assert.equal(result.ok, false, source);
  }
});

test('normalizes and applies stable automatic rotation directions', () => {
  const counterclockwise = normalizeDesignQRConfig({
    value: 'https://example.com/counterclockwise',
    interaction: { autoRotate: true, autoRotateDirection: 'counterclockwise' },
  });
  assert.equal(counterclockwise.interaction.autoRotateDirection, 'counterclockwise');
  assert.equal(getAutoRotateDelta('clockwise', 0.5), 0.15);
  assert.equal(getAutoRotateDelta('counterclockwise', 0.5), -0.15);

  const invalid = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com/invalid-direction',
    interaction: { autoRotateDirection: 'sideways' },
  });
  assert.equal(invalid.ok, false);
  assert.throws(
    () => createTreeTheme('spring', { groundFeature: 'unsupported' as never }),
    /theme\.groundFeature must be grass, pixel, or none/
  );
});

test('normalizes the public view transition speed', () => {
  const configured = normalizeDesignQRConfig({
    value: 'https://example.com/transition-speed',
    interaction: { transitionSpeed: 1.75 },
  });
  assert.equal(configured.interaction.transitionSpeed, 1.75);

  const belowRange = normalizeDesignQRConfig({
    value: 'https://example.com/slow-transition',
    interaction: { transitionSpeed: -1 },
  });
  assert.equal(belowRange.interaction.transitionSpeed, VIEW_TRANSITION_SPEED_MIN);

  const aboveRange = normalizeDesignQRConfig({
    value: 'https://example.com/fast-transition',
    interaction: { transitionSpeed: 20 },
  });
  assert.equal(aboveRange.interaction.transitionSpeed, VIEW_TRANSITION_SPEED_MAX);

  const invalid = normalizeDesignQRConfig({
    value: 'https://example.com/default-transition',
    interaction: { transitionSpeed: Number.NaN },
  });
  assert.equal(invalid.interaction.transitionSpeed, VIEW_TRANSITION_SPEED_DEFAULT);
});

test('normalizes custom themes and strips editor-only fields', () => {
  const config = normalizeDesignQRConfig({
    value: 'https://example.com',
    design: { type: 'tree', options: { shape: 'wide', seed: 8 } },
    theme: {
      type: 'custom',
      value: {
        id: 'editor-id',
        label: 'Editor label',
        isCustom: true,
        treeShape: 'pine',
        foliageColor: '#fff',
        foliageShadowColor: '#98596e',
        groundColor: '#fff',
        skyTop: '#fef6e9',
        skyBottom: '#F0CCBD',
        canopyDensity: 60,
        particleType: 'sakura',
        particleAmount: 500,
        groundLeavesAmount: -10,
      },
    },
    details: {
      title: 'x'.repeat(50),
      showValue: true,
      border: { padding: 29 },
    },
  });

  assert.deepEqual(config.design.options, { shape: 'wide', seed: 1 });
  assert.equal(config.details.title.length, 40);
  assert.deepEqual(config.details.border, { padding: 28 });
  assert.equal(config.theme.type, 'custom');
  if (config.theme.type === 'custom') {
    assert.deepEqual(config.theme.value, {
      foliageColor: '#FFFFFF',
      foliageShadowColor: '#98596E',
      groundColor: '#FFFFFF',
      skyTop: '#FEF6E9',
      skyBottom: '#F0CCBD',
      canopyDensity: 60,
      particleType: 'sakura',
      particleAmount: 60,
      groundLeavesAmount: 0,
    });
    assert.equal('id' in config.theme.value, false);
    assert.equal('treeShape' in config.theme.value, false);
  }
});

test('exports complete immutable presets without sharing mutable copies', () => {
  assert.equal(Object.isFrozen(TREE_THEME_PRESETS), true);
  assert.equal(Object.isFrozen(TREE_THEME_PRESETS.spring), true);
  assert.equal(Object.isFrozen(TREE_THEME_PRESETS.spring.foliagePaletteColors), true);
  assert.equal(Object.isFrozen(TREE_THEME_PRESETS.spring.qrFoliagePaletteStops), true);
  assert.equal(TREE_THEME_PRESETS.summer.weatherType, 'rain');
  assert.equal(TREE_THEME_PRESETS.winter.snowflakeAmount, 300);
  assert.equal(TREE_THEME_PRESETS.winter.groundFeature, 'pixel');
  assert.equal(TREE_THEME_PRESETS.spring.groundLeavesSeed, 0);
  assert.equal(TREE_THEME_PRESETS.autumn.groundLeavesSeed, 2);
  assert.equal(TREE_THEME_PRESETS.autumn.qrFinderEyeColor, '#5D4C35');
  assert.deepEqual(
    TREE_THEME_PRESETS.spring.foliagePaletteColors,
    ['#D98EAF', '#F4B4CF', '#F8D2E3', '#FCEEF5', '#FCEEF5']
  );
  assert.deepEqual(TREE_THEME_PRESETS.spring.foliagePaletteStops, [0.35, 0.7, 0.92, 1]);
  assert.deepEqual(
    TREE_THEME_PRESETS.summer.groundFeaturePaletteStartColors,
    ['#1F9E24', '#6BE01F', '#F0D133', '#0F6114']
  );
  assert.deepEqual(
    TREE_THEME_PRESETS.autumn.qrFoliagePaletteColors,
    ['#8C2016', '#BD3528', '#E2451E', '#E77433']
  );
  assert.deepEqual(
    TREE_THEME_PRESETS.winter.foliagePaletteColors,
    ['#6185A6', '#8CADD1', '#BDD6F0', '#F5FAFF', '#A6D6E6']
  );
  assert.equal(TREE_THEME_PRESETS.spring.branchColor, '#956F50');
  assert.equal(TREE_THEME_PRESETS.winter.branchColor, '#908176');
  assert.equal(TREE_THEME_PRESETS.spring.groundSurfaceColor, '#EBDBD3');
  assert.equal(TREE_THEME_PRESETS.winter.groundSurfaceShadowColor, '#BFBFBC');

  const custom = createTreeTheme('spring', {
    foliageColor: '#02983B',
    foliageShape: 'pixel',
  });
  assert.equal(custom.foliageColor, '#02983B');
  assert.equal(custom.foliageShape, 'pixel');
  assert.equal(custom.weatherType, 'none');
  assert.equal(custom.foliagePaletteColors[1], '#02983B');
  assert.notEqual(custom.foliagePaletteColors, TREE_THEME_PRESETS.spring.foliagePaletteColors);
  assert.equal(TREE_THEME_PRESETS.spring.foliageColor, '#F4B4CF');
});

test('matches Add Theme dependency cascades for simple source-role overrides', () => {
  const foliage = createTreeTheme('spring', {
    foliageColor: '#02983B',
    foliageHighlightColor: '#99CC81',
    foliageShadowColor: '#00785E',
    foliageMidtoneColor: '#00AC7A',
  });
  assert.deepEqual(
    foliage.foliagePaletteColors,
    ['#00785E', '#02983B', '#00AC7A', '#99CC81', '#99CC81']
  );
  assert.deepEqual(
    foliage.qrFoliagePaletteColors,
    ['#00785E', '#02983B', '#00AC7A', '#99CC81']
  );
  assert.equal(foliage.qrFoliageColor, '#02983B');
  assert.equal(foliage.titleColor, '#00785E');

  const ground = createTreeTheme('spring', {
    groundColor: '#F6F4D7',
    groundShadowColor: '#6B9277',
  });
  assert.equal(ground.groundSurfaceColor, '#F6F4D7');
  assert.equal(ground.groundSurfaceShadowColor, '#6B9277');
  assert.equal(ground.pedestalColor, '#6B9277');

  const groundFeature = createTreeTheme('spring', {
    groundFeatureColor: '#99CC81',
    groundFeatureHighlightColor: '#D7DE8A',
    groundFeatureShadowColor: '#02983B',
  });
  assert.deepEqual(
    groundFeature.groundFeaturePaletteStartColors,
    ['#02983B', '#99CC81', '#D7DE8A', '#D7DE8A']
  );
  assert.deepEqual(
    groundFeature.qrFinderPaletteColors,
    ['#02983B', '#99CC81', '#D7DE8A', '#D7DE8A']
  );
  assert.equal(groundFeature.qrFinderEyeColor, '#02983B');
});

test('composes Add Theme particle choices into complete renderer roles', () => {
  assert.deepEqual(createTreeParticleOverrides('fireflies', 18), {
    particleType: 'fireflies',
    particleAmount: 18,
    groundLeavesAmount: 0,
    weatherType: 'none',
    weatherAmount: 0,
    ambientParticleType: 'fireflies',
    ambientParticleAmount: 18,
    snowflakeAmount: 0,
  });
  assert.deepEqual(createTreeParticleOverrides('snow', 40), {
    particleType: 'snow',
    particleAmount: 40,
    groundLeavesAmount: 0,
    weatherType: 'none',
    weatherAmount: 0,
    ambientParticleType: 'none',
    ambientParticleAmount: 0,
    snowflakeAmount: 200,
  });

  const snow = createTreeTheme('spring', { particleType: 'snow' });
  assert.equal(snow.particleAmount, 16);
  assert.equal(snow.snowflakeAmount, 80);
  assert.equal(snow.ambientParticleAmount, 0);
  assert.equal(snow.weatherAmount, 0);

  const lighterSnow = createTreeTheme('winter', { particleAmount: 20 });
  assert.equal(lighterSnow.particleType, 'snow');
  assert.equal(lighterSnow.particleAmount, 20);
  assert.equal(lighterSnow.snowflakeAmount, 100);

  const fewerLeaves = createTreeTheme('autumn', { particleAmount: 20 });
  assert.equal(fewerLeaves.particleType, 'leaf');
  assert.equal(fewerLeaves.groundLeavesAmount, 17);

  const clean = createTreeTheme('winter', {
    particleType: 'none',
    particleAmount: 40,
  });
  assert.equal(clean.particleAmount, 0);
  assert.equal(clean.groundLeavesAmount, 0);
  assert.equal(clean.snowflakeAmount, 0);
  assert.equal(clean.ambientParticleAmount, 0);
});

test('uses one meaningful intensity policy for every preset particle transition', () => {
  const expectedIntensity = {
    spring: 16,
    summer: undefined,
    autumn: 60,
    winter: 60,
  } as const;

  for (const preset of ['spring', 'summer', 'autumn', 'winter'] as const) {
    for (const particleType of ['sakura', 'leaf', 'fireflies', 'snow'] as const) {
      const expected = createTreeParticleOverrides(
        particleType,
        expectedIntensity[preset]
      );
      const actual = createTreeTheme(preset, { particleType });
      for (const [role, value] of Object.entries(expected)) {
        assert.deepEqual(
          actual[role as keyof ResolvedTreeTheme],
          value,
          `${preset} -> ${particleType}: ${role}`
        );
      }
    }
  }
});

test('ignores explicit undefined helper overrides and preserves independent copies', () => {
  const custom = createTreeTheme('winter', {
    foliagePaletteColors: undefined,
    groundFeature: undefined,
    groundLeavesSeed: undefined,
  });
  assert.deepEqual(custom, TREE_THEME_PRESETS.winter);
  assert.notEqual(custom.foliagePaletteColors, TREE_THEME_PRESETS.winter.foliagePaletteColors);
  assert.notEqual(
    custom.groundFeaturePaletteStartColors,
    TREE_THEME_PRESETS.winter.groundFeaturePaletteStartColors
  );
});

test('resolves partial custom themes from their own visual roles', () => {
  const theme = resolveTreeTheme({
    type: 'custom',
    value: {
      foliageColor: '#02983B',
      groundColor: '#F6F4D7',
      skyTop: '#F6F4D7',
      skyBottom: '#D7DE8A',
      particleType: 'fireflies',
      particleAmount: 8,
    },
  });

  assert.equal(theme.foliageHighlightColor, '#02983B');
  assert.equal(theme.qrFoliageShadowColor, '#02983B');
  assert.equal(theme.groundSurfaceColor, theme.groundColor);
  assert.equal(theme.groundSurfaceShadowColor, theme.groundShadowColor);
  assert.deepEqual(
    theme.foliagePaletteColors,
    ['#02983B', '#02983B', '#02983B', '#02983B', '#02983B']
  );
  assert.deepEqual(theme.qrFoliagePaletteStops, [0.22, 0.52, 0.8]);
  assert.equal(theme.ambientParticleType, 'fireflies');
  assert.equal(theme.ambientParticleAmount, 8);
  assert.equal(theme.titleColor, '#02983B');
});

test('removes distinct ground-decor styling from the 2D QR when none is selected', () => {
  assert.equal(resolveTreeQRDarkModuleRole('grass', true), 'finder');
  assert.equal(resolveTreeQRDarkModuleRole('pixel', true), 'finder');
  assert.equal(resolveTreeQRDarkModuleRole('none', true), 'foliage');
  assert.equal(resolveTreeQRDarkModuleRole('none', false), 'foliage');
});

test('reproduces every seasonal preset through a custom theme setup', () => {
  for (const preset of ['spring', 'summer', 'autumn', 'winter'] as const) {
    const normalized = normalizeDesignQRConfig({
      value: `https://example.com/custom-${preset}`,
      theme: createTreeTheme(preset),
    });

    assert.equal(normalized.theme.type, 'custom');
    assert.deepEqual(
      resolveTreeTheme(normalized.theme),
      TREE_THEME_PRESETS[preset],
      preset
    );
  }
});

test('normalizes every complete theme role and rejects invalid role values', () => {
  const complete = normalizeDesignQRConfig({
    value: 'https://example.com/complete-theme',
    theme: createTreeTheme('winter', {
      foliageShape: 'pixel',
      weatherType: 'rain',
      weatherAmount: 999,
      ambientParticleType: 'fireflies',
      ambientParticleAmount: 999,
      snowflakeAmount: 999,
    }),
  });
  assert.equal(complete.theme.type, 'custom');
  if (complete.theme.type === 'custom') {
    assert.equal(complete.theme.value.foliageShape, 'pixel');
    assert.equal(complete.theme.value.weatherAmount, 300);
    assert.equal(complete.theme.value.ambientParticleAmount, 60);
    assert.equal(complete.theme.value.snowflakeAmount, 500);
    assert.equal(complete.theme.value.branchColor, '#908176');
    assert.equal(complete.theme.value.groundLeavesSeed, 3);
    assert.equal(complete.theme.value.qrFoliageColor, '#7DA3C4');
    assert.deepEqual(
      complete.theme.value.foliagePaletteColors,
      ['#6185A6', '#8CADD1', '#BDD6F0', '#F5FAFF', '#A6D6E6']
    );
  }

  const invalid = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com/invalid-theme-role',
    theme: {
      type: 'custom',
      value: {
        foliageColor: '#02983B',
        foliageShape: 'triangles',
        groundColor: '#F6F4D7',
        skyTop: '#F6F4D7',
        skyBottom: '#D7DE8A',
        particleType: 'none',
      },
    },
  });
  assert.equal(invalid.ok, false);
});

test('normalizes renderer palette controls and rejects malformed distributions', () => {
  const config = normalizeDesignQRConfig({
    value: 'https://example.com/palette-controls',
    theme: {
      foliageColor: '#02983B',
      foliagePaletteColors: ['#00785E', '#02983B', '#00AC7A', '#99CC81', '#D7DE8A'],
      foliagePaletteStops: [0.2, 0.5, 0.8, 0.95],
      foliageColorVariation: 0.2,
      foliageVerticalLift: -0.2,
      qrFoliagePaletteColors: ['#005A46', '#00785E', '#02983B', '#00AC7A'],
      qrFoliagePaletteStops: [0.2, 0.55, 0.85],
      groundColor: '#F6F4D7',
      groundFeaturePaletteStartColors: ['#1F9E24', '#6BE01F', '#F0D133', '#0F6114'],
      groundFeaturePaletteEndColors: ['#33C224', '#99F51F', '#F0EB59', '#0F6114'],
      groundFeaturePaletteStops: [0.4, 0.7, 0.88],
      groundFeaturePaletteVariations: [0, 0.01, 0.02, 0.2],
      qrFinderPaletteColors: ['#6B9277', '#99CC81', '#D7DE8A', '#D7DE8A'],
      qrFinderPaletteStops: [0.35, 0.75, 1],
      qrFinderColorVariation: 0.2,
      skyTop: '#F6F4D7',
      skyBottom: '#D7DE8A',
      particleType: 'none',
    },
  });

  assert.equal(config.theme.type, 'custom');
  if (config.theme.type === 'custom') {
    assert.deepEqual(config.theme.value.foliagePaletteStops, [0.2, 0.5, 0.8, 0.95]);
    assert.equal(config.theme.value.foliageColorVariation, 0.1);
    assert.equal(config.theme.value.foliageVerticalLift, -0.1);
    assert.deepEqual(config.theme.value.groundFeaturePaletteVariations, [0, 0.01, 0.02, 0.1]);
    assert.equal(config.theme.value.qrFinderColorVariation, 0.1);
  }

  for (const malformedTheme of [
    {
      foliagePaletteColors: ['#00785E', '#02983B'],
    },
    {
      foliagePaletteStops: [0.2, 0.8, 0.5, 1],
    },
    {
      qrFinderPaletteStops: [0.35, 0.35, 1],
    },
  ]) {
    const result = parseDesignQRConfig({
      schemaVersion: 1,
      value: 'https://example.com/invalid-palette',
      theme: {
        foliageColor: '#02983B',
        groundColor: '#F6F4D7',
        skyTop: '#F6F4D7',
        skyBottom: '#D7DE8A',
        particleType: 'none',
        ...malformedTheme,
      },
    });
    assert.equal(result.ok, false);
  }
});

test('resolves the canopy and QR morph schedule', () => {
  assert.deepEqual(resolveTreeFoliageMorph(0), {
    organicVisible: true,
    voxelVisible: false,
    voxelScale: 0,
  });
  assert.deepEqual(resolveTreeFoliageMorph(1), {
    organicVisible: false,
    voxelVisible: false,
    voxelScale: 1,
  });
  assert.equal(resolveTreeFoliageMorph(0.5).organicVisible, true);
  assert.equal(resolveTreeFoliageMorph(0.5).voxelVisible, true);
});

test('returns typed errors for unsafe or unsupported input', () => {
  const missingSchema = parseDesignQRConfig({ value: 'https://example.com' });
  assert.equal(missingSchema.ok, false);

  const unsupported = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com',
    design: { type: 'unknown' },
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.error.code, 'UNSUPPORTED_DESIGN');

  const invalidColor = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com',
    theme: {
      type: 'custom',
      value: {
        foliageColor: 'red',
        groundColor: '#fff',
        skyTop: '#fff',
        skyBottom: '#fff',
        particleType: 'none',
      },
    },
  });
  assert.equal(invalidColor.ok, false);

  const maximumValue = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'a'.repeat(2_048),
  });
  assert.equal(maximumValue.ok, true);

  const oversizedValue = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'a'.repeat(2_049),
  });
  assert.equal(oversizedValue.ok, false);
  if (!oversizedValue.ok) {
    assert.equal(oversizedValue.error.code, 'INVALID_CONFIG');
  }
});

test('round-trips UTF-8 canonical configuration with base64url', () => {
  const encoded = encodeDesignQRConfig({
    value: 'https://example.com/春天',
    theme: 'winter',
    view: 'qr',
    details: { title: '春の QR', showValue: true },
    interaction: { transitionSpeed: 1.75 },
    logo: {
      src: '/assets/brand.png',
      alt: '春のブランド',
      size: 0.14,
    },
    transparentBackground: true,
  });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);

  const decoded = decodeDesignQRConfig(encoded);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.value, 'https://example.com/春天');
    assert.deepEqual(decoded.value.theme, { type: 'preset', preset: 'winter' });
    assert.equal(decoded.value.view.initial, 'qr');
    assert.equal(decoded.value.interaction.transitionSpeed, 1.75);
    assert.deepEqual(decoded.value.logo, {
      src: '/assets/brand.png',
      alt: '春のブランド',
      size: 0.14,
    });
    assert.equal(decoded.value.transparentBackground, true);
  }
});

test('omits disabled transparent backgrounds from canonical encoding', () => {
  const encoded = encodeDesignQRConfig({
    value: 'https://example.com/opaque-encoding',
    transparentBackground: false,
  });
  const canonical = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
    transparentBackground?: boolean;
  };

  assert.equal('transparentBackground' in canonical, false);
});

test('refuses to create canonical links that its decoder would reject', () => {
  assert.throws(
    () => encodeDesignQRConfig({
      value: 'v'.repeat(2_048),
      theme: createTreeTheme('spring'),
      details: { title: '🌳'.repeat(40), showValue: true, border: { padding: 32 } },
      logo: {
        src: `data:image/webp;base64,${'A'.repeat(8_168)}`,
        alt: '🌸'.repeat(80),
        size: 0.16,
      },
    }),
    /too large to share/
  );
});

test('rejects encoded current-schema configurations with unknown top-level fields', () => {
  const encoded = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    value: 'https://example.com/unknown-field',
    unsupported: true,
  })).toString('base64url');
  const decoded = decodeDesignQRConfig(encoded);

  assert.equal(decoded.ok, false);
});
