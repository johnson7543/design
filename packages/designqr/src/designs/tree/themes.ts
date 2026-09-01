import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRThemePreset,
  type ResolvedTreeTheme,
  type TreeGroundFeature,
  type TreePaletteColors4,
  type TreePaletteColors5,
  type TreePaletteStops3,
  type TreePaletteStops4,
  type TreePaletteVariations4,
  type TreeTheme,
} from '../../config/types.ts';

const SHARED_NATURAL_BRANCH = {
  branchColor: '#956F50',
  branchHighlightColor: '#B18B69',
  branchShadowColor: '#795538',
  branchTipColor: '#C2A27C',
  branchStyle: 'natural',
} as const;

const DEFAULT_FOLIAGE_STOPS = Object.freeze([0.22, 0.55, 0.82, 1]) as TreePaletteStops4;
const DEFAULT_QR_STOPS = Object.freeze([0.22, 0.52, 0.8]) as TreePaletteStops3;
const DEFAULT_FEATURE_STOPS = Object.freeze([0.35, 0.75, 1]) as TreePaletteStops3;

function colors4(...colors: [string, string, string, string]): TreePaletteColors4 {
  return Object.freeze(colors);
}

function colors5(
  ...colors: [string, string, string, string, string]
): TreePaletteColors5 {
  return Object.freeze(colors);
}

function stops3(...stops: [number, number, number]): TreePaletteStops3 {
  return Object.freeze(stops);
}

function stops4(...stops: [number, number, number, number]): TreePaletteStops4 {
  return Object.freeze(stops);
}

function variations4(
  ...variations: [number, number, number, number]
): TreePaletteVariations4 {
  return Object.freeze(variations);
}

const SPRING_THEME = Object.freeze({
  foliageColor: '#F4B4CF',
  foliageHighlightColor: '#FCEEF5',
  foliageShadowColor: '#D98EAF',
  foliageMidtoneColor: '#F8D2E3',
  foliageShape: 'blossom',
  foliagePaletteColors: colors5(
    '#D98EAF', '#F4B4CF', '#F8D2E3', '#FCEEF5', '#FCEEF5'
  ),
  foliagePaletteStops: stops4(0.35, 0.7, 0.92, 1),
  foliageColorVariation: 0.00525,
  foliageVerticalLift: 0,
  qrFoliageColor: '#D98EAF',
  qrFoliageHighlightColor: '#F8D2E3',
  qrFoliageShadowColor: '#98596E',
  qrFoliageMidtoneColor: '#F4B4CF',
  qrFoliagePaletteColors: colors4('#8C3D59', '#A84D66', '#BD577A', '#D1668A'),
  qrFoliagePaletteStops: stops3(0.22, 0.48, 0.78),
  qrFoliageColorVariation: 0.03,
  blossomCenterColor: '#F7E95E',
  ...SHARED_NATURAL_BRANCH,
  groundColor: '#F1CDBD',
  groundShadowColor: '#C38F95',
  groundSurfaceColor: '#EBDBD3',
  groundSurfaceShadowColor: '#CFB5B9',
  groundSurfaceVariation: 0.016,
  groundSurfaceShadowVariation: 0.04,
  pedestalColor: '#A99FA3',
  groundFeature: 'grass',
  groundFeatureColor: '#85B667',
  groundFeatureHighlightColor: '#BFD47B',
  groundFeatureShadowColor: '#286018',
  groundFeaturePaletteStartColors: colors4(
    '#85B667', '#BFD47B', '#F7E95E', '#D0D3E2'
  ),
  groundFeaturePaletteEndColors: colors4(
    '#85B667', '#BFD47B', '#F7E95E', '#D0D3E2'
  ),
  groundFeaturePaletteStops: stops3(0.42, 0.72, 0.88),
  groundFeaturePaletteVariations: variations4(0.04, 0.04, 0, 0),
  qrFinderColor: '#85B667',
  qrFinderHighlightColor: '#BFD47B',
  qrFinderShadowColor: '#286018',
  qrFinderEyeColor: '#337A24',
  qrFinderPaletteColors: colors4('#428A2E', '#619E38', '#478F2E', '#94A32E'),
  qrFinderPaletteStops: stops3(0.35, 0.75, 0.9),
  qrFinderColorVariation: 0.0035,
  skyTop: '#F6E2D5',
  skyBottom: '#F0CCBD',
  titleColor: '#98596E',
  canopyDensity: 100,
  particleType: 'sakura',
  particleAmount: 16,
  groundLeavesAmount: 44,
  groundLeavesSeed: 0,
  weatherType: 'none',
  weatherAmount: 0,
  weatherColor: '#A3CAE8',
  ambientParticleType: 'none',
  ambientParticleAmount: 0,
  ambientParticleColor: '#FFEA44',
  snowflakeAmount: 0,
  snowflakeColor: '#F4F8FC',
} as const satisfies ResolvedTreeTheme);

