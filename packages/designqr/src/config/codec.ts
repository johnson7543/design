import { decodeBase64UrlText, encodeBase64UrlText } from './base64url.ts';
import { normalizeDesignQRConfig, parseDesignQRConfig } from './normalize.ts';
import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRError,
  type Result,
} from './types.ts';

function migrateRemovedQuality(input: unknown): unknown {
  if (
    typeof input === 'object'
    && input !== null
    && !Array.isArray(input)
    && 'quality' in input
    && input.quality === 'auto'
  ) {
    return { ...input, quality: 'high' };
  }

  return input;
}

export function encodeDesignQRConfig(input: unknown): string {
  return encodeBase64UrlText(JSON.stringify(normalizeDesignQRConfig(input)));
}

export function decodeDesignQRConfig(
  encoded: string
): Result<DesignQRConfigV1, DesignQRError> {
  try {
    const decoded = decodeBase64UrlText(encoded);
    const parsed = migrateRemovedQuality(JSON.parse(decoded));
    return parseDesignQRConfig(parsed);
  } catch (cause) {
    if (cause instanceof DesignQRConfigError) {
      return { ok: false, error: cause };
    }
    return {
      ok: false,
      error: new DesignQRConfigError(
        'INVALID_CONFIG',
        'The encoded DesignQR configuration is not valid JSON.',
        cause
      ),
    };
  }
}
