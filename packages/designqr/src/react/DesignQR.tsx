import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DesignQRConfigError,
  type DesignQRConfigV1,
  type DesignQRError,
  type ResolvedTreeTheme,
  type DesignQRView,
} from '../config/types.ts';
import {
  normalizeDesignQRConfig,
  normalizeDesignQRTheme,
} from '../config/normalize.ts';
import {
  generateQRMatrix,
  resolveQRErrorCorrectionLevel,
} from '../designs/tree/qr.ts';
import { build3DTree, type TreeData } from '../designs/tree/treeBuilder.ts';
import { resolveTreeTheme } from '../designs/tree/themes.ts';
import {
  DesignQRCanvas,
  type DesignQRCanvasHandle,
} from './DesignQRCanvas.tsx';
import type { DesignQRHandle, DesignQRProps } from './types.ts';

interface PreparedDesignQR {
  config: DesignQRConfigV1;
}

interface PreparedTreeTheme {
  normalized: DesignQRConfigV1['theme'];
  resolved: ResolvedTreeTheme;
}

type PreparationResult =
  | { ok: true; value: PreparedDesignQR }
  | { ok: false; error: DesignQRError };

type ThemePreparationResult =
  | { ok: true; value: PreparedTreeTheme }
  | { ok: false; error: DesignQRError };

function toDesignQRError(
  cause: unknown,
  code: DesignQRError['code'] = 'INVALID_CONFIG',
  message = 'DesignQR could not prepare this configuration.'
): DesignQRError {
  if (cause instanceof DesignQRConfigError) return cause;
  return new DesignQRConfigError(code, message, cause);
}

function prepareDesignQR(input: {
  value: string;
  design: DesignQRProps['design'];
  tree: DesignQRProps['tree'];
  theme: DesignQRConfigV1['theme'];
  view: DesignQRView;
  details: DesignQRProps['details'];
  interaction: DesignQRProps['interaction'];
  logo: DesignQRProps['logo'];
  transparentBackground: DesignQRProps['transparentBackground'];
}): PreparationResult {
  try {
    const config = normalizeDesignQRConfig({
      schemaVersion: 1,
      value: input.value,
      design: {
        type: input.design ?? 'tree',
        options: input.tree,
      },
      theme: input.theme,
      view: { initial: input.view },
      details: input.details,
      interaction: input.interaction,
      logo: input.logo,
      transparentBackground: input.transparentBackground,
    });
    return {
      ok: true,
      value: { config },
    };
  } catch (cause) {
    return { ok: false, error: toDesignQRError(cause) };
  }
}

function prepareTreeTheme(
  theme: DesignQRProps['theme']
): ThemePreparationResult {
  try {
    const normalized = normalizeDesignQRTheme(theme);
    return {
      ok: true,
      value: {
        normalized,
        resolved: resolveTreeTheme(normalized),
      },
    };
  } catch (cause) {
    return { ok: false, error: toDesignQRError(cause) };
  }
}