const SUMMER_THEME = Object.freeze({
  foliageColor: '#02983B',
  foliageHighlightColor: '#99CC81',
  foliageShadowColor: '#00785E',
  foliageMidtoneColor: '#00AC7A',
  foliageShape: 'leaf',
  foliagePaletteColors: colors5(
    '#00785E', '#02983B', '#00AC7A', '#99CC81', '#99CC81'
  ),
  foliagePaletteStops: stops4(0.28, 0.65, 0.86, 1),
  foliageColorVariation: 0.0028,
  foliageVerticalLift: 0,
  qrFoliageColor: '#00785E',
  qrFoliageHighlightColor: '#00AC7A',
  qrFoliageShadowColor: '#00785E',
  qrFoliageMidtoneColor: '#02983B',
  qrFoliagePaletteColors: colors4('#005A46', '#00785E', '#02983B', '#00AC7A'),
  qrFoliagePaletteStops: DEFAULT_QR_STOPS,
  qrFoliageColorVariation: 0.03,
  blossomCenterColor: '#F7E95E',
  ...SHARED_NATURAL_BRANCH,
  groundColor: '#F6F4D7',
  groundShadowColor: '#6B9277',
  groundSurfaceColor: '#BEC7B5',
  groundSurfaceShadowColor: '#A2BAA9',
  groundSurfaceVariation: 0.016,
  groundSurfaceShadowVariation: 0.04,
  pedestalColor: '#B1B1B8',
  groundFeature: 'grass',
  groundFeatureColor: '#99CC81',
  groundFeatureHighlightColor: '#D7DE8A',
  groundFeatureShadowColor: '#02983B',
  groundFeaturePaletteStartColors: colors4(
    '#1F9E24', '#6BE01F', '#F0D133', '#0F6114'
  ),
  groundFeaturePaletteEndColors: colors4(
    '#33C224', '#99F51F', '#F0EB59', '#0F6114'
  ),
  groundFeaturePaletteStops: stops3(0.4, 0.7, 0.88),
  groundFeaturePaletteVariations: variations4(0, 0, 0, 0),
  qrFinderColor: '#99CC81',
  qrFinderHighlightColor: '#D7DE8A',
  qrFinderShadowColor: '#6B9277',
  qrFinderEyeColor: '#02983B',
  qrFinderPaletteColors: colors4('#6B9277', '#99CC81', '#D7DE8A', '#D7DE8A'),
  qrFinderPaletteStops: DEFAULT_FEATURE_STOPS,
  qrFinderColorVariation: 0.0035,
  skyTop: '#F6F4D7',
  skyBottom: '#D7DE8A',
  titleColor: '#00785E',
  canopyDensity: 100,
  particleType: 'none',
  particleAmount: 0,
  groundLeavesAmount: 16,
  groundLeavesSeed: 1,
  weatherType: 'rain',
  weatherAmount: 180,
  weatherColor: '#A3CAE8',
  ambientParticleType: 'butterflies',
  ambientParticleAmount: 6,
  ambientParticleColor: '#88EEFF',
  snowflakeAmount: 0,
  snowflakeColor: '#F4F8FC',
} as const satisfies ResolvedTreeTheme);

