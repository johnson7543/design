import {
  DESIGN_QR_BORDER_PADDING_DEFAULT,
  DESIGN_QR_BORDER_PADDING_MAX,
  DESIGN_QR_BORDER_PADDING_MIN,
  DESIGN_QR_BORDER_PADDING_STEP,
  DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MAX,
  DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MIN,
  DESIGN_QR_CANOPY_DENSITY_MAX,
  DESIGN_QR_CANOPY_DENSITY_MIN,
  DESIGN_QR_DEFAULTS,
  DESIGN_QR_GROUND_LEAVES_AMOUNT_MAX,
  DESIGN_QR_GROUND_LEAVES_AMOUNT_MIN,
  DESIGN_QR_MAX_TITLE_CHARACTERS,
  DESIGN_QR_MAX_VALUE_BYTES,
  DESIGN_QR_LOGO_MAX_ALT_CHARACTERS,
  DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS,
  DESIGN_QR_LOGO_SIZE_DEFAULT,
  DESIGN_QR_LOGO_SIZE_MAX,
  DESIGN_QR_LOGO_SIZE_MIN,
  DESIGN_QR_PARTICLE_AMOUNT_MAX,
  DESIGN_QR_PARTICLE_AMOUNT_MIN,
  DESIGN_QR_SCHEMA_VERSION,
  DESIGN_QR_SNOWFLAKE_AMOUNT_MAX,
  DESIGN_QR_SNOWFLAKE_AMOUNT_MIN,
  DESIGN_QR_WEATHER_AMOUNT_MAX,
  DESIGN_QR_WEATHER_AMOUNT_MIN,
} from './defaults.ts';
import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRError,
  type DesignQRThemePreset,
  type DesignQRView,
  type Result,
  type TreePaletteColors4,
  type TreePaletteColors5,
  type TreePaletteStops3,
  type TreePaletteStops4,
  type TreePaletteVariations4,
  type TreeTheme,
} from './types.ts';
import { getDesignAdapter } from '../designs/registry.ts';
import {
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
} from '../designs/tree/constants.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CONFIG_INPUT_FIELDS = new Set([
  'schemaVersion',
  'value',
  'design',
  'tree',
  'theme',
  'view',
  'defaultView',
  'details',
  'interaction',
  'logo',
  'transparentBackground',
]);

const CANONICAL_CONFIG_FIELDS = new Set([
  'schemaVersion',
  'value',
  'design',
  'theme',
  'view',
  'details',
  'interaction',
  'logo',
  'transparentBackground',
]);

function assertKnownConfigFields(
  input: Record<string, unknown>,
  requireSchemaVersion: boolean
): void {
  const supportedFields = requireSchemaVersion
    ? CANONICAL_CONFIG_FIELDS
    : CONFIG_INPUT_FIELDS;
  const unknownField = Object.keys(input).find((field) => !supportedFields.has(field));
  if (unknownField !== undefined) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `Unsupported DesignQR configuration field: ${unknownField}.`
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeFiniteNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return Math.round(normalizeFiniteNumber(value, fallback, min, max));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeAutoRotateDirection(
  value: unknown
): DesignQRConfigV1['interaction']['autoRotateDirection'] {
  if (value === undefined) return DESIGN_QR_DEFAULTS.interaction.autoRotateDirection;
  if (value === 'clockwise' || value === 'counterclockwise') return value;
  throw new DesignQRConfigError(
    'INVALID_CONFIG',
    'interaction.autoRotateDirection must be clockwise or counterclockwise.'
  );
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') return DESIGN_QR_DEFAULTS.details.title;
  return Array.from(value).slice(0, DESIGN_QR_MAX_TITLE_CHARACTERS).join('');
}

function normalizeLogoSource(value: unknown): string {
  if (typeof value !== 'string') {
    throw new DesignQRConfigError('INVALID_CONFIG', 'logo.src must be a string.');
  }

  const source = value.trim();
  if (source.length === 0 || source.length > DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `logo.src must contain 1 to ${DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS} characters.`
    );
  }

  const rasterDataUrl = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;
  if (source.startsWith('data:')) {
    if (rasterDataUrl.test(source)) return source;
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'logo.src data URLs must contain a base64-encoded PNG, JPEG, or WebP image.'
    );
  }

  if (source.startsWith('//')) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'logo.src must not use a protocol-relative URL.'
    );
  }

  const scheme = source.match(/^([A-Za-z][A-Za-z\d+.-]*):/)?.[1]?.toLowerCase();
  if (scheme !== undefined && scheme !== 'https') {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'Hosted logo.src values must use HTTPS.'
    );
  }

  return source;
}

