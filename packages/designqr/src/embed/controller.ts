import { normalizeDesignQRConfig } from '../config/normalize.ts';
import type {
  DesignQRConfigInput,
  DesignQRConfigV1,
  DesignQRView,
} from '../config/types.ts';
import {
  DESIGN_QR_MAX_EXPORT_BYTES,
  createDesignQRMessage,
  createDesignQRRequestId,
  isDesignQRChildMessage,
  isDesignQRInstanceId,
  type DesignQRChildMessage,
  type DesignQREmbedErrorPayload,
  type DesignQRParentMessage,
} from './protocol.ts';

const DEFAULT_EXPORT_TIMEOUT_MS = 15_000;

export interface DesignQREmbedReadyEvent {
  instanceId: string;
  view: DesignQRView;
}

export interface DesignQREmbedControllerOptions {
  origin?: string;
  exportTimeoutMs?: number;
  maxExportBytes?: number;
  onReady?: (event: DesignQREmbedReadyEvent) => void;
  onViewChange?: (view: DesignQRView) => void;
  onError?: (error: DesignQREmbedErrorPayload) => void;
}

export interface DesignQREmbedController {
  readonly origin: string;
  setConfig(config: DesignQRConfigV1 | DesignQRConfigInput): void;
  setView(view: DesignQRView): void;
  pause(): void;
  resume(): void;
  resetRotation(): void;
  exportImage(): Promise<Blob>;
  destroy(): void;
}

interface PendingExport {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function normalizeOrigin(value: string, base?: string): string {
  const parsed = new URL(value, base);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('DesignQR iframe origin must use HTTP or HTTPS.');
  }
  if (parsed.origin === 'null') {
    throw new TypeError('DesignQR iframe origin must not be opaque.');
  }
  return parsed.origin;
}

function instanceIdFromIframe(iframe: HTMLIFrameElement): string | null {
  try {
    const url = new URL(iframe.src, globalThis.location?.href);
    const value = url.searchParams.get('instanceId');
    return isDesignQRInstanceId(value) ? value : null;
  } catch {
    return null;
  }
}

function childError(error: DesignQREmbedErrorPayload): Error {
  const result = new Error(error.message);
  result.name = `DesignQREmbedError:${error.code}`;
  return result;
}

export function connectDesignQREmbed(
  iframe: HTMLIFrameElement,
  options: DesignQREmbedControllerOptions = {}
): DesignQREmbedController {
  if (typeof window === 'undefined') {
    throw new Error('connectDesignQREmbed() is only available in a browser.');
  }

  const targetOrigin = normalizeOrigin(
    options.origin ?? iframe.src,
    window.location.href
  );
  const exportTimeoutMs = options.exportTimeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS;
  const maxExportBytes = options.maxExportBytes ?? DESIGN_QR_MAX_EXPORT_BYTES;
  if (!Number.isFinite(exportTimeoutMs) || exportTimeoutMs <= 0) {
    throw new TypeError('DesignQR exportTimeoutMs must be a positive number.');
  }
  if (!Number.isFinite(maxExportBytes) || maxExportBytes <= 0) {
    throw new TypeError('DesignQR maxExportBytes must be a positive number.');
  }

  let active = true;
  let ready = false;
  let observedLoad = false;
  let instanceId = instanceIdFromIframe(iframe);
  const queuedMessages: DesignQRParentMessage[] = [];
  const pendingExports = new Map<string, PendingExport>();

  const assertActive = () => {
    if (!active) throw new Error('The DesignQR iframe controller has been destroyed.');
  };

  const post = (message: DesignQRParentMessage) => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) return false;
    frameWindow.postMessage(message, targetOrigin);
    return true;
  };

  const postWhenReady = (message: DesignQRParentMessage) => {
    assertActive();
    if (!ready || !instanceId) {
      queuedMessages.push(message);
      return;
    }
    post({ ...message, instanceId });
  };

  const rejectPendingExports = (message: string) => {
    for (const pending of pendingExports.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    pendingExports.clear();
  };

  const sendConnect = () => {
    if (!active) return;
    post(createDesignQRMessage(instanceId ?? '*', 'designqr:connect'));
  };

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (
      !active
      || event.source !== iframe.contentWindow
      || event.origin !== targetOrigin
      || !isDesignQRChildMessage(event.data)
    ) {
      return;
    }

    const message: DesignQRChildMessage = event.data;
    if (instanceId && message.instanceId !== instanceId) return;
    if (!instanceId && message.type !== 'designqr:ready') return;

    if (message.type === 'designqr:ready') {
      instanceId = message.instanceId;
      ready = true;
      for (const queued of queuedMessages.splice(0)) {
        post({ ...queued, instanceId });
      }
      options.onReady?.({ instanceId, view: message.payload.view });
      return;
    }

    if (message.type === 'designqr:view-change') {
      options.onViewChange?.(message.payload.view);
      return;
    }

    if (message.type === 'designqr:error') {
      options.onError?.(message.payload.error);
      return;
    }

    const pending = pendingExports.get(message.payload.requestId);
    if (!pending) return;
    pendingExports.delete(message.payload.requestId);
    clearTimeout(pending.timeout);

    if (message.type === 'designqr:export-error') {
      pending.reject(childError(message.payload.error));
      return;
    }

    const { blob } = message.payload;
    if (blob.type !== 'image/png') {
      pending.reject(new Error('DesignQR iframe returned a non-PNG export.'));
      return;
    }
    if (blob.size > maxExportBytes) {
      pending.reject(new Error('DesignQR iframe export exceeded the permitted size.'));
      return;
    }
    pending.resolve(blob);
  };

  const handleLoad = () => {
    const shouldRejectPendingExports = observedLoad || ready;
    observedLoad = true;
    ready = false;
    instanceId = instanceIdFromIframe(iframe);
    if (shouldRejectPendingExports) {
      rejectPendingExports('The DesignQR iframe reloaded before export completed.');
    }
    sendConnect();
  };

  window.addEventListener('message', handleMessage);
  iframe.addEventListener('load', handleLoad);
  queueMicrotask(sendConnect);

  return {
    origin: targetOrigin,
    setConfig(config) {
      const normalized = normalizeDesignQRConfig(config);
      postWhenReady(createDesignQRMessage(
        instanceId ?? '*',
        'designqr:set-config',
        { config: normalized }
      ));
    },
    setView(view) {
      if (view !== 'design' && view !== 'qr') {
        throw new TypeError('DesignQR view must be design or qr.');
      }
      postWhenReady(createDesignQRMessage(
        instanceId ?? '*',
        'designqr:set-view',
        { view }
      ));
    },
    pause() {
      postWhenReady(createDesignQRMessage(instanceId ?? '*', 'designqr:pause'));
    },
    resume() {
      postWhenReady(createDesignQRMessage(instanceId ?? '*', 'designqr:resume'));
    },
    resetRotation() {
      postWhenReady(createDesignQRMessage(
        instanceId ?? '*',
        'designqr:reset-rotation'
      ));
    },
    exportImage() {
      assertActive();
      const requestId = createDesignQRRequestId();
      return new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingExports.delete(requestId);
          reject(new Error('DesignQR iframe export timed out.'));
        }, exportTimeoutMs);
        pendingExports.set(requestId, { resolve, reject, timeout });
        postWhenReady(createDesignQRMessage(
          instanceId ?? '*',
          'designqr:export-image',
          { requestId }
        ));
      });
    },
    destroy() {
      if (!active) return;
      active = false;
      ready = false;
      queuedMessages.length = 0;
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', handleLoad);
      rejectPendingExports('The DesignQR iframe controller was destroyed.');
    },
  };
}