const AUTUMN_THEME = Object.freeze({
  foliageColor: '#E2451E',
  foliageHighlightColor: '#F4A358',
  foliageShadowColor: '#BD3528',
  foliageMidtoneColor: '#E77433',
  foliageShape: 'leaf',
  foliagePaletteColors: colors5(
    '#BD3528', '#E2451E', '#E77433', '#F4A358', '#F4A358'
  ),
  foliagePaletteStops: DEFAULT_FOLIAGE_STOPS,
  foliageColorVariation: 0.00525,
  foliageVerticalLift: 0,
  qrFoliageColor: '#E2451E',
  qrFoliageHighlightColor: '#E77433',
  qrFoliageShadowColor: '#BD3528',
  qrFoliageMidtoneColor: '#E2451E',
  qrFoliagePaletteColors: colors4('#8C2016', '#BD3528', '#E2451E', '#E77433'),
  qrFoliagePaletteStops: DEFAULT_QR_STOPS,
  qrFoliageColorVariation: 0.03,
  blossomCenterColor: '#F7E95E',
  ...SHARED_NATURAL_BRANCH,
  groundColor: '#F8F0EC',
  groundShadowColor: '#9D8C73',
  groundSurfaceColor: '#DACEBC',
  groundSurfaceShadowColor: '#BDB3A4',
  groundSurfaceVariation: 0.016,
  groundSurfaceShadowVariation: 0.04,
  pedestalColor: '#B1B1B8',
  groundFeature: 'grass',
  groundFeatureColor: '#9D8C73',
  groundFeatureHighlightColor: '#BD956E',
  groundFeatureShadowColor: '#5D4C35',
  groundFeaturePaletteStartColors: colors4(
    '#9D8C73', '#BD956E', '#F4A358', '#5D4C35'
  ),
  groundFeaturePaletteEndColors: colors4(
    '#9D8C73', '#BD956E', '#F4A358', '#5D4C35'
  ),
  groundFeaturePaletteStops: stops3(0.4, 0.7, 0.88),
  groundFeaturePaletteVariations: variations4(0.004, 0.004, 0.004, 0),
  qrFinderColor: '#9D8C73',
  qrFinderHighlightColor: '#F4A358',
  qrFinderShadowColor: '#5D4C35',
  qrFinderEyeColor: '#5D4C35',
  qrFinderPaletteColors: colors4('#9D8C73', '#BD956E', '#F4A358', '#F4A358'),
  qrFinderPaletteStops: DEFAULT_FEATURE_STOPS,
  qrFinderColorVariation: 0.0035,
  skyTop: '#F8F0EC',
  skyBottom: '#F4A358',
  titleColor: '#BD3528',
  canopyDensity: 100,
  particleType: 'leaf',
  particleAmount: 60,
  groundLeavesAmount: 80,
  groundLeavesSeed: 2,
  weatherType: 'none',
  weatherAmount: 0,
  weatherColor: '#A3CAE8',
  ambientParticleType: 'none',
  ambientParticleAmount: 0,
  ambientParticleColor: '#FFEA44',
  snowflakeAmount: 0,
  snowflakeColor: '#F4F8FC',
} as const satisfies ResolvedTreeTheme);

