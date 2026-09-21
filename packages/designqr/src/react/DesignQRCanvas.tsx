import { CITY_PRESETS } from '../designs/city/presets.ts';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { SHIBUYA_PALETTE } from '../designs/city/palette.ts';
import type {
  AutoRotateDirection,
  DesignQRLogoOptions,
  ResolvedTreeTheme,
} from '../config/types.ts';
import { DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT } from '../config/defaults.ts';
import { RenderManager } from '../renderer/RenderManager.ts';
import { CITY_PRESENTATION_STYLE_DEFAULTS } from '../renderer/presentationStyles.ts';
import {
  PresentationSurface,
  type PresentationSurfaceState,
} from '../renderer/PresentationSurface.ts';
import type { TreeData } from '../designs/tree/treeBuilder.ts';
import { VIEW_TRANSITION_SPEED_DEFAULT } from '../designs/tree/constants.ts';
import type { DesignQRZoomOptions } from './types.ts';
import type { PreviewZoomController } from '../interaction/PreviewZoomController.ts';
import { boundPreviewZoom, DEFAULT_PREVIEW_ZOOM, normalizePreviewScale, normalizePreviewZoomMax,
  type PreviewZoom } from '../interaction/previewZoom.ts';

export interface DesignQRCanvasHandle {
  exportImage(): Promise<Blob>;
  resetRotation(): void;
  setZoom(scale: number): void;
  resetZoom(): void;
  pause(): void;
  resume(): void;
}

export interface DesignQRCanvasProps {
  treeData: TreeData;
  theme: ResolvedTreeTheme;
  viewMode: '3d' | 'scan';
  onToggleScanMode?: () => void;
  onRendererReady?: (manager: RenderManager) => void;
  onRendererError?: (error: unknown) => void;
  prefersReducedMotion?: boolean;
  enableMotionBlur?: boolean;
  dragToRotate?: boolean;
  tapToToggleView?: boolean;
  zoom?: boolean | DesignQRZoomOptions;
  /** Editor-only inspection limit (1–10x). Public DesignQR players retain 3x. */
  previewZoomMax?: number;
  onZoomChange?: (scale: number) => void;
  autoRotate?: boolean;
  autoRotateDirection?: AutoRotateDirection;
  transitionSpeed?: number;
  logo?: false | Required<DesignQRLogoOptions>;
  transparentBackground?: boolean;
  backgroundTop: string;
  backgroundBottom: string;
  showQrDetails?: boolean;
  qrTitle?: string;
  qrTitleScale?: number;
  showQrContent?: boolean;
  qrContentScale?: number;
  qrValue: string;
  qrBorderEnabled?: boolean;
  qrBorderPadding?: number;
  qrTitleColor?: string;
  /**
   * Optional editor integration scale for the settled QR artwork. The 3D
   * endpoint remains at 1x and the renderer blends toward this value while
   * changing views. Values are constrained to the scan-safe 0.5-1 range.
   */
  qrArtworkScale?: number;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

interface PointerGesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  movedBeyondTapThreshold: boolean;
  canDrag: boolean;
  canToggle: boolean;
}

