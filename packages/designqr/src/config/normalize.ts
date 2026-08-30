import {
  DESIGN_QR_BORDER_PADDING_DEFAULT,
  DESIGN_QR_BORDER_PADDING_MAX,
  DESIGN_QR_BORDER_PADDING_MIN,
  DESIGN_QR_BORDER_PADDING_STEP,
  DESIGN_QR_CANOPY_DENSITY_MAX,
  DESIGN_QR_CANOPY_DENSITY_MIN,
  DESIGN_QR_DEFAULTS,
  DESIGN_QR_GROUND_LEAVES_AMOUNT_MAX,
  DESIGN_QR_GROUND_LEAVES_AMOUNT_MIN,
  DESIGN_QR_MAX_TITLE_CHARACTERS,
  DESIGN_QR_MAX_VALUE_BYTES,
  DESIGN_QR_PARTICLE_AMOUNT_MAX,
  DESIGN_QR_PARTICLE_AMOUNT_MIN,
  DESIGN_QR_SCHEMA_VERSION,
} from './defaults.ts';
import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRError,
  type DesignQRQuality,
  type DesignQRThemePreset,
  type DesignQRView,
  type Result,
  type TreeTheme,
} from './types.ts';
import { getDesignAdapter } from '../designs/registry.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') return DESIGN_QR_DEFAULTS.details.title;
  return Array.from(value).slice(0, DESIGN_QR_MAX_TITLE_CHARACTERS).join('');
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

function normalizeTreeTheme(input: unknown): TreeTheme {
  if (!isRecord(input)) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'A custom tree theme must be an object.');
  }

  const foliageShape = input.foliageShape;
  if (foliageShape !== undefined && foliageShape !== 'blossom' && foliageShape !== 'leaf') {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.foliageShape must be blossom or leaf.'
    );
  }

  const groundFeature = input.groundFeature;
  if (
    groundFeature !== undefined
    && groundFeature !== 'grass'
    && groundFeature !== 'snow'
    && groundFeature !== 'none'
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'theme.groundFeature must be grass, snow, or none.'
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
    'groundShadowColor',
    'groundFeatureColor',
    'groundFeatureHighlightColor',
    'groundFeatureShadowColor',
    'titleColor',
  ] as const satisfies ReadonlyArray<keyof TreeTheme>;

  for (const fieldName of optionalColors) {
    const color = normalizeOptionalHexColor(input, fieldName);
    if (color !== undefined) {
      Object.assign(theme, { [fieldName]: color });
    }
  }

  if (foliageShape !== undefined) theme.foliageShape = foliageShape;
  if (groundFeature !== undefined) theme.groundFeature = groundFeature;

  if (typeof input.canopyDensity === 'number' && Number.isFinite(input.canopyDensity)) {
    const percentage = input.canopyDensity > 0 && input.canopyDensity <= 1
      ? input.canopyDensity * 100
      : input.canopyDensity;
    theme.canopyDensity = normalizeInteger(
      percentage,
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

  return theme;
}

function normalizeTheme(input: unknown): DesignQRConfigV1['theme'] {
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

function normalizeQuality(input: unknown): DesignQRQuality {
  if (input === undefined) return DESIGN_QR_DEFAULTS.quality;
  if (input === 'low' || input === 'high') return input;
  throw new DesignQRConfigError('INVALID_CONFIG', 'quality must be low or high.');
}

function normalizeConfig(input: unknown, requireSchemaVersion: boolean): DesignQRConfigV1 {
  if (!isRecord(input)) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'DesignQR configuration must be an object.');
  }

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

  return {
    schemaVersion: DESIGN_QR_SCHEMA_VERSION,
    value: input.value,
    design: {
      type: adapter.type,
      options: adapter.normalizeOptions(designOptions),
    },
    theme: normalizeTheme(input.theme),
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
      motionBlur: normalizeBoolean(
        interaction.motionBlur,
        DESIGN_QR_DEFAULTS.interaction.motionBlur
      ),
    },
    quality: normalizeQuality(input.quality),
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