const WINTER_THEME = Object.freeze({
  foliageColor: '#D8E5F0',
  foliageHighlightColor: '#F4F8FC',
  foliageShadowColor: '#577A9E',
  foliageMidtoneColor: '#A3CAE8',
  foliageShape: 'blossom',
  foliagePaletteColors: colors5(
    '#6185A6', '#8CADD1', '#BDD6F0', '#F5FAFF', '#A6D6E6'
  ),
  foliagePaletteStops: stops4(0.18, 0.44, 0.72, 0.9),
  foliageColorVariation: 0.0175,
  foliageVerticalLift: 0,
  qrFoliageColor: '#7DA3C4',
  qrFoliageHighlightColor: '#A3CAE8',
  qrFoliageShadowColor: '#577A9E',
  qrFoliageMidtoneColor: '#7DA3C4',
  qrFoliagePaletteColors: colors4('#3D668F', '#5C85AD', '#7AA3C7', '#99BDDB'),
  qrFoliagePaletteStops: stops3(0.22, 0.56, 0.82),
  qrFoliageColorVariation: 0.03,
  blossomCenterColor: '#F4F8FC',
  branchColor: '#908176',
  branchHighlightColor: '#A69990',
  branchShadowColor: '#766961',
  branchTipColor: '#B8B1AA',
  branchStyle: 'frosted',
  groundColor: '#F5F7FB',
  groundShadowColor: '#8DA1B5',
  groundSurfaceColor: '#D4D4D1',
  groundSurfaceShadowColor: '#BFBFBC',
  groundSurfaceVariation: 0.04,
  groundSurfaceShadowVariation: 0.05,
  pedestalColor: '#B1B1B8',
  groundFeature: 'pixel',
  groundFeatureColor: '#FFFFFF',
  groundFeatureHighlightColor: '#F4F8FC',
  groundFeatureShadowColor: '#A3CAE8',
  groundFeaturePaletteStartColors: colors4(
    '#F5FAFF', '#F5FAFF', '#F5FAFF', '#F5FAFF'
  ),
  groundFeaturePaletteEndColors: colors4(
    '#F5FAFF', '#F5FAFF', '#F5FAFF', '#F5FAFF'
  ),
  groundFeaturePaletteStops: DEFAULT_FEATURE_STOPS,
  groundFeaturePaletteVariations: variations4(0, 0, 0, 0),
  qrFinderColor: '#7DA3C4',
  qrFinderHighlightColor: '#A3CAE8',
  qrFinderShadowColor: '#577A9E',
  qrFinderEyeColor: '#335270',
  qrFinderPaletteColors: colors4('#476B8F', '#6185A8', '#7A9EBD', '#7A9EBD'),
  qrFinderPaletteStops: DEFAULT_FEATURE_STOPS,
  qrFinderColorVariation: 0.035,
  skyTop: '#F2F5FA',
  skyBottom: '#F5F7FB',
  titleColor: '#577A9E',
  canopyDensity: 100,
  particleType: 'snow',
  particleAmount: 0,
  groundLeavesAmount: 0,
  groundLeavesSeed: 3,
  weatherType: 'none',
  weatherAmount: 0,
  weatherColor: '#A3CAE8',
  ambientParticleType: 'none',
  ambientParticleAmount: 0,
  ambientParticleColor: '#FFEA44',
  snowflakeAmount: 300,
  snowflakeColor: '#F4F8FC',
} as const satisfies ResolvedTreeTheme);

/** Complete, immutable visual definitions for all built-in themes. */
export const TREE_THEME_PRESETS = Object.freeze({
  spring: SPRING_THEME,
  summer: SUMMER_THEME,
  autumn: AUTUMN_THEME,
  winter: WINTER_THEME,
}) satisfies Readonly<Record<DesignQRThemePreset, Readonly<ResolvedTreeTheme>>>;

export type TreeThemeOverrides = Partial<ResolvedTreeTheme>;

const TREE_PARTICLE_INTENSITY_MAX = 60;

function normalizeParticleIntensity(
  particleType: ResolvedTreeTheme['particleType'],
  intensity: number | undefined
): number {
  const fallback = particleType === 'fireflies'
    ? 12
    : particleType === 'none'
      ? 0
      : 60;
  const candidate = typeof intensity === 'number' && Number.isFinite(intensity)
    ? intensity
    : fallback;
  return Math.round(Math.max(0, Math.min(TREE_PARTICLE_INTENSITY_MAX, candidate)));
}

