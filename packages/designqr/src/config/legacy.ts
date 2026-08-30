import { decodeBase64UrlText } from './base64url.ts';
import {
  DESIGN_QR_BORDER_PADDING_DEFAULT,
  DESIGN_QR_BORDER_PADDING_MAX,
  DESIGN_QR_BORDER_PADDING_MIN,
  DESIGN_QR_BORDER_PADDING_STEP,
} from './defaults.ts';
import { decodeDesignQRConfig } from './codec.ts';
import { normalizeDesignQRConfig } from './normalize.ts';
import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRError,
  type DesignQRThemePreset,
  type Result,
} from './types.ts';

const LEGACY_SEASON_PRESETS: ReadonlyArray<DesignQRThemePreset> = [
  'spring',
  'summer',
  'autumn',
  'winter',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLegacySeason(value: unknown): number {
  const season = typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : 0;
  return Math.min(LEGACY_SEASON_PRESETS.length - 1, Math.max(0, season));
}

function normalizeLegacyPadding(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DESIGN_QR_BORDER_PADDING_DEFAULT;
  }
  const stepped = Math.round(value / DESIGN_QR_BORDER_PADDING_STEP)
    * DESIGN_QR_BORDER_PADDING_STEP;
  return Math.min(
    DESIGN_QR_BORDER_PADDING_MAX,
    Math.max(DESIGN_QR_BORDER_PADDING_MIN, stepped)
  );
}

function legacyV2ToConfig(parsed: Record<string, unknown>): DesignQRConfigV1 {
  if (parsed.v !== 2 || typeof parsed.u !== 'string' || parsed.u.length === 0) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'Unsupported legacy DesignQR payload.');
  }

  const season = normalizeLegacySeason(parsed.s);
  const borderEnabled = (
    (typeof parsed.b === 'number' && parsed.b > 0)
    || parsed.b === 's'
    || parsed.b === 'o'
  );

  return normalizeDesignQRConfig({
    value: parsed.u,
    design: 'tree',
    theme: LEGACY_SEASON_PRESETS[season],
    view: parsed.m === 's' ? 'qr' : 'design',
    details: {
      title: typeof parsed.t === 'string' ? parsed.t : '',
      showValue: parsed.c === 1,
      border: borderEnabled
        ? {
            padding: typeof parsed.b === 'number'
              ? normalizeLegacyPadding(parsed.b)
              : DESIGN_QR_BORDER_PADDING_DEFAULT,
          }
        : false,
    },
  });
}

function originalLegacyToConfig(decoded: string): DesignQRConfigV1 {
  if (decoded.length < 3) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'Legacy DesignQR payload is too short.');
  }

  const season = Number.parseInt(decoded[0], 10);
  const palette = Number.parseInt(decoded[1], 10);
  const value = decoded.slice(2);
  if (!Number.isFinite(season) || !Number.isFinite(palette) || value.length === 0) {
    throw new DesignQRConfigError('INVALID_CONFIG', 'Legacy DesignQR payload is malformed.');
  }

  return normalizeDesignQRConfig({
    value,
    design: 'tree',
    theme: LEGACY_SEASON_PRESETS[normalizeLegacySeason(season)],
    view: 'design',
  });
}

export function decodeLegacyDesignQRConfig(
  encoded: string
): Result<DesignQRConfigV1, DesignQRError> {
  try {
    const decoded = decodeBase64UrlText(encoded);
    if (decoded.startsWith('{')) {
      const parsed: unknown = JSON.parse(decoded);
      if (!isRecord(parsed)) {
        throw new DesignQRConfigError('INVALID_CONFIG', 'Legacy payload must be an object.');
      }
      return { ok: true, value: legacyV2ToConfig(parsed) };
    }

    return { ok: true, value: originalLegacyToConfig(decoded) };
  } catch (cause) {
    if (cause instanceof DesignQRConfigError) {
      return { ok: false, error: cause };
    }
    return {
      ok: false,
      error: new DesignQRConfigError(
        'INVALID_CONFIG',
        'Legacy DesignQR configuration could not be decoded.',
        cause
      ),
    };
  }
}

export function decodeCompatibleDesignQRConfig(
  encoded: string
): Result<DesignQRConfigV1, DesignQRError> {
  const current = decodeDesignQRConfig(encoded);
  if (current.ok) return current;

  const legacy = decodeLegacyDesignQRConfig(encoded);
  return legacy.ok ? legacy : current;
}