function normalizeLogo(input: unknown): DesignQRConfigV1['logo'] {
  if (input === false || input === undefined || input === null) return false;
  if (!isRecord(input)) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'logo must be false or an object.');
  }

  const rawAlt = typeof input.alt === 'string' ? input.alt.trim() : '';
  const alt = Array.from(rawAlt).slice(0, DESIGN_QR_LOGO_MAX_ALT_CHARACTERS).join('');
  const size = Math.round(normalizeFiniteNumber(
    input.size,
    DESIGN_QR_LOGO_SIZE_DEFAULT,
    DESIGN_QR_LOGO_SIZE_MIN,
    DESIGN_QR_LOGO_SIZE_MAX
  ) * 1_000) / 1_000;

  return {
    src: normalizeLogoSource(input.src),
    alt,
    size,
  };
}

export function normalizeHexColor(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^#[\dA-Fa-f]{3}(?:[\dA-Fa-f]{3})?$/.test(value)) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `${fieldName} must be a #RGB or #RRGGBB color.`
    );
  }

  const digits = value.slice(1);
  const expanded = digits.length === 3
    ? Array.from(digits, (digit) => `${digit}${digit}`).join('')
    : digits;
  return `#${expanded.toUpperCase()}`;
}

function normalizeOptionalHexColor(
  theme: Record<string, unknown>,
  fieldName: keyof TreeTheme
): string | undefined {
  const value = theme[fieldName];
  return value === undefined ? undefined : normalizeHexColor(value, `theme.${fieldName}`);
}

function normalizePaletteColors(
  value: unknown,
  fieldName: string,
  length: number
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== length) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `${fieldName} must contain exactly ${length} colors.`
    );
  }
  return value.map((color, index) => normalizeHexColor(color, `${fieldName}[${index}]`));
}

function normalizePaletteNumbers(
  value: unknown,
  fieldName: string,
  length: number,
  min: number,
  max: number,
  requireAscending = false
): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== length) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `${fieldName} must contain exactly ${length} numbers.`
    );
  }

  const normalized = value.map((candidate, index) => {
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new DesignQRConfigError(
        'INVALID_CONFIG',
        `${fieldName}[${index}] must be a finite number.`
      );
    }
    return Math.round(clamp(candidate, min, max) * 10_000) / 10_000;
  });

  if (
    requireAscending
    && normalized.some((candidate, index) => index > 0 && candidate <= normalized[index - 1])
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `${fieldName} must be strictly ascending.`
    );
  }
  return normalized;
}