function resolveTreeParticleIntensity(theme: ResolvedTreeTheme): number {
  if (theme.particleType === 'fireflies') {
    return normalizeParticleIntensity(
      theme.particleType,
      theme.ambientParticleAmount || theme.particleAmount || undefined
    );
  }
  if (theme.particleType === 'snow') {
    return normalizeParticleIntensity(
      theme.particleType,
      theme.snowflakeAmount > 0
        ? theme.snowflakeAmount / 5
        : theme.particleAmount || undefined
    );
  }
  return normalizeParticleIntensity(theme.particleType, theme.particleAmount);
}

/**
 * Converts the Add Theme particle picker into the complete renderer roles.
 * Explicit weather, ambient, or snow overrides may still be layered on top.
 */
export function createTreeParticleOverrides(
  particleType: ResolvedTreeTheme['particleType'],
  intensity?: number
): TreeThemeOverrides {
  const amount = normalizeParticleIntensity(particleType, intensity);
  const isFallingFoliage = particleType === 'leaf' || particleType === 'sakura';
  const isFireflies = particleType === 'fireflies';
  const isSnow = particleType === 'snow';

  return {
    particleType,
    particleAmount: particleType === 'none' ? 0 : amount,
    groundLeavesAmount: isFallingFoliage ? Math.round(amount * 0.85) : 0,
    weatherType: 'none',
    weatherAmount: 0,
    ambientParticleType: isFireflies ? 'fireflies' : 'none',
    ambientParticleAmount: isFireflies ? amount : 0,
    snowflakeAmount: isSnow ? amount * 5 : 0,
  };
}

function cloneColors4(colors: TreePaletteColors4): TreePaletteColors4 {
  return [...colors] as [string, string, string, string];
}

function cloneColors5(colors: TreePaletteColors5): TreePaletteColors5 {
  return [...colors] as [string, string, string, string, string];
}

function cloneStops3(stops: TreePaletteStops3): TreePaletteStops3 {
  return [...stops] as [number, number, number];
}

function cloneStops4(stops: TreePaletteStops4): TreePaletteStops4 {
  return [...stops] as [number, number, number, number];
}

function cloneVariations4(variations: TreePaletteVariations4): TreePaletteVariations4 {
  return [...variations] as [number, number, number, number];
}

function cloneResolvedTheme(theme: ResolvedTreeTheme): ResolvedTreeTheme {
  return {
    ...theme,
    foliagePaletteColors: cloneColors5(theme.foliagePaletteColors),
    foliagePaletteStops: cloneStops4(theme.foliagePaletteStops),
    qrFoliagePaletteColors: cloneColors4(theme.qrFoliagePaletteColors),
    qrFoliagePaletteStops: cloneStops3(theme.qrFoliagePaletteStops),
    groundFeaturePaletteStartColors: cloneColors4(theme.groundFeaturePaletteStartColors),
    groundFeaturePaletteEndColors: cloneColors4(theme.groundFeaturePaletteEndColors),
    groundFeaturePaletteStops: cloneStops3(theme.groundFeaturePaletteStops),
    groundFeaturePaletteVariations: cloneVariations4(theme.groundFeaturePaletteVariations),
    qrFinderPaletteColors: cloneColors4(theme.qrFinderPaletteColors),
    qrFinderPaletteStops: cloneStops3(theme.qrFinderPaletteStops),
  };
}

export type TreeQRDarkModuleRole = 'foliage' | 'finder';

function normalizeTreeGroundFeature(value: unknown): TreeGroundFeature {
  if (value === undefined) return 'grass';
  if (value === 'grass' || value === 'pixel' || value === 'none') return value;
  throw new DesignQRConfigError(
    'INVALID_CONFIG',
    'theme.groundFeature must be grass, pixel, or none.'
  );
}

/**
 * Keeps the required QR finder modules while removing their distinct
 * ground-decor treatment when a theme selects no ground feature.
 */
export function resolveTreeQRDarkModuleRole(
  groundFeature: TreeGroundFeature,
  isFinderModule: boolean
): TreeQRDarkModuleRole {
  return isFinderModule && groundFeature !== 'none' ? 'finder' : 'foliage';
}

