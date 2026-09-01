import { decodeBase64UrlText, encodeBase64UrlText } from './base64url.ts';
import { DESIGN_QR_MAX_ENCODED_LENGTH } from './defaults.ts';
import { normalizeDesignQRConfig, parseDesignQRConfig } from './normalize.ts';
import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRError,
  type Result,
} from './types.ts';

export function encodeDesignQRConfig(input: unknown): string {
  const encoded = encodeBase64UrlText(
    JSON.stringify(normalizeDesignQRConfig(input))
  );
  if (encoded.length > DESIGN_QR_MAX_ENCODED_LENGTH) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'The encoded DesignQR configuration is too large to share.'
    );
  }
  return encoded;
}

export function decodeDesignQRConfig(
  encoded: string
): Result<DesignQRConfigV1, DesignQRError> {
  try {
    const decoded = decodeBase64UrlText(encoded);
    return parseDesignQRConfig(JSON.parse(decoded));
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
