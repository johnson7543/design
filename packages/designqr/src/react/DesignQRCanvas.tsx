import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { DesignQRQuality, TreeTheme } from '../config/types.ts';
import { RenderManager } from '../renderer/RenderManager.ts';
import {
  PresentationSurface,
  type PresentationSurfaceState,
} from '../renderer/PresentationSurface.ts';
import type { TreeData } from '../designs/tree/treeBuilder.ts';

export interface DesignQRCanvasHandle {
  exportImage(): Promise<Blob>;
  resetRotation(): void;
  pause(): void;
  resume(): void;
}

export interface DesignQRCanvasProps {
  treeData: TreeData;
  seasonId: number;
  customTheme?: TreeTheme | null;
  customColor: [number, number, number];
  customStrength: number;
  viewMode: '3d' | 'scan';
  onToggleScanMode?: () => void;
  onRendererReady?: (manager: RenderManager) => void;
  onRendererError?: (error: unknown) => void;
  enableMotionBlur?: boolean;
  dragToRotate?: boolean;
  tapToToggleView?: boolean;
  autoRotate?: boolean;
  quality?: DesignQRQuality;
  backgroundTop: string;
  backgroundBottom: string;
  showQrDetails?: boolean;
  qrTitle?: string;
  showQrContent?: boolean;
  qrValue: string;
  qrBorderEnabled?: boolean;
  qrBorderPadding?: number;
  qrTitleColor?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export const DesignQRCanvas = forwardRef<DesignQRCanvasHandle, DesignQRCanvasProps>(
  function DesignQRCanvas(
    {
      treeData,
      seasonId,
      customTheme,
      customColor,
      customStrength,
      viewMode,
      onToggleScanMode,
      onRendererReady,
      onRendererError,
      enableMotionBlur = true,
      dragToRotate = true,
      tapToToggleView = true,
      autoRotate = false,
      quality = 'high',
      backgroundTop,
      backgroundBottom,
      showQrDetails = false,
      qrTitle = '',
      showQrContent = false,
      qrValue,
      qrBorderEnabled = false,
      qrBorderPadding = 16,
      qrTitleColor = '#98596e',
      className,
      style,
      ariaLabel,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
    const presentationCanvasRef = useRef<HTMLCanvasElement>(null);
    const transformProbeRef = useRef<HTMLDivElement>(null);
    const renderManagerRef = useRef<RenderManager | null>(null);
    const presentationSurfaceRef = useRef<PresentationSurface | null>(null);
    const initialRenderPropsRef = useRef({
      treeData,
      seasonId,
      customTheme,
      customColor,
      customStrength,
      viewMode,
      onRendererReady,
      onRendererError,
      autoRotate,
      quality,
    });
    const initialPresentationStateRef = useRef<PresentationSurfaceState>({
      backgroundTop,
      backgroundBottom,
      showQrDetails,
      title: qrTitle,
      showValue: showQrContent,
      value: qrValue,
      borderEnabled: qrBorderEnabled,
      borderPadding: qrBorderPadding,
      titleColor: qrTitleColor,
    });
    const enableMotionBlurRef = useRef(enableMotionBlur);
    const onRendererErrorRef = useRef(onRendererError);
    const manuallyPausedRef = useRef(false);
    const documentVisibleRef = useRef(
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
    );
    const intersectingRef = useRef(true);

    const isDragging = useRef(false);
    const pointerStart = useRef<{ x: number; y: number; time: number }>({
      x: 0,
      y: 0,
      time: 0,
    });
    const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const syncPlayback = useCallback(() => {
      const manager = renderManagerRef.current;
      if (!manager) return;

      if (
        manuallyPausedRef.current
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
      const manager = new RenderManager(sourceCanvas, initial.quality);
      presentationSurfaceRef.current = surface;
      manager.onProgressUpdate = (_progress, blurIntensity) => {
        surface.setBlurIntensity(enableMotionBlurRef.current ? blurIntensity : 0);
      };
      manager.onAfterRender = () => {
        surface.draw();
      };

      if (!manager.init()) {
        presentationSurfaceRef.current = null;
        onRendererErrorRef.current?.(
          new Error('WebGL is unavailable for this DesignQR instance.')
        );
        return;
      }

      renderManagerRef.current = manager;
      manager.setTreeData(initial.treeData);
      manager.setSeason(initial.seasonId);
      if (initial.customTheme) {
        manager.setCustomTheme(initial.customTheme);
      } else {
        manager.setCustomColor(initial.customColor, initial.customStrength);
      }
      if (initial.viewMode === 'scan') {
        manager.setProgressImmediate(1);
      } else {
        manager.setTargetProgress(0);
      }
      handleResize();
      manager.toggleTurntable(initial.autoRotate);
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

    useEffect(() => {
      presentationSurfaceRef.current?.setState({
        backgroundTop,
        backgroundBottom,
        showQrDetails,
        title: qrTitle,
        showValue: showQrContent,
        value: qrValue,
        borderEnabled: qrBorderEnabled,
        borderPadding: qrBorderPadding,
        titleColor: qrTitleColor,
      });
    }, [
      backgroundBottom,
      backgroundTop,
      qrBorderEnabled,
      qrBorderPadding,
      qrTitle,
      qrTitleColor,
      qrValue,
      showQrContent,
      showQrDetails,
    ]);

    useEffect(() => {
      enableMotionBlurRef.current = enableMotionBlur;
      if (!enableMotionBlur) {
        presentationSurfaceRef.current?.setBlurIntensity(0);
      }
    }, [enableMotionBlur]);

    useEffect(() => {
      renderManagerRef.current?.setTreeData(treeData);
    }, [treeData]);

    useEffect(() => {
      renderManagerRef.current?.setSeason(seasonId);
    }, [seasonId]);

    useEffect(() => {
      if (!renderManagerRef.current) return;
      if (customTheme) {
        renderManagerRef.current.setCustomTheme(customTheme);
      } else {
        renderManagerRef.current.setCustomTheme(null);
        renderManagerRef.current.setSeason(seasonId);
      }
    }, [customTheme, seasonId]);

    useEffect(() => {
      renderManagerRef.current?.setTargetProgress(viewMode === 'scan' ? 1 : 0);
    }, [viewMode]);

    useEffect(() => {
      renderManagerRef.current?.toggleTurntable(autoRotate);
    }, [autoRotate]);

    useEffect(() => {
      renderManagerRef.current?.setQuality(quality);
      handleResize();
    }, [handleResize, quality]);

    useEffect(() => {
      const canvas = sourceCanvasRef.current;
      if (!canvas) return;

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        renderManagerRef.current?.pause();
        onRendererErrorRef.current?.(
          new Error('The DesignQR WebGL context was lost.')
        );
      };
      const handleContextRestored = () => syncPlayback();
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
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);
      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
      };
    }, [handleResize]);

    const onPointerDown = (event: React.PointerEvent) => {
      isDragging.current = true;
      pointerStart.current = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
      lastPointer.current = { x: event.clientX, y: event.clientY };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: React.PointerEvent) => {
      const manager = renderManagerRef.current;
      const container = containerRef.current;
      if (!manager) return;

      if (container) {
        const point = presentationSurfaceRef.current?.clientPointToNdc(
          event.clientX,
          event.clientY
        );
        if (point) {
          manager.setMousePosition(point.x, point.y, true);
        }
      }

      if (!isDragging.current) return;
      const deltaX = event.clientX - lastPointer.current.x;
      const deltaY = event.clientY - lastPointer.current.y;
      lastPointer.current = { x: event.clientX, y: event.clientY };

      if (dragToRotate && viewMode === '3d') {
        manager.handleDrag(deltaX, deltaY);
      }
    };

    const onPointerLeave = () => {
      renderManagerRef.current?.setMousePosition(0, 0, false);
    };

    const onPointerUp = (event: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      try {
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }

      const moveDistance = Math.hypot(
        event.clientX - pointerStart.current.x,
        event.clientY - pointerStart.current.y
      );
      const duration = performance.now() - pointerStart.current.time;
      if (tapToToggleView && moveDistance < 8 && duration < 350) {
        onToggleScanMode?.();
      }
    };

    const canvasLabel = ariaLabel ?? (showQrDetails
      ? `DesignQR code${qrTitle.trim() ? ` titled ${qrTitle.trim()}` : ''}${
          showQrContent ? ` for ${qrValue}` : ''
        }`
      : 'Interactive DesignQR tree');

    return (
      <div
        ref={containerRef}
        className={`designqr-root designqr-canvas-wrapper view-${viewMode}${className ? ` ${className}` : ''}`}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas
          ref={sourceCanvasRef}
          className="designqr-webgl-canvas"
          aria-hidden="true"
        />
        <canvas
          ref={presentationCanvasRef}
          className="designqr-presentation-canvas"
          role="img"
          aria-label={canvasLabel}
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