export const DesignQR = forwardRef<DesignQRHandle, DesignQRProps>(
  function DesignQR(
    {
      value,
      design = 'tree',
      tree,
      theme = 'spring',
      view,
      defaultView,
      details,
      interaction,
      logo = false,
      transparentBackground = false,
      className,
      style,
      ariaLabel,
      onReady,
      onViewChange,
      onError,
    },
    ref
  ) {
    const [uncontrolledView, setUncontrolledView] = useState<DesignQRView>(
      () => defaultView ?? 'design'
    );
    const canvasRef = useRef<DesignQRCanvasHandle>(null);
    const onReadyRef = useRef(onReady);
    const onErrorRef = useRef(onError);
    const reportedErrorRef = useRef<DesignQRError | null>(null);
    const activeView = view ?? uncontrolledView;

    useEffect(() => {
      onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
      if (import.meta.env.DEV && view !== undefined && defaultView !== undefined) {
        console.warn('DesignQR received both view and defaultView; view takes precedence.');
      }
    }, [defaultView, view]);

    const preparedTheme = useMemo(() => prepareTreeTheme(theme), [theme]);
    const prepared = useMemo<PreparationResult>(() => {
      if (!preparedTheme.ok) {
        return { ok: false, error: preparedTheme.error };
      }
      return prepareDesignQR({
        value,
        design,
        tree,
        theme: preparedTheme.value.normalized,
        view: activeView,
        details,
        interaction,
        logo,
        transparentBackground,
      });
    }, [
      activeView,
      design,
      details,
      interaction,
      logo,
      preparedTheme,
      transparentBackground,
      tree,
      value,
    ]);

    const preparedValue = prepared.ok ? prepared.value.config.value : null;
    const preparedSeed = prepared.ok
      ? prepared.value.config.design.options.seed
      : null;
    const preparedShape = prepared.ok
      ? prepared.value.config.design.options.shape
      : null;
    const preparedLogoEnabled = prepared.ok
      ? prepared.value.config.logo !== false
      : false;
    const preparedTree = useMemo<
      { ok: true; value: TreeData } | { ok: false; error: DesignQRError } | null
    >(() => {
      if (preparedValue === null || preparedSeed === null || preparedShape === null) {
        return null;
      }
      try {
        const matrix = generateQRMatrix(
          preparedValue,
          resolveQRErrorCorrectionLevel(preparedLogoEnabled)
        );
        return {
          ok: true,
          value: build3DTree(matrix.modules, preparedSeed, preparedShape),
        };
      } catch (cause) {
        return {
          ok: false,
          error: toDesignQRError(
            cause,
            'QR_GENERATION_FAILED',
            'DesignQR could not generate a QR matrix for this value.'
          ),
        };
      }
    }, [preparedLogoEnabled, preparedSeed, preparedShape, preparedValue]);

    const activeError = !prepared.ok
      ? prepared.error
      : preparedTree?.ok === false
        ? preparedTree.error
        : null;

    useEffect(() => {
      if (!activeError) {
        reportedErrorRef.current = null;
        return;
      }
      if (reportedErrorRef.current !== activeError) {
        reportedErrorRef.current = activeError;
        onErrorRef.current?.(activeError);
      }
    }, [activeError]);

    const requestView = useCallback((nextView: DesignQRView) => {
      if (nextView !== 'design' && nextView !== 'qr') {
        const error = new DesignQRConfigError(
          'INVALID_CONFIG',
          'DesignQR view must be design or qr.'
        );
        onErrorRef.current?.(error);
        return;
      }
      if (view === undefined) setUncontrolledView(nextView);
      if (nextView !== activeView) onViewChange?.(nextView);
    }, [activeView, onViewChange, view]);

    const handleRendererError = useCallback((cause: unknown) => {
      const contextWasLost = cause instanceof Error
        && cause.message.toLowerCase().includes('context was lost');
      const error = toDesignQRError(
        cause,
        contextWasLost ? 'WEBGL_CONTEXT_LOST' : 'WEBGL_UNAVAILABLE',
        contextWasLost
          ? 'The DesignQR WebGL context was lost.'
          : 'WebGL is unavailable for this DesignQR instance.'
      );
      onErrorRef.current?.(error);
    }, []);

    useImperativeHandle(ref, () => ({
      setView: requestView,
      resetRotation: () => canvasRef.current?.resetRotation(),
      pause: () => canvasRef.current?.pause(),
      resume: () => canvasRef.current?.resume(),
      exportImage: async () => {
        try {
          if (!canvasRef.current) {
            throw new Error('The DesignQR presentation is not ready.');
          }
          return await canvasRef.current.exportImage();
        } catch (cause) {
          const error = toDesignQRError(
            cause,
            'EXPORT_FAILED',
            'The current DesignQR frame could not be exported.'
          );
          onErrorRef.current?.(error);
          throw error;
        }
      },
    }), [requestView]);

    if (!prepared.ok || !preparedTheme.ok || !preparedTree?.ok) {
      return (
        <div
          className={`designqr-root designqr-error${className ? ` ${className}` : ''}`}
          style={style}
          role="alert"
        >
          Invalid DesignQR configuration
        </div>
      );
    }

    const { config } = prepared.value;
    const border = config.details.border;
    const detailsVisible = activeView === 'qr' && (
      config.details.title.trim().length > 0
      || config.details.showValue
      || border !== false
    );

    return (
      <DesignQRCanvas
        ref={canvasRef}
        treeData={preparedTree.value}
        theme={preparedTheme.value.resolved}
        viewMode={activeView === 'qr' ? 'scan' : '3d'}
        onToggleScanMode={() => requestView(activeView === 'qr' ? 'design' : 'qr')}
        onRendererReady={() => onReadyRef.current?.()}
        onRendererError={handleRendererError}
        enableMotionBlur={config.interaction.motionBlur}
        dragToRotate={config.interaction.dragToRotate}
        tapToToggleView={config.interaction.tapToToggleView}
        autoRotate={config.interaction.autoRotate}
        autoRotateDirection={config.interaction.autoRotateDirection}
        transitionSpeed={config.interaction.transitionSpeed}
        logo={config.logo}
        transparentBackground={config.transparentBackground === true}
        backgroundTop={preparedTheme.value.resolved.skyTop}
        backgroundBottom={preparedTheme.value.resolved.skyBottom}
        showQrDetails={detailsVisible}
        qrTitle={config.details.title}
        showQrContent={config.details.showValue}
        qrValue={config.value}
        qrBorderEnabled={border !== false}
        qrBorderPadding={border === false ? undefined : border.padding}
        qrTitleColor={preparedTheme.value.resolved.titleColor}
        className={className}
        style={style}
        ariaLabel={ariaLabel}
      />
    );
  }
);
