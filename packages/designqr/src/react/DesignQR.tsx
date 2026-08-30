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
  type DesignQRThemePreset,
  type DesignQRView,
} from '../config/types.ts';
import { normalizeDesignQRConfig } from '../config/normalize.ts';
import {
  SEASONS,
  hexToRgbTuple,
} from '../designs/tree/constants.ts';
import { generateQRMatrix } from '../designs/tree/qr.ts';
import { build3DTree, type TreeData } from '../designs/tree/treeBuilder.ts';
import { resolveTreeTitleColor } from '../designs/tree/themes.ts';
import {
  DesignQRCanvas,
  type DesignQRCanvasHandle,
} from './DesignQRCanvas.tsx';
import type { DesignQRHandle, DesignQRProps } from './types.ts';

interface PreparedDesignQR {
  config: DesignQRConfigV1;
  seasonId: number;
  backgroundTop: string;
  backgroundBottom: string;
  customColor: [number, number, number];
  titleColor: string;
}

type PreparationResult =
  | { ok: true; value: PreparedDesignQR }
  | { ok: false; error: DesignQRError };

const PRESET_SEASON_IDS: Readonly<Record<DesignQRThemePreset, number>> = {
  spring: 0,
  summer: 1,
  autumn: 2,
  winter: 3,
};

function rgbTupleToHex(color: [number, number, number]): string {
  return `#${color
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

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
  theme: DesignQRProps['theme'];
  view: DesignQRView;
  details: DesignQRProps['details'];
  interaction: DesignQRProps['interaction'];
  quality: DesignQRProps['quality'];
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
      quality: input.quality,
    });
    const seasonId = config.theme.type === 'preset'
      ? PRESET_SEASON_IDS[config.theme.preset]
      : 0;
    const season = SEASONS[seasonId] ?? SEASONS[0];
    const customTheme = config.theme.type === 'custom' ? config.theme.value : null;

    return {
      ok: true,
      value: {
        config,
        seasonId,
        backgroundTop: customTheme?.skyTop ?? rgbTupleToHex(season.skyTop),
        backgroundBottom: customTheme?.skyBottom ?? rgbTupleToHex(season.skyBottom),
        customColor: customTheme
          ? hexToRgbTuple(customTheme.foliageColor)
          : hexToRgbTuple(season.foliageHex),
        titleColor: resolveTreeTitleColor(config.theme),
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
      quality = 'high',
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
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
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

    useEffect(() => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const updatePreference = () => setPrefersReducedMotion(media.matches);
      updatePreference();
      media.addEventListener('change', updatePreference);
      return () => media.removeEventListener('change', updatePreference);
    }, []);

    const prepared = useMemo(
      () => prepareDesignQR({
        value,
        design,
        tree,
        theme,
        view: activeView,
        details,
        interaction,
        quality,
      }),
      [activeView, design, details, interaction, quality, theme, tree, value]
    );

    const preparedValue = prepared.ok ? prepared.value.config.value : null;
    const preparedSeed = prepared.ok
      ? prepared.value.config.design.options.seed
      : null;
    const preparedShape = prepared.ok
      ? prepared.value.config.design.options.shape
      : null;
    const preparedTree = useMemo<
      { ok: true; value: TreeData } | { ok: false; error: DesignQRError } | null
    >(() => {
      if (preparedValue === null || preparedSeed === null || preparedShape === null) {
        return null;
      }
      try {
        const matrix = generateQRMatrix(preparedValue, 'M');
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
    }, [preparedSeed, preparedShape, preparedValue]);

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

    if (!prepared.ok || !preparedTree?.ok) {
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
    const customTheme = config.theme.type === 'custom' ? config.theme.value : null;
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
        seasonId={prepared.value.seasonId}
        customTheme={customTheme}
        customColor={prepared.value.customColor}
        customStrength={customTheme ? 1 : 0}
        viewMode={activeView === 'qr' ? 'scan' : '3d'}
        onToggleScanMode={() => requestView(activeView === 'qr' ? 'design' : 'qr')}
        onRendererReady={() => onReadyRef.current?.()}
        onRendererError={handleRendererError}
        enableMotionBlur={config.interaction.motionBlur && !prefersReducedMotion}
        dragToRotate={config.interaction.dragToRotate}
        tapToToggleView={config.interaction.tapToToggleView}
        autoRotate={config.interaction.autoRotate && !prefersReducedMotion}
        quality={config.quality}
        backgroundTop={prepared.value.backgroundTop}
        backgroundBottom={prepared.value.backgroundBottom}
        showQrDetails={detailsVisible}
        qrTitle={config.details.title}
        showQrContent={config.details.showValue}
        qrValue={config.value}
        qrBorderEnabled={border !== false}
        qrBorderPadding={border === false ? undefined : border.padding}
        qrTitleColor={prepared.value.titleColor}
        className={className}
        style={style}
        ariaLabel={ariaLabel}
      />
    );
  }
);