function normalizeTreeTheme(input: unknown): TreeTheme {
  if (!isRecord(input)) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'A custom tree theme must be an object.');
  }

  const foliageShape = input.foliageShape;
  if (
    foliageShape !== undefined
    && foliageShape !== 'blossom'
    && foliageShape !== 'leaf'
    && foliageShape !== 'pixel'
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.foliageShape must be blossom, leaf, or pixel.'
    );
  }

  const groundFeature = input.groundFeature;
  if (
    groundFeature !== undefined
    && groundFeature !== 'grass'
    && groundFeature !== 'pixel'
    && groundFeature !== 'none'
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.groundFeature must be grass, pixel, or none.'
    );
  }

  const particleType = input.particleType;
  if (
    particleType !== 'leaf'
    && particleType !== 'sakura'
    && particleType !== 'fireflies'
    && particleType !== 'snow'
    && particleType !== 'none'
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.particleType is not supported.'
    );
  }

  const branchStyle = input.branchStyle;
  if (branchStyle !== undefined && branchStyle !== 'natural' && branchStyle !== 'frosted') {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.branchStyle must be natural or frosted.'
    );
  }

  const weatherType = input.weatherType;
  if (weatherType !== undefined && weatherType !== 'rain' && weatherType !== 'none') {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.weatherType must be rain or none.'
    );
  }

  const ambientParticleType = input.ambientParticleType;
  if (
    ambientParticleType !== undefined
    && ambientParticleType !== 'butterflies'
    && ambientParticleType !== 'fireflies'
    && ambientParticleType !== 'none'
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.ambientParticleType is not supported.'
    );
  }

  const theme: TreeTheme = {
    foliageColor: normalizeHexColor(input.foliageColor, 'theme.foliageColor'),
    groundColor: normalizeHexColor(input.groundColor, 'theme.groundColor'),
    skyTop: normalizeHexColor(input.skyTop, 'theme.skyTop'),
    skyBottom: normalizeHexColor(input.skyBottom, 'theme.skyBottom'),
    particleType,
  };

  const optionalColors = [
    'foliageHighlightColor',
    'foliageShadowColor',
    'foliageMidtoneColor',
    'qrFoliageColor',
    'qrFoliageHighlightColor',
    'qrFoliageShadowColor',
    'qrFoliageMidtoneColor',
    'blossomCenterColor',
    'branchColor',
    'branchHighlightColor',
    'branchShadowColor',
    'branchTipColor',
    'groundShadowColor',
    'groundSurfaceColor',
    'groundSurfaceShadowColor',
    'pedestalColor',
    'groundFeatureColor',
    'groundFeatureHighlightColor',
    'groundFeatureShadowColor',
    'qrFinderColor',
    'qrFinderHighlightColor',
    'qrFinderShadowColor',
    'qrFinderEyeColor',
    'titleColor',
    'weatherColor',
    'ambientParticleColor',
    'snowflakeColor',
  ] as const satisfies ReadonlyArray<keyof TreeTheme>;

  for (const fieldName of optionalColors) {
    const color = normalizeOptionalHexColor(input, fieldName);
    if (color !== undefined) {
      Object.assign(theme, { [fieldName]: color });
    }
  }

  const foliagePaletteColors = normalizePaletteColors(
    input.foliagePaletteColors,
    'theme.foliagePaletteColors',
    5
  );
  if (foliagePaletteColors) {
    theme.foliagePaletteColors = foliagePaletteColors as unknown as TreePaletteColors5;
  }
  const foliagePaletteStops = normalizePaletteNumbers(
    input.foliagePaletteStops,
    'theme.foliagePaletteStops',
    4,
    0.0001,
    1,
    true
  );
  if (foliagePaletteStops) {
    theme.foliagePaletteStops = foliagePaletteStops as unknown as TreePaletteStops4;
  }

  const qrFoliagePaletteColors = normalizePaletteColors(
    input.qrFoliagePaletteColors,
    'theme.qrFoliagePaletteColors',
    4
  );
  if (qrFoliagePaletteColors) {
    theme.qrFoliagePaletteColors = qrFoliagePaletteColors as unknown as TreePaletteColors4;
  }
  const qrFoliagePaletteStops = normalizePaletteNumbers(
    input.qrFoliagePaletteStops,
    'theme.qrFoliagePaletteStops',
    3,
    0.0001,
    1,
    true
  );
  if (qrFoliagePaletteStops) {
    theme.qrFoliagePaletteStops = qrFoliagePaletteStops as unknown as TreePaletteStops3;
  }

  const groundFeaturePaletteStartColors = normalizePaletteColors(
    input.groundFeaturePaletteStartColors,
    'theme.groundFeaturePaletteStartColors',
    4
  );
  if (groundFeaturePaletteStartColors) {
    theme.groundFeaturePaletteStartColors = groundFeaturePaletteStartColors as unknown as TreePaletteColors4;
  }
  const groundFeaturePaletteEndColors = normalizePaletteColors(
    input.groundFeaturePaletteEndColors,
    'theme.groundFeaturePaletteEndColors',
    4
  );
  if (groundFeaturePaletteEndColors) {
    theme.groundFeaturePaletteEndColors = groundFeaturePaletteEndColors as unknown as TreePaletteColors4;
  }
  const groundFeaturePaletteStops = normalizePaletteNumbers(
    input.groundFeaturePaletteStops,
    'theme.groundFeaturePaletteStops',
    3,
    0.0001,
    1,
    true
  );
  if (groundFeaturePaletteStops) {
    theme.groundFeaturePaletteStops = groundFeaturePaletteStops as unknown as TreePaletteStops3;
  }
  const groundFeaturePaletteVariations = normalizePaletteNumbers(
    input.groundFeaturePaletteVariations,
    'theme.groundFeaturePaletteVariations',
    4,
    0,
    0.1
  );
  if (groundFeaturePaletteVariations) {
    theme.groundFeaturePaletteVariations = groundFeaturePaletteVariations as unknown as TreePaletteVariations4;
  }

  const qrFinderPaletteColors = normalizePaletteColors(
    input.qrFinderPaletteColors,
    'theme.qrFinderPaletteColors',
    4
  );
  if (qrFinderPaletteColors) {
    theme.qrFinderPaletteColors = qrFinderPaletteColors as unknown as TreePaletteColors4;
  }
  const qrFinderPaletteStops = normalizePaletteNumbers(
    input.qrFinderPaletteStops,
    'theme.qrFinderPaletteStops',
    3,
    0.0001,
    1,
    true
  );
  if (qrFinderPaletteStops) {
    theme.qrFinderPaletteStops = qrFinderPaletteStops as unknown as TreePaletteStops3;
  }

  const scalarPaletteFields = [
    ['foliageColorVariation', 0, 0.1],
    ['foliageVerticalLift', -0.1, 0.1],
    ['qrFoliageColorVariation', 0, 0.1],
    ['groundSurfaceVariation', 0, 0.1],
    ['groundSurfaceShadowVariation', 0, 0.1],
    ['qrFinderColorVariation', 0, 0.1],
  ] as const satisfies ReadonlyArray<readonly [keyof TreeTheme, number, number]>;
  for (const [fieldName, min, max] of scalarPaletteFields) {
    const value = input[fieldName];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new DesignQRConfigError(
        'INVALID_CONFIG',
        `theme.${String(fieldName)} must be a finite number.`
      );
    }
    Object.assign(theme, {
      // Five decimal places preserve every authored preset distribution while
      // still keeping canonical custom-theme payloads deterministic.
      [fieldName]: Math.round(clamp(value, min, max) * 100_000) / 100_000,
    });
  }

  if (foliageShape !== undefined) theme.foliageShape = foliageShape;
  if (groundFeature !== undefined) theme.groundFeature = groundFeature;
  if (branchStyle !== undefined) theme.branchStyle = branchStyle;
  if (weatherType !== undefined) theme.weatherType = weatherType;
  if (ambientParticleType !== undefined) {
    theme.ambientParticleType = ambientParticleType;
  }

  if (typeof input.canopyDensity === 'number' && Number.isFinite(input.canopyDensity)) {
    theme.canopyDensity = normalizeInteger(
      input.canopyDensity,
      DESIGN_QR_CANOPY_DENSITY_MAX,
      DESIGN_QR_CANOPY_DENSITY_MIN,
      DESIGN_QR_CANOPY_DENSITY_MAX
    );
  }

  if (input.particleAmount !== undefined) {
    theme.particleAmount = normalizeInteger(
      input.particleAmount,
      DESIGN_QR_PARTICLE_AMOUNT_MIN,
      DESIGN_QR_PARTICLE_AMOUNT_MIN,
      DESIGN_QR_PARTICLE_AMOUNT_MAX
    );
  }

  if (input.groundLeavesAmount !== undefined) {
    theme.groundLeavesAmount = normalizeInteger(
      input.groundLeavesAmount,
      DESIGN_QR_GROUND_LEAVES_AMOUNT_MIN,
      DESIGN_QR_GROUND_LEAVES_AMOUNT_MIN,
      DESIGN_QR_GROUND_LEAVES_AMOUNT_MAX
    );
  }

  if (input.groundLeavesSeed !== undefined) {
    if (typeof input.groundLeavesSeed !== 'number' || !Number.isFinite(input.groundLeavesSeed)) {
      throw new DesignQRConfigError(
        'INVALID_CONFIG',
        'theme.groundLeavesSeed must be a finite number.'
      );
    }
    theme.groundLeavesSeed = normalizeInteger(
      input.groundLeavesSeed,
      0,
      0,
      1_000_000
    );
  }

  if (input.weatherAmount !== undefined) {
    theme.weatherAmount = normalizeInteger(
      input.weatherAmount,
      DESIGN_QR_WEATHER_AMOUNT_MIN,
      DESIGN_QR_WEATHER_AMOUNT_MIN,
      DESIGN_QR_WEATHER_AMOUNT_MAX
    );
  }

  if (input.ambientParticleAmount !== undefined) {
    theme.ambientParticleAmount = normalizeInteger(
      input.ambientParticleAmount,
      DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MIN,
      DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MIN,
      DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MAX
    );
  }

  if (input.snowflakeAmount !== undefined) {
    theme.snowflakeAmount = normalizeInteger(
      input.snowflakeAmount,
      DESIGN_QR_SNOWFLAKE_AMOUNT_MIN,
      DESIGN_QR_SNOWFLAKE_AMOUNT_MIN,
      DESIGN_QR_SNOWFLAKE_AMOUNT_MAX
    );
  }

  return theme;
}

