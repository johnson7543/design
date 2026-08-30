import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  DesignQR,
  decodeDesignQRConfig,
  normalizeDesignQRConfig,
  type DesignQRConfigV1,
  type DesignQRError,
  type DesignQRErrorCode,
  type DesignQRHandle,
  type DesignQRView,
} from 'designqr';
import {
  DESIGN_QR_MAX_EXPORT_BYTES,
  createDesignQRInstanceId,
  createDesignQRMessage,
  isDesignQRInstanceId,
  isDesignQRParentMessage,
  type DesignQRChildMessage,
  type DesignQREmbedErrorPayload,
} from 'designqr/embed';
import 'designqr/style.css';
import './design-qr-embed.css';

interface InitialEmbedState {
  config: DesignQRConfigV1 | null;
  error: DesignQREmbedErrorPayload | null;
  instanceId: string;
}

const DESIGN_QR_ERROR_CODES: ReadonlySet<string> = new Set<DesignQRErrorCode>([
  'INVALID_CONFIG',
  'UNSUPPORTED_DESIGN',
  'QR_GENERATION_FAILED',
  'WEBGL_UNAVAILABLE',
  'WEBGL_CONTEXT_LOST',
  'EXPORT_FAILED',
]);

function toErrorPayload(
  cause: unknown,
  fallbackCode: DesignQRErrorCode,
  fallbackMessage: string
): DesignQREmbedErrorPayload {
  if (typeof cause !== 'object' || cause === null) {
    return { code: fallbackCode, message: fallbackMessage };
  }

  const candidate = cause as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate.code === 'string' && DESIGN_QR_ERROR_CODES.has(candidate.code)
      ? candidate.code as DesignQRErrorCode
      : fallbackCode,
    message: typeof candidate.message === 'string' && candidate.message.length > 0
      ? candidate.message.slice(0, 512)
      : fallbackMessage,
  };
}

function readInitialState(): InitialEmbedState {
  const search = new URLSearchParams(window.location.search);
  const requestedInstanceId = search.get('instanceId');
  const instanceId = isDesignQRInstanceId(requestedInstanceId)
    ? requestedInstanceId
    : createDesignQRInstanceId();
  const encoded = search.get('config');

  if (!encoded) {
    return {
      config: null,
      error: {
        code: 'INVALID_CONFIG',
        message: 'Invalid DesignQR configuration',
      },
      instanceId,
    };
  }

  const decoded = decodeDesignQRConfig(encoded);
  if (!decoded.ok) {
    return {
      config: null,
      error: {
        code: decoded.error.code,
        message: 'Invalid DesignQR configuration',
      },
      instanceId,
    };
  }

  return { config: decoded.value, error: null, instanceId };
}

