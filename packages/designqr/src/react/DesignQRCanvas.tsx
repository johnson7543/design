import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  AutoRotateDirection,
  DesignQRLogoOptions,
  ResolvedTreeTheme,
} from '../config/types.ts';
import { DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT } from '../config/defaults.ts';
import { RenderManager } from '../renderer/RenderManager.ts';
import {
  PresentationSurface,
  type PresentationSurfaceState,
} from '../renderer/PresentationSurface.ts';
import type { TreeData } from '../designs/tree/treeBuilder.ts';
import { VIEW_TRANSITION_SPEED_DEFAULT } from '../designs/tree/constants.ts';

export interface DesignQRCanvasHandle {
  exportImage(): Promise<Blob>;
  resetRotation(): void;
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
      autoRotate = false,
      autoRotateDirection = 'clockwise',
      transitionSpeed = VIEW_TRANSITION_SPEED_DEFAULT,
      logo = false,
      transparentBackground = false,
      backgroundTop,
      backgroundBottom,
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
        return surface.exportImage();
      },
      resetRotation: () => renderManagerRef.current?.resetRotation(),
      pause: () => {
        manuallyPausedRef.current = true;
        syncPlayback();
      },
      resume: () => {
        manuallyPausedRef.current = false;
        syncPlayback();
      },
    }), [syncPlayback]);

    const handleResize = useCallback(() => {
      if (!containerRef.current || !renderManagerRef.current) return;
      const width = containerRef.current.clientWidth || window.innerWidth;
      const height = containerRef.current.clientHeight || window.innerHeight;
      if (width > 0 && height > 0) {
        renderManagerRef.current.resize(width, height);
        presentationSurfaceRef.current?.resize();
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
      onRendererErrorRef.current = onRendererError;
    }, [onRendererError]);

    useBrowserLayoutEffect(() => {
      presentationSurfaceRef.current?.setState({
        backgroundTop,
        backgroundBottom,
        transparentBackground,
        qrGridSize: treeData.gridSize,
        qrLightColor: theme.groundColor,
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
      : `DesignQR tree${logoDescription}`;
    const accessibleLabel = ariaLabel ?? (canToggle
      ? `Show ${viewMode === 'scan' ? 'design' : 'QR'} view. ${presentationLabel}`
      : presentationLabel);
    const interactionClasses = `${canDrag ? ' designqr-can-drag' : ''}${
      canToggle ? ' designqr-can-toggle' : ''
    }`;

    return (
      <div
        ref={containerRef}
        className={`designqr-root designqr-canvas-wrapper view-${viewMode}${interactionClasses}${className ? ` ${className}` : ''}`}
        style={style}
        role={canToggle ? 'button' : 'img'}
        tabIndex={canToggle ? 0 : undefined}
        aria-keyshortcuts={canToggle ? 'Enter Space' : undefined}
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
