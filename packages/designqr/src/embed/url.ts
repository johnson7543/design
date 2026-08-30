import { encodeDesignQRConfig } from '../config/codec.ts';
import type {
  DesignQRConfigInput,
  DesignQRConfigV1,
} from '../config/types.ts';
import { isDesignQRInstanceId } from './protocol.ts';

export const DESIGN_QR_EMBED_ORIGIN = 'https://design.johnson7543.com';
export const DESIGN_QR_EMBED_PATH = '/qr/embed';

export interface CreateDesignQREmbedUrlOptions {
  origin?: string;
  instanceId?: string;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function parseHttpUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('DesignQR embed origin must use HTTP or HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new TypeError('DesignQR embed origin must not include credentials.');
  }
  return parsed;
}

export function createDesignQREmbedUrl(
  config: DesignQRConfigV1 | DesignQRConfigInput,
  options: CreateDesignQREmbedUrlOptions = {}
): string {
  const origin = parseHttpUrl(options.origin ?? DESIGN_QR_EMBED_ORIGIN);
  const url = new URL(DESIGN_QR_EMBED_PATH, origin.origin);
  url.searchParams.set('config', encodeDesignQRConfig(config));

  if (options.instanceId !== undefined) {
    if (!isDesignQRInstanceId(options.instanceId)) {
      throw new TypeError('DesignQR instanceId must contain 1-128 URL-safe characters.');
    }
    url.searchParams.set('instanceId', options.instanceId);
  }

  return url.toString();
}

export function createDesignQRIframeMarkup(embedUrl: string): string {
  const source = escapeHtmlAttribute(parseHttpUrl(embedUrl).toString());
  return `<iframe
  src="${source}"
  title="Interactive DesignQR"
  width="600"
  height="600"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer"
></iframe>`;
}