export default function DesignQREmbedRoute() {
  const [initialState] = useState(readInitialState);
  const [config, setConfig] = useState(initialState.config);
  const [view, setView] = useState<DesignQRView>(
    initialState.config?.view.initial ?? 'design'
  );
  const [runtimeError, setRuntimeError] = useState<DesignQREmbedErrorPayload | null>(null);
  const playerRef = useRef<DesignQRHandle>(null);
  const playerReadyRef = useRef(false);
  const parentOriginRef = useRef<string | null>(null);
  const announcedViewRef = useRef(view);
  const activeExportIdsRef = useRef(new Set<string>());

  const postToParent = useCallback((
    message: DesignQRChildMessage,
    targetOrigin = parentOriginRef.current ?? '*'
  ) => {
    if (window.parent === window) return;
    window.parent.postMessage(message, targetOrigin);
  }, []);

  const postReady = useCallback((targetOrigin?: string) => {
    if (!playerReadyRef.current) return;
    postToParent(
      createDesignQRMessage(initialState.instanceId, 'designqr:ready', { view }),
      targetOrigin
    );
  }, [initialState.instanceId, postToParent, view]);

  const postError = useCallback((
    error: DesignQREmbedErrorPayload,
    targetOrigin?: string
  ) => {
    postToParent(
      createDesignQRMessage(initialState.instanceId, 'designqr:error', { error }),
      targetOrigin
    );
  }, [initialState.instanceId, postToParent]);

  useEffect(() => {
    if (!initialState.error) return;
    postError(initialState.error);
  }, [initialState.error, postError]);

  useEffect(() => {
    if (announcedViewRef.current === view) return;
    announcedViewRef.current = view;
    postToParent(
      createDesignQRMessage(initialState.instanceId, 'designqr:view-change', { view })
    );
  }, [initialState.instanceId, postToParent, view]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent
        || !isDesignQRParentMessage(event.data)
      ) {
        return;
      }

      const message = event.data;
      if (message.type === 'designqr:connect') {
        if (
          message.instanceId !== '*'
          && message.instanceId !== initialState.instanceId
        ) {
          return;
        }
        parentOriginRef.current = event.origin;
        if (initialState.error && !config) {
          postError(initialState.error, event.origin);
        } else {
          postReady(event.origin);
        }
        return;
      }

      if (message.instanceId !== initialState.instanceId) return;
      if (
        parentOriginRef.current !== null
        && parentOriginRef.current !== event.origin
      ) {
        return;
      }
      parentOriginRef.current = event.origin;

      switch (message.type) {
        case 'designqr:set-config': {
          try {
            const nextConfig = normalizeDesignQRConfig(message.payload.config);
            setRuntimeError(null);
            setConfig(nextConfig);
            setView(nextConfig.view.initial);
          } catch (cause) {
            postError(toErrorPayload(
              cause,
              'INVALID_CONFIG',
              'The DesignQR configuration is invalid.'
            ), event.origin);
          }
          break;
        }
        case 'designqr:set-view':
          setView(message.payload.view);
          break;
        case 'designqr:pause':
          playerRef.current?.pause();
          break;
        case 'designqr:resume':
          playerRef.current?.resume();
          break;
        case 'designqr:reset-rotation':
          playerRef.current?.resetRotation();
          break;
        case 'designqr:export-image': {
          const { requestId } = message.payload;
          if (activeExportIdsRef.current.has(requestId)) {
            postToParent(createDesignQRMessage(
              initialState.instanceId,
              'designqr:export-error',
              {
                requestId,
                error: {
                  code: 'INVALID_MESSAGE',
                  message: 'The export request ID is already active.',
                } satisfies DesignQREmbedErrorPayload,
              }
            ), event.origin);
            break;
          }

          activeExportIdsRef.current.add(requestId);
          void (async () => {
            try {
              if (!playerRef.current) {
                throw new Error('The DesignQR player is not ready.');
              }
              const blob = await playerRef.current.exportImage();
              if (blob.type !== 'image/png') {
                throw new Error('The DesignQR export is not a PNG image.');
              }
              if (blob.size > DESIGN_QR_MAX_EXPORT_BYTES) {
                postToParent(createDesignQRMessage(
                  initialState.instanceId,
                  'designqr:export-error',
                  {
                    requestId,
                    error: {
                      code: 'EXPORT_TOO_LARGE',
                      message: 'The DesignQR export exceeds the maximum response size.',
                    } satisfies DesignQREmbedErrorPayload,
                  }
                ), event.origin);
                return;
              }
              postToParent(createDesignQRMessage(
                initialState.instanceId,
                'designqr:export-result',
                { requestId, blob }
              ), event.origin);
            } catch (cause) {
              postToParent(createDesignQRMessage(
                initialState.instanceId,
                'designqr:export-error',
                {
                  requestId,
                  error: toErrorPayload(
                    cause,
                    'EXPORT_FAILED',
                    'The current DesignQR frame could not be exported.'
                  ),
                }
              ), event.origin);
            } finally {
              activeExportIdsRef.current.delete(requestId);
            }
          })();
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    config,
    initialState.error,
    initialState.instanceId,
    postError,
    postReady,
    postToParent,
  ]);

  const handleReady = useCallback(() => {
    playerReadyRef.current = true;
    postReady();
  }, [postReady]);

  const handlePlayerError = useCallback((error: DesignQRError) => {
    const payload = toErrorPayload(
      error,
      'WEBGL_UNAVAILABLE',
      'DesignQR could not render in this browser.'
    );
    postError(payload);
    if (
      error.code === 'WEBGL_UNAVAILABLE'
      || error.code === 'WEBGL_CONTEXT_LOST'
    ) {
      setRuntimeError(payload);
    }
  }, [postError]);

  const handleViewChange = useCallback((nextView: DesignQRView) => {
    setView(nextView);
  }, []);

  if (!config || runtimeError) {
    return (
      <main className="designqr-embed-route designqr-embed-error" role="alert">
        {runtimeError?.message ?? 'Invalid DesignQR configuration'}
      </main>
    );
  }

  return (
    <main className="designqr-embed-route">
      <DesignQR
        ref={playerRef}
        value={config.value}
        design={config.design.type}
        tree={config.design.options}
        theme={config.theme.type === 'preset'
          ? config.theme.preset
          : config.theme.value}
        view={view}
        details={config.details}
        interaction={config.interaction}
        quality={config.quality}
        className="designqr-embed-player"
        ariaLabel="Interactive DesignQR"
        onReady={handleReady}
        onViewChange={handleViewChange}
        onError={handlePlayerError}
      />
    </main>
  );
}
