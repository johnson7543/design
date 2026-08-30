import {
  DESIGN_QR_MAX_ENCODED_LENGTH,
} from './defaults.ts';
import { DesignQRConfigError } from './types.ts';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function encodeBase64UrlText(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function decodeBase64UrlText(encoded: string): string {
  if (
    !encoded
    || encoded.length > DESIGN_QR_MAX_ENCODED_LENGTH
    || !BASE64URL_PATTERN.test(encoded)
  ) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'The encoded DesignQR configuration is invalid or too large.'
    );
  }

  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new DesignQRConfigError(
      'INVALID_CONFIG',
      'The encoded DesignQR configuration is not valid base64url UTF-8.',
      cause
    );
  }
}