export function normalizeDesignQRTheme(input: unknown): DesignQRConfigV1['theme'] {
  if (input === undefined) return { ...DESIGN_QR_DEFAULTS.theme };

  const presets: ReadonlyArray<DesignQRThemePreset> = [
    'spring',
    'summer',
    'autumn',
    'winter',
  ];

  if (typeof input === 'string') {
    if (presets.includes(input as DesignQRThemePreset)) {
      return { type: 'preset', preset: input as DesignQRThemePreset };
    }
    throw new DesignQRConfigError('INVALID_CONFIG', `Unsupported DesignQR theme: ${input}`);
  }

  if (!isRecord(input)) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'theme must be a preset or custom theme.');
  }

  if (input.type === 'preset') {
    if (presets.includes(input.preset as DesignQRThemePreset)) {
      return { type: 'preset', preset: input.preset as DesignQRThemePreset };
    }
    throw new DesignQRConfigError('INVALID_CONFIG', 'The preset theme is not supported.');
  }

  if (input.type === 'custom') {
    return { type: 'custom', value: normalizeTreeTheme(input.value) };
  }

  if ('foliageColor' in input) {
    return { type: 'custom', value: normalizeTreeTheme(input) };
  }

  throw new DesignQRConfigError('INVALID_CONFIG', 'The theme configuration is not supported.');
}