/** Creates a complete custom theme by applying overrides to a built-in preset. */
export function createTreeTheme(
  preset: DesignQRThemePreset,
  overrides: TreeThemeOverrides = {}
): ResolvedTreeTheme {
  const base = TREE_THEME_PRESETS[preset];
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined)
  ) as TreeThemeOverrides;
  const shouldComposeParticleRoles = overrides.particleType !== undefined
    || (overrides.particleAmount !== undefined && base.particleType !== 'none');
  const selectedParticleType = overrides.particleType ?? base.particleType;
  const baseParticleIntensity = resolveTreeParticleIntensity(base);
  const particleOverrides = shouldComposeParticleRoles
    ? createTreeParticleOverrides(
        selectedParticleType,
        overrides.particleAmount
          ?? (baseParticleIntensity > 0 ? baseParticleIntensity : undefined)
      )
    : {};
  const merged: Record<string, unknown> = {
    ...cloneResolvedTheme(base),
    ...particleOverrides,
    ...definedOverrides,
  };
  if (shouldComposeParticleRoles && selectedParticleType === 'none') {
    merged.particleAmount = 0;
  }
  merged.groundFeature = normalizeTreeGroundFeature(merged.groundFeature);
  const foliageSourceChanged = overrides.foliageColor !== undefined
    || overrides.foliageShadowColor !== undefined
    || overrides.foliageMidtoneColor !== undefined
    || overrides.foliageHighlightColor !== undefined;

  if (foliageSourceChanged) {
    if (overrides.foliagePaletteColors === undefined) {
      delete merged.foliagePaletteColors;
    }
    if (overrides.qrFoliageColor === undefined) delete merged.qrFoliageColor;
    if (overrides.qrFoliageHighlightColor === undefined) {
      delete merged.qrFoliageHighlightColor;
    }
    if (overrides.qrFoliageShadowColor === undefined) {
      delete merged.qrFoliageShadowColor;
    }
    if (overrides.qrFoliageMidtoneColor === undefined) {
      delete merged.qrFoliageMidtoneColor;
    }
    if (overrides.qrFoliagePaletteColors === undefined) {
      delete merged.qrFoliagePaletteColors;
    }
    if (overrides.titleColor === undefined) delete merged.titleColor;
  }

  if (
    overrides.qrFoliagePaletteColors === undefined
    && (
      overrides.qrFoliageColor !== undefined
      || overrides.qrFoliageShadowColor !== undefined
      || overrides.qrFoliageMidtoneColor !== undefined
      || overrides.qrFoliageHighlightColor !== undefined
    )
  ) {
    delete merged.qrFoliagePaletteColors;
  }

  const groundSourceChanged = overrides.groundColor !== undefined
    || overrides.groundShadowColor !== undefined;
  if (groundSourceChanged) {
    if (overrides.groundSurfaceColor === undefined) {
      delete merged.groundSurfaceColor;
    }
    if (overrides.groundSurfaceShadowColor === undefined) {
      delete merged.groundSurfaceShadowColor;
    }
    if (overrides.pedestalColor === undefined) delete merged.pedestalColor;
  }

  const groundFeatureSourceChanged = overrides.groundFeatureColor !== undefined
    || overrides.groundFeatureShadowColor !== undefined
    || overrides.groundFeatureHighlightColor !== undefined;

  if (groundFeatureSourceChanged) {
    if (overrides.groundFeaturePaletteStartColors === undefined) {
      delete merged.groundFeaturePaletteStartColors;
    }
    if (overrides.groundFeaturePaletteEndColors === undefined) {
      delete merged.groundFeaturePaletteEndColors;
    }
    if (overrides.qrFinderColor === undefined) delete merged.qrFinderColor;
    if (overrides.qrFinderHighlightColor === undefined) {
      delete merged.qrFinderHighlightColor;
    }
    if (overrides.qrFinderShadowColor === undefined) {
      delete merged.qrFinderShadowColor;
    }
    if (overrides.qrFinderEyeColor === undefined) delete merged.qrFinderEyeColor;
    if (overrides.qrFinderPaletteColors === undefined) {
      delete merged.qrFinderPaletteColors;
    }
  }

  if (
    overrides.qrFinderPaletteColors === undefined
    && (
      overrides.qrFinderColor !== undefined
      || overrides.qrFinderShadowColor !== undefined
      || overrides.qrFinderHighlightColor !== undefined
    )
  ) {
    delete merged.qrFinderPaletteColors;
  }

  return cloneResolvedTheme(resolveCustomTreeTheme(merged as unknown as TreeTheme));
}