const TAP_MOVE_THRESHOLD = 8;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getInitialReducedMotionPreference(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const useBrowserLayoutEffect = typeof window === 'undefined'
  ? useEffect
  : useLayoutEffect;

export const DesignQRCanvas = forwardRef<DesignQRCanvasHandle, DesignQRCanvasProps>(
  function DesignQRCanvas(
    {
      treeData,
      theme,
      viewMode,
      onToggleScanMode,
      onRendererReady,
      onRendererError,
      prefersReducedMotion,
      enableMotionBlur = true,
      dragToRotate = true,
      tapToToggleView = true,
      zoom = false,
      previewZoomMax,
      onZoomChange,
      autoRotate = false,
      autoRotateDirection = 'clockwise',
      transitionSpeed = VIEW_TRANSITION_SPEED_DEFAULT,
      logo = false,
      transparentBackground = false,
      backgroundTop: artworkBackgroundTop,
      backgroundBottom: artworkBackgroundBottom,
      showQrDetails = false,
      qrTitle = '',
      qrTitleScale = DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
      showQrContent = false,
      qrContentScale = DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
      qrValue,
      qrBorderEnabled = false,
      qrBorderPadding = 16,
      qrTitleColor = '#98596e',
      qrArtworkScale = 1,
      className,
      style,
      ariaLabel,
    },
    ref
  ) {
    const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(
      getInitialReducedMotionPreference
    );
    const shouldReduceMotion = prefersReducedMotion
      ?? systemPrefersReducedMotion;
    const qrLightColorTreatment = treeData.city ? 'exact' : 'lifted';
    const protectQrCardMargin = !!treeData.city;
    const nightGlow = treeData.city?.preset === 'tokyo-tower' ? 'landmark'
      : treeData.city?.preset === 'dotonbori' ? 'waterfront' : undefined;
    // Match Shibuya's light scan atmosphere at the QR endpoint. The existing
    // presentation gradient handles forward/reverse and reduced-motion changes.
    const nightScan = treeData.city && CITY_PRESETS[treeData.city.preset ?? 'shibuya'].night && viewMode === 'scan';
    const backgroundTop = nightScan ? SHIBUYA_PALETTE.sky : artworkBackgroundTop;
    const backgroundBottom = nightScan ? SHIBUYA_PALETTE.dusk : artworkBackgroundBottom;
    const containerRef = useRef<HTMLDivElement>(null);
    const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
    const presentationCanvasRef = useRef<HTMLCanvasElement>(null);
    const transformProbeRef = useRef<HTMLDivElement>(null);
    const renderManagerRef = useRef<RenderManager | null>(null);
    const presentationSurfaceRef = useRef<PresentationSurface | null>(null);
    const initialRenderPropsRef = useRef({
      treeData,
      theme,
      viewMode,
      onRendererReady,
      prefersReducedMotion: shouldReduceMotion,
      autoRotate,
      autoRotateDirection,
      transitionSpeed,
      logo,
    });
    const initialPresentationStateRef = useRef<PresentationSurfaceState>({
      backgroundTop,
      backgroundBottom,
      transparentBackground,
      qrGridSize: treeData.gridSize,
      qrLightColor: theme.groundColor,
      qrLightColorTreatment,
      protectQrCardMargin,
      nightGlow,
      showQrDetails,
      title: qrTitle,
      titleScale: qrTitleScale,
      showValue: showQrContent,
      contentScale: qrContentScale,
      value: qrValue,
      borderEnabled: qrBorderEnabled,
      borderPadding: qrBorderPadding,
      titleColor: qrTitleColor,
      prefersReducedMotion: shouldReduceMotion,
      qrArtworkScale,
    });
    const enableMotionBlurRef = useRef(
      enableMotionBlur && !shouldReduceMotion
    );
    const onRendererErrorRef = useRef(onRendererError);
    const manuallyPausedRef = useRef(false);
    const contextAvailableRef = useRef(true);
    const documentVisibleRef = useRef(
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
    );
    const intersectingRef = useRef(true);

    const pointerGestureRef = useRef<PointerGesture | null>(null);
    const zoomOptions = typeof zoom === 'object' && zoom !== null ? zoom : undefined;
    const zoomEnabled = zoom === true || zoomOptions !== undefined;
    const pinchEnabled = zoomEnabled && zoomOptions?.pinch !== false;
    const wheelEnabled = zoomOptions?.wheel === true;
    const zoomMax = normalizePreviewZoomMax(previewZoomMax);
    const zoomMaxRef = useRef(zoomMax);
    const zoomEnabledRef = useRef(zoomEnabled);
    const onZoomChangeRef = useRef(onZoomChange);
    const zoomControllerRef = useRef<PreviewZoomController | null>(null);
    const zoomViewRef = useRef<Readonly<PreviewZoom>>(DEFAULT_PREVIEW_ZOOM);
    const pendingZoomScaleRef = useRef<number | null>(null);

    useBrowserLayoutEffect(() => {
      zoomEnabledRef.current = zoomEnabled;
      zoomMaxRef.current = zoomMax;
      onZoomChangeRef.current = onZoomChange;
    }, [zoomEnabled, zoomMax, onZoomChange]);

    const applyZoom = useCallback((next: Readonly<PreviewZoom>) => {
      const previous = zoomViewRef.current;
      zoomViewRef.current = next;
      const surface = presentationSurfaceRef.current;
      const manager = renderManagerRef.current;
      if (surface && manager) {
        surface.setPreviewZoom(next);
        manager.onBeforeRender = surface.hasPreviewZoom
          ? () => manager.setPreviewProjection(surface.getPreviewProjection())
          : undefined;
        if (!surface.hasPreviewZoom) manager.setPreviewProjection(null);
        // Running players pick this up on their existing frame. A paused player
        // redraws the same scene without advancing animation or allocating pixels.
        if (contextAvailableRef.current) manager.invalidatePreview();
      }
      const container = containerRef.current;
      if (container) {
        container.dataset.zoomScale = String(next.scale);
        container.dataset.zoomX = String(next.x);
        container.dataset.zoomY = String(next.y);
      }
      if (next.scale !== previous.scale) onZoomChangeRef.current?.(next.scale);
    }, []);

    useEffect(() => {
      if (
        prefersReducedMotion !== undefined
        || typeof window.matchMedia !== 'function'
      ) {
        return;
      }

      const media = window.matchMedia(REDUCED_MOTION_QUERY);
      const updatePreference = () => {
        setSystemPrefersReducedMotion(media.matches);
      };
      updatePreference();

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', updatePreference);
        return () => media.removeEventListener('change', updatePreference);
      }

      media.addListener(updatePreference);
      return () => media.removeListener(updatePreference);
    }, [prefersReducedMotion]);

    const syncPlayback = useCallback(() => {
      const manager = renderManagerRef.current;
      if (!manager) return;

      if (
        manuallyPausedRef.current
        || !contextAvailableRef.current
        || !documentVisibleRef.current
        || !intersectingRef.current
      ) {
        manager.pause();
      } else {
        manager.resume();
      }
    }, []);

    useImperativeHandle(ref, () => ({
      exportImage: async () => {
        const surface = presentationSurfaceRef.current;
        if (!surface) {
          throw new Error('The DesignQR presentation is not ready to export.');
        }
        const manager = renderManagerRef.current;
        return manager ? manager.withBaseFrame(() => surface.exportImage()) : surface.exportImage();
      },
      resetRotation: () => renderManagerRef.current?.resetRotation(),
      setZoom: (scale) => {
        if (!zoomEnabledRef.current) return;
        if (zoomControllerRef.current) zoomControllerRef.current.setScale(scale);
        else pendingZoomScaleRef.current = normalizePreviewScale(scale, zoomMaxRef.current);
      },
      resetZoom: () => {
        pendingZoomScaleRef.current = null;
        if (zoomControllerRef.current) zoomControllerRef.current.reset();
        else applyZoom(DEFAULT_PREVIEW_ZOOM);
      },
      pause: () => {
        manuallyPausedRef.current = true;
        syncPlayback();
      },
      resume: () => {
        manuallyPausedRef.current = false;
        syncPlayback();
      },
    }), [applyZoom, syncPlayback]);

    const handleResize = useCallback(() => {
      if (!containerRef.current || !renderManagerRef.current) return;
      const width = containerRef.current.clientWidth || window.innerWidth;
      const height = containerRef.current.clientHeight || window.innerHeight;
      if (width > 0 && height > 0) {
        renderManagerRef.current.resize(width, height);
        presentationSurfaceRef.current?.resize();
        zoomControllerRef.current?.resize();
        // Resizing clears the source buffer even at the default zoom. Redraw
        // a paused frame after both canvases resize without advancing activity.
        renderManagerRef.current.invalidatePreview();
      }
    }, []);

    useEffect(() => {
      const container = containerRef.current;
      const sourceCanvas = sourceCanvasRef.current;
      const presentationCanvas = presentationCanvasRef.current;
      const transformProbe = transformProbeRef.current;
      if (
        !container
        || !sourceCanvas
        || !presentationCanvas
        || !transformProbe
        || renderManagerRef.current
      ) {
        return;
      }

      const surface = new PresentationSurface(
        sourceCanvas,
        presentationCanvas,
        container,
        transformProbe,
        initialPresentationStateRef.current
      );
      const initial = initialRenderPropsRef.current;
      const manager = new RenderManager(sourceCanvas);
      presentationSurfaceRef.current = surface;
      manager.onProgressUpdate = (_progress, blurIntensity) => {
        surface.setViewProgress(_progress);
        surface.setBlurIntensity(enableMotionBlurRef.current ? blurIntensity : 0);
      };
      manager.onAfterRender = () => {
        surface.draw();
      };
      manager.onError = (error) => {
        onRendererErrorRef.current?.(error);
      };

      if (!manager.init()) {
        manager.destroy();
        presentationSurfaceRef.current = null;
        onRendererErrorRef.current?.(
          new Error('WebGL is unavailable for this DesignQR instance.')
        );
        return;
      }

      renderManagerRef.current = manager;
      manager.setReducedMotion(initial.prefersReducedMotion);
      manager.setTreeData(initial.treeData);
      manager.setTheme(initial.theme);
      manager.setTransitionSpeed(initial.transitionSpeed);
      const initialProgress = initial.viewMode === 'scan' ? 1 : 0;
      if (initial.prefersReducedMotion || initial.viewMode === 'scan') {
        manager.setProgressImmediate(initialProgress);
      } else {
        manager.setTargetProgress(initialProgress);
      }
      handleResize();
      manager.toggleTurntable(
        initial.autoRotate && !initial.prefersReducedMotion
      );
      manager.setTurntableDirection(initial.autoRotateDirection);
      manager.setLogo(initial.logo);
      manager.renderOnce();
      initial.onRendererReady?.(manager);
      syncPlayback();

      return () => {
        manager.destroy();
        renderManagerRef.current = null;
        presentationSurfaceRef.current = null;
      };
    }, [handleResize, syncPlayback]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      if (!zoomEnabled) {
        pendingZoomScaleRef.current = null;
        if (zoomViewRef.current !== DEFAULT_PREVIEW_ZOOM) applyZoom(DEFAULT_PREVIEW_ZOOM);
        delete container.dataset.zoomScale;
        delete container.dataset.zoomX;
        delete container.dataset.zoomY;
        return;
      }
      let disposed = false;
      void import('../interaction/PreviewZoomController.ts').then(({ createPreviewZoomController }) => {
        if (disposed) return;
        const initialZoom = boundPreviewZoom(zoomViewRef.current, container.getBoundingClientRect(), zoomMax);
        const controller = createPreviewZoomController(container, {
          pinch: pinchEnabled,
          wheel: wheelEnabled,
          maxScale: zoomMax,
          initial: initialZoom,
          onChange: applyZoom,
          cancelPrimaryGesture: () => {
            // The native pinch controller and React drag handler share this
            // element's capture. Clear even a not-yet-committed primary capture.
            pointerGestureRef.current = null;
            renderManagerRef.current?.setMousePosition(0, 0, false);
          },
          getAnchor: () => presentationSurfaceRef.current?.getPreviewAnchor() ?? { x: 0, y: 0 },
        });
        zoomControllerRef.current = controller;
        applyZoom(initialZoom);
        if (pendingZoomScaleRef.current !== null) {
          controller.setScale(pendingZoomScaleRef.current);
          pendingZoomScaleRef.current = null;
        }
      }).catch((error: unknown) => {
        if (!disposed) onRendererErrorRef.current?.(error);
      });
      return () => {
        disposed = true;
        zoomControllerRef.current?.destroy();
        zoomControllerRef.current = null;
      };
    }, [zoomEnabled, pinchEnabled, wheelEnabled, zoomMax, applyZoom]);

    useEffect(() => {
      onRendererErrorRef.current = onRendererError;
    }, [onRendererError]);

    useBrowserLayoutEffect(() => {
      presentationSurfaceRef.current?.setState({
        backgroundTop,
        backgroundBottom,
        transparentBackground,
        qrGridSize: treeData.gridSize,
        qrLightColor: theme.groundColor,
        qrLightColorTreatment,
        protectQrCardMargin,
        nightGlow,
        showQrDetails,
        title: qrTitle,
        titleScale: qrTitleScale,
        showValue: showQrContent,
        contentScale: qrContentScale,
        value: qrValue,
        borderEnabled: qrBorderEnabled,
        borderPadding: qrBorderPadding,
        titleColor: qrTitleColor,
        prefersReducedMotion: shouldReduceMotion,
        qrArtworkScale,
      });
    }, [
      backgroundBottom,
      backgroundTop,
      qrBorderEnabled,
      qrBorderPadding,
      qrContentScale,
      qrLightColorTreatment,
      protectQrCardMargin,
      nightGlow,
      qrTitle,
      qrTitleScale,
      qrTitleColor,
      qrValue,
      qrArtworkScale,
      shouldReduceMotion,
      showQrContent,
      showQrDetails,
      theme.groundColor,
      transparentBackground,
      treeData.gridSize,
    ]);

    useBrowserLayoutEffect(() => {
      enableMotionBlurRef.current = enableMotionBlur && !shouldReduceMotion;
      if (!enableMotionBlurRef.current) {
        presentationSurfaceRef.current?.setBlurIntensity(0);
      }
    }, [enableMotionBlur, shouldReduceMotion]);

    useBrowserLayoutEffect(() => {
      renderManagerRef.current?.setTreeData(treeData);
    }, [treeData]);

    useBrowserLayoutEffect(() => {
      renderManagerRef.current?.setTheme(theme);
    }, [theme]);

    useBrowserLayoutEffect(() => {
      const manager = renderManagerRef.current;
      if (!manager) return;

      manager.setReducedMotion(shouldReduceMotion);
      const progress = viewMode === 'scan' ? 1 : 0;
      if (shouldReduceMotion) {
        manager.toggleTurntable(false);
        manager.setProgressImmediate(progress);
        manager.renderOnce();
      } else {
        manager.setTargetProgress(progress);
      }
    }, [shouldReduceMotion, viewMode]);

    useBrowserLayoutEffect(() => {
      renderManagerRef.current?.toggleTurntable(
        autoRotate && !shouldReduceMotion
      );
    }, [autoRotate, shouldReduceMotion]);

    useBrowserLayoutEffect(() => {
      renderManagerRef.current?.setTurntableDirection(autoRotateDirection);
    }, [autoRotateDirection]);

    useBrowserLayoutEffect(() => {
      renderManagerRef.current?.setTransitionSpeed(transitionSpeed);
    }, [transitionSpeed]);

    useBrowserLayoutEffect(() => {
      renderManagerRef.current?.setLogo(logo);
    }, [logo]);

    useEffect(() => {
      const canvas = sourceCanvasRef.current;
      if (!canvas) return;

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        contextAvailableRef.current = false;
        syncPlayback();
        onRendererErrorRef.current?.(
          new Error('The DesignQR WebGL context was lost.')
        );
      };
      const handleContextRestored = () => {
        contextAvailableRef.current = true;
        renderManagerRef.current?.renderOnce();
        syncPlayback();
      };
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }, [syncPlayback]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleVisibility = () => {
        documentVisibleRef.current = document.visibilityState !== 'hidden';
        if (!documentVisibleRef.current) zoomControllerRef.current?.cancelGesture();
        syncPlayback();
      };
      document.addEventListener('visibilitychange', handleVisibility);

      const observer = typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            intersectingRef.current = entries[0]?.isIntersecting ?? true;
            syncPlayback();
          });
      observer?.observe(container);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        observer?.disconnect();
      };
    }, [syncPlayback]);

    useEffect(() => {
      if (!containerRef.current) return;
      const resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(handleResize);
      resizeObserver?.observe(containerRef.current);
      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        resizeObserver?.disconnect();
        window.removeEventListener('resize', handleResize);
      };
    }, [handleResize]);

    const canDrag = dragToRotate && viewMode === '3d';
    const canToggle = tapToToggleView && onToggleScanMode !== undefined;

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !event.isPrimary
        || event.button !== 0
        || (!canDrag && !canToggle)
        || pointerGestureRef.current !== null
      ) {
        return;
      }

      pointerGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        movedBeyondTapThreshold: false,
        canDrag,
        canToggle,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        pointerGestureRef.current = null;
        return;
      }
      if (canToggle) event.currentTarget.focus({ preventScroll: true });
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const manager = renderManagerRef.current;
      const container = containerRef.current;

      if (manager && container) {
        const point = presentationSurfaceRef.current?.clientPointToNdc(
          event.clientX,
          event.clientY
        );
        if (point) {
          manager.setMousePosition(point.x, point.y, true);
        }
      }

      const gesture = pointerGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      const wasDragging = gesture.movedBeyondTapThreshold;
      if (!wasDragging) {
        gesture.movedBeyondTapThreshold = Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY
        ) >= TAP_MOVE_THRESHOLD;
      }

      if (manager && gesture.canDrag && gesture.movedBeyondTapThreshold) {
        const deltaX = event.clientX - (wasDragging ? gesture.lastX : gesture.startX);
        const deltaY = event.clientY - (wasDragging ? gesture.lastY : gesture.startY);
        manager.handleDrag(deltaX, deltaY);
      }
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
    };

    const onPointerLeave = () => {
      renderManagerRef.current?.setMousePosition(0, 0, false);
    };

    const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Pointer capture may already be released by the browser.
      }
    };

    const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = pointerGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      pointerGestureRef.current = null;
      releasePointer(event);

      const movedBeyondTapThreshold = gesture.movedBeyondTapThreshold || Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY
      ) >= TAP_MOVE_THRESHOLD;
      if (gesture.canToggle && !movedBeyondTapThreshold) {
        onToggleScanMode?.();
      }
    };

    const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
      if (pointerGestureRef.current?.pointerId !== event.pointerId) return;
      pointerGestureRef.current = null;
      releasePointer(event);
    };

    const onLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
      if (pointerGestureRef.current?.pointerId === event.pointerId) {
        pointerGestureRef.current = null;
      }
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        !canToggle
        || event.repeat
        || (event.key !== 'Enter' && event.key !== ' ')
      ) {
        return;
      }

      event.preventDefault();
      onToggleScanMode?.();
    };

    const logoDescription = logo === false || logo.alt.length === 0
      ? ''
      : ` with ${logo.alt}`;
    const presentationLabel = viewMode === 'scan'
      ? `DesignQR code${qrTitle.trim() ? ` titled ${qrTitle.trim()}` : ''}${
          showQrContent ? ` for ${qrValue}` : ''
        }${logoDescription}`
      : `DesignQR ${treeData.city ? CITY_PRESETS[treeData.city.preset ?? 'shibuya'].accessibleName : 'tree'}${logoDescription}`;
    const accessibleLabel = ariaLabel ?? (canToggle
      ? `Show ${viewMode === 'scan' ? 'design' : 'QR'} view. ${presentationLabel}`
      : presentationLabel);
    const interactionClasses = `${canDrag ? ' designqr-can-drag' : ''}${
      canToggle ? ' designqr-can-toggle' : ''
    }${pinchEnabled ? ' designqr-can-pinch' : ''}`;

    return (
      <div
        ref={containerRef}
        className={`designqr-root designqr-canvas-wrapper view-${viewMode}${interactionClasses}${className ? ` ${className}` : ''}`}
        style={treeData.city ? { ...CITY_PRESENTATION_STYLE_DEFAULTS, ...style } : style}
        role={canToggle ? 'button' : zoomEnabled ? 'group' : 'img'}
        tabIndex={canToggle || zoomEnabled ? 0 : undefined}
        aria-keyshortcuts={[canToggle ? 'Enter Space' : '', zoomEnabled ? '+ - 0' : ''].filter(Boolean).join(' ') || undefined}
        aria-label={accessibleLabel}
        onKeyDown={canToggle ? onKeyDown : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        <canvas
          ref={sourceCanvasRef}
          className="designqr-webgl-canvas"
          aria-hidden="true"
        />
        <canvas
          ref={presentationCanvasRef}
          className="designqr-presentation-canvas"
          aria-hidden="true"
        />
        <div
          ref={transformProbeRef}
          className="designqr-stage-transform-probe"
          aria-hidden="true"
        />
      </div>
    );
  }
);