function normalizeView(input: unknown, defaultView: unknown): DesignQRView {
  const candidate = isRecord(input) ? input.initial : input ?? defaultView;
  if (candidate === undefined) return DESIGN_QR_DEFAULTS.view.initial;
  if (candidate === 'design' || candidate === 'qr') return candidate;
  throw new DesignQRConfigError('INVALID_CONFIG', 'view.initial must be design or qr.');
}

function normalizeBorder(input: unknown): false | { padding: number } {
  if (input === false || input === undefined || input === null) return false;

  const rawPadding = isRecord(input) ? input.padding : DESIGN_QR_BORDER_PADDING_DEFAULT;
  const clamped = normalizeFiniteNumber(
    rawPadding,
    DESIGN_QR_BORDER_PADDING_DEFAULT,
    DESIGN_QR_BORDER_PADDING_MIN,
    DESIGN_QR_BORDER_PADDING_MAX
  );
  const stepped = Math.round(clamped / DESIGN_QR_BORDER_PADDING_STEP)
    * DESIGN_QR_BORDER_PADDING_STEP;

  return {
    padding: clamp(
      stepped,
      DESIGN_QR_BORDER_PADDING_MIN,
      DESIGN_QR_BORDER_PADDING_MAX
    ),
  };
}

function normalizeConfig(input: unknown, requireSchemaVersion: boolean): DesignQRConfigV1 {
  if (!isRecord(input)) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'DesignQR configuration must be an object.');
  }

  assertKnownConfigFields(input, requireSchemaVersion);

  if (
    (requireSchemaVersion && input.schemaVersion !== DESIGN_QR_SCHEMA_VERSION)
    || (input.schemaVersion !== undefined && input.schemaVersion !== DESIGN_QR_SCHEMA_VERSION)
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `DesignQR schemaVersion must be ${DESIGN_QR_SCHEMA_VERSION}.`
    );
  }

  if (typeof input.value !== 'string' || input.value.trim().length === 0) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'DesignQR value must be a non-empty string.');
  }

  const valueBytes = new TextEncoder().encode(input.value).byteLength;
  if (valueBytes > DESIGN_QR_MAX_VALUE_BYTES) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      `DesignQR value must not exceed ${DESIGN_QR_MAX_VALUE_BYTES} UTF-8 bytes.`
    );
  }

  const designInput = input.design;
  const designName = typeof designInput === 'string'
    ? designInput
    : isRecord(designInput) && typeof designInput.type === 'string'
      ? designInput.type
      : DESIGN_QR_DEFAULTS.design.type;
  const adapter = getDesignAdapter(designName);
  if (!adapter) {
    throw new DesignQRConfigError(
      'UNSUPPORTED_DESIGN',
      `Unsupported DesignQR design: ${designName}`
    );
  }

  const designOptions = isRecord(designInput)
    ? designInput.options
    : input.tree;
  const details = isRecord(input.details) ? input.details : {};
  const interaction = isRecord(input.interaction) ? input.interaction : {};
  const transparentBackground = normalizeBoolean(
    input.transparentBackground,
    DESIGN_QR_DEFAULTS.transparentBackground
  );

  return {
    schemaVersion: DESIGN_QR_SCHEMA_VERSION,
    value: input.value,
    design: {
      type: adapter.type,
      options: adapter.normalizeOptions(designOptions),
    },
    theme: normalizeDesignQRTheme(input.theme),
    view: {
      initial: normalizeView(input.view, input.defaultView),
    },
    details: {
      title: normalizeTitle(details.title),
      showValue: normalizeBoolean(details.showValue, DESIGN_QR_DEFAULTS.details.showValue),
      border: normalizeBorder(details.border),
    },
    interaction: {
      dragToRotate: normalizeBoolean(
        interaction.dragToRotate,
        DESIGN_QR_DEFAULTS.interaction.dragToRotate
      ),
      tapToToggleView: normalizeBoolean(
        interaction.tapToToggleView,
        DESIGN_QR_DEFAULTS.interaction.tapToToggleView
      ),
      autoRotate: normalizeBoolean(
        interaction.autoRotate,
        DESIGN_QR_DEFAULTS.interaction.autoRotate
      ),
      autoRotateDirection: normalizeAutoRotateDirection(
        interaction.autoRotateDirection
      ),
      transitionSpeed: normalizeFiniteNumber(
        interaction.transitionSpeed,
        DESIGN_QR_DEFAULTS.interaction.transitionSpeed,
        VIEW_TRANSITION_SPEED_MIN,
        VIEW_TRANSITION_SPEED_MAX
      ),
      motionBlur: normalizeBoolean(
        interaction.motionBlur,
        DESIGN_QR_DEFAULTS.interaction.motionBlur
      ),
    },
    logo: normalizeLogo(input.logo),
    ...(transparentBackground ? { transparentBackground: true as const } : {}),
  };
}

export function normalizeDesignQRConfig(input: unknown): DesignQRConfigV1 {
  return normalizeConfig(input, false);
}

export function parseDesignQRConfig(
  input: unknown
): Result<DesignQRConfigV1, DesignQRError> {
  try {
    return { ok: true, value: normalizeConfig(input, true) };
  } catch (cause) {
    if (cause instanceof DesignQRConfigError) {
      return { ok: false, error: cause };
    }
    return {
      ok: false,
      error: new DesignQRConfigError(
        'INVALID_CONFIG',
        'DesignQR configuration could not be parsed.',
        cause
      ),
    };
  }
}