function resolveCustomTreeTheme(theme: TreeTheme): ResolvedTreeTheme {
  const fallback = TREE_THEME_PRESETS.spring;
  const foliageHighlightColor = theme.foliageHighlightColor ?? theme.foliageColor;
  const foliageShadowColor = theme.foliageShadowColor ?? theme.foliageColor;
  const foliageMidtoneColor = theme.foliageMidtoneColor ?? theme.foliageColor;
  const qrFoliageColor = theme.qrFoliageColor ?? theme.foliageColor;
  const qrFoliageHighlightColor = theme.qrFoliageHighlightColor ?? foliageHighlightColor;
  const qrFoliageShadowColor = theme.qrFoliageShadowColor ?? foliageShadowColor;
  const qrFoliageMidtoneColor = theme.qrFoliageMidtoneColor ?? foliageMidtoneColor;
  const groundShadowColor = theme.groundShadowColor ?? theme.groundColor;
  const featureColor = theme.groundFeatureColor ?? theme.groundColor;
  const featureHighlightColor = theme.groundFeatureHighlightColor ?? featureColor;
  const featureShadowColor = theme.groundFeatureShadowColor ?? featureColor;
  const finderColor = theme.qrFinderColor ?? featureColor;
  const finderHighlightColor = theme.qrFinderHighlightColor ?? featureHighlightColor;
  const finderShadowColor = theme.qrFinderShadowColor ?? featureShadowColor;
  const particleAmount = theme.particleAmount
    ?? (theme.particleType === 'leaf' || theme.particleType === 'sakura' ? 60 : 0);
  const ambientParticleType = theme.ambientParticleType
    ?? (theme.particleType === 'fireflies' ? 'fireflies' : 'none');

  return {
    ...fallback,
    ...theme,
    foliageHighlightColor,
    foliageShadowColor,
    foliageMidtoneColor,
    foliageShape: theme.foliageShape ?? 'leaf',
    foliagePaletteColors: theme.foliagePaletteColors
      ?? [
        foliageShadowColor,
        theme.foliageColor,
        foliageMidtoneColor,
        foliageHighlightColor,
        foliageHighlightColor,
      ],
    foliagePaletteStops: theme.foliagePaletteStops ?? DEFAULT_FOLIAGE_STOPS,
    foliageColorVariation: theme.foliageColorVariation ?? 0.00525,
    foliageVerticalLift: theme.foliageVerticalLift ?? 0,
    qrFoliageColor,
    qrFoliageHighlightColor,
    qrFoliageShadowColor,
    qrFoliageMidtoneColor,
    qrFoliagePaletteColors: theme.qrFoliagePaletteColors
      ?? [
        qrFoliageShadowColor,
        qrFoliageColor,
        qrFoliageMidtoneColor,
        qrFoliageHighlightColor,
      ],
    qrFoliagePaletteStops: theme.qrFoliagePaletteStops ?? DEFAULT_QR_STOPS,
    qrFoliageColorVariation: theme.qrFoliageColorVariation ?? 0.03,
    blossomCenterColor: theme.blossomCenterColor ?? fallback.blossomCenterColor,
    branchColor: theme.branchColor ?? fallback.branchColor,
    branchHighlightColor: theme.branchHighlightColor ?? fallback.branchHighlightColor,
    branchShadowColor: theme.branchShadowColor ?? fallback.branchShadowColor,
    branchTipColor: theme.branchTipColor ?? fallback.branchTipColor,
    branchStyle: theme.branchStyle ?? 'natural',
    groundShadowColor,
    groundSurfaceColor: theme.groundSurfaceColor ?? theme.groundColor,
    groundSurfaceShadowColor: theme.groundSurfaceShadowColor ?? groundShadowColor,
    groundSurfaceVariation: theme.groundSurfaceVariation ?? 0.016,
    groundSurfaceShadowVariation: theme.groundSurfaceShadowVariation ?? 0.016,
    pedestalColor: theme.pedestalColor ?? groundShadowColor,
    groundFeature: normalizeTreeGroundFeature(theme.groundFeature),
    groundFeatureColor: featureColor,
    groundFeatureHighlightColor: featureHighlightColor,
    groundFeatureShadowColor: featureShadowColor,
    groundFeaturePaletteStartColors: theme.groundFeaturePaletteStartColors
      ?? [featureShadowColor, featureColor, featureHighlightColor, featureHighlightColor],
    groundFeaturePaletteEndColors: theme.groundFeaturePaletteEndColors
      ?? [featureShadowColor, featureColor, featureHighlightColor, featureHighlightColor],
    groundFeaturePaletteStops: theme.groundFeaturePaletteStops ?? DEFAULT_FEATURE_STOPS,
    groundFeaturePaletteVariations: theme.groundFeaturePaletteVariations
      ?? [0.04, 0.04, 0.04, 0.04],
    qrFinderColor: finderColor,
    qrFinderHighlightColor: finderHighlightColor,
    qrFinderShadowColor: finderShadowColor,
    qrFinderEyeColor: theme.qrFinderEyeColor
      ?? featureShadowColor,
    qrFinderPaletteColors: theme.qrFinderPaletteColors
      ?? [finderShadowColor, finderColor, finderHighlightColor, finderHighlightColor],
    qrFinderPaletteStops: theme.qrFinderPaletteStops ?? DEFAULT_FEATURE_STOPS,
    qrFinderColorVariation: theme.qrFinderColorVariation ?? 0.0035,
    titleColor: theme.titleColor ?? foliageShadowColor,
    canopyDensity: theme.canopyDensity ?? 100,
    particleAmount,
    groundLeavesAmount: theme.groundLeavesAmount
      ?? ((theme.particleType === 'leaf' || theme.particleType === 'sakura')
        ? Math.round(particleAmount * 0.85)
        : 0),
    groundLeavesSeed: theme.groundLeavesSeed ?? 0,
    weatherType: theme.weatherType ?? 'none',
    weatherAmount: theme.weatherAmount ?? 0,
    weatherColor: theme.weatherColor ?? fallback.weatherColor,
    ambientParticleType,
    ambientParticleAmount: theme.ambientParticleAmount
      ?? (ambientParticleType === 'none' ? 0 : particleAmount || 12),
    ambientParticleColor: theme.ambientParticleColor ?? fallback.ambientParticleColor,
    snowflakeAmount: theme.snowflakeAmount
      ?? (theme.particleType === 'snow' ? 300 : 0),
    snowflakeColor: theme.snowflakeColor ?? fallback.snowflakeColor,
  };
}

/** Resolves either a preset or partial custom configuration for the renderer. */
export function resolveTreeTheme(theme: DesignQRConfigV1['theme']): ResolvedTreeTheme {
  return theme.type === 'preset'
    ? cloneResolvedTheme(TREE_THEME_PRESETS[theme.preset])
    : cloneResolvedTheme(resolveCustomTreeTheme(theme.value));
}

export function resolveTreeFoliageMorph(progress: number): {
  organicVisible: boolean;
  voxelVisible: boolean;
  voxelScale: number;
} {
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  return {
    organicVisible: normalizedProgress < 0.999,
    voxelVisible: normalizedProgress > 0.01 && normalizedProgress < 0.999,
    voxelScale: Math.sin(normalizedProgress * Math.PI * 0.5),
  };
}
