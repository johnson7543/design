import {
  boundPreviewZoom, DEFAULT_PREVIEW_ZOOM, normalizePreviewZoomMax, pinchPreview, PREVIEW_ZOOM_STEP,
  wheelPreviewScale, zoomPreviewAt, type PreviewPoint, type PreviewZoom,
} from './previewZoom.ts';

export interface PreviewZoomController {
  setScale(scale: number): void;
  reset(): void;
  resize(): void;
  cancelGesture(): void;
  destroy(): void;
}

/** Loaded only by players opting into viewing gestures; never changes artwork config. */
export function createPreviewZoomController(
  element: HTMLElement,
  options: {
    pinch: boolean;
    wheel: boolean;
    maxScale?: number;
    initial: Readonly<PreviewZoom>;
    onChange(view: Readonly<PreviewZoom>): void;
    cancelPrimaryGesture(): void;
    getAnchor(): PreviewPoint;
  },
): PreviewZoomController {
  const maxScale = normalizePreviewZoomMax(options.maxScale);
  let view = options.initial;
  const touches = new Map<number, PreviewPoint>();
  let ownsTouchGesture = false;
  let pinch: { view: Readonly<PreviewZoom>; points: [PreviewPoint, PreviewPoint] } | null = null;
  let pan: { id: number; point: PreviewPoint; view: Readonly<PreviewZoom> } | null = null;
  const size = () => element.getBoundingClientRect();
  const point = (event: { clientX: number; clientY: number }): PreviewPoint => {
    const rect = size();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const update = (next: Readonly<PreviewZoom>) => {
    if (view.scale === next.scale && view.x === next.x && view.y === next.y) return;
    view = next;
    options.onChange(next);
  };
  const setScale = (scale: number) => update(zoomPreviewAt(view, scale, options.getAnchor(), size(), maxScale));
  const reset = () => update(DEFAULT_PREVIEW_ZOOM);
  const pair = (): [PreviewPoint, PreviewPoint] => {
    const points = [...touches.values()];
    return [points[0], points[1]];
  };
  const startPinch = () => {
    pinch = touches.size >= 2 ? { view, points: pair() } : null;
  };
  const capture = (id: number) => {
    try { element.setPointerCapture(id); } catch { /* Browser-cancelled pointer. */ }
  };
  const release = (id: number) => {
    try {
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    } catch { /* Capture may already be released. */ }
  };
  const consume = (event: Event) => {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  };
  const setPanning = (active: boolean) => element.classList.toggle('designqr-is-panning', active);
  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      if (!options.pinch) return;
      touches.set(event.pointerId, point(event));
      if (touches.size >= 2 || ownsTouchGesture) {
        if (!ownsTouchGesture) options.cancelPrimaryGesture();
        ownsTouchGesture = true;
        for (const id of touches.keys()) capture(id);
        startPinch();
        consume(event);
        setPanning(true);
      }
    } else if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      options.cancelPrimaryGesture();
      pan = { id: event.pointerId, point: point(event), view };
      capture(event.pointerId);
      element.focus({ preventScroll: true });
      consume(event);
      setPanning(true);
    }
  };
  const onMove = (event: PointerEvent) => {
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, point(event));
      if (ownsTouchGesture) {
        consume(event);
        if (pinch && touches.size >= 2) update(pinchPreview(pinch.view, pinch.points, pair(), size(), maxScale));
      }
    } else if (pan?.id === event.pointerId) {
      consume(event);
      const current = point(event);
      update(boundPreviewZoom({
        scale: pan.view.scale,
        x: pan.view.x + current.x - pan.point.x,
        y: pan.view.y + current.y - pan.point.y,
      }, size(), maxScale));
    }
  };
  const finish = (event: PointerEvent) => {
    let owned = false;
    if (touches.delete(event.pointerId) && ownsTouchGesture) {
      owned = true;
      startPinch();
      // Consume the remaining finger until all lift: no accidental tap/rotation.
      if (touches.size === 0) {
        ownsTouchGesture = false;
        setPanning(false);
      }
    }
    if (pan?.id === event.pointerId) {
      owned = true;
      pan = null;
      setPanning(false);
    }
    if (owned) {
      consume(event);
      release(event.pointerId);
    }
  };
  const onWheel = (event: WheelEvent) => {
    // Trackpad pinch is delivered as Ctrl+wheel by browsers. Ordinary scrolling
    // is never consumed by pinch-only players.
    if (!options.wheel && !(options.pinch && event.ctrlKey)) return;
    consume(event);
    if (ownsTouchGesture || pan) return;
    const rect = size();
    update(zoomPreviewAt(view,
      wheelPreviewScale(view.scale, event.deltaY, event.deltaMode, rect.height, maxScale), point(event), rect, maxScale));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.target !== element || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '+' || event.key === '=') setScale(view.scale + PREVIEW_ZOOM_STEP);
    else if (event.key === '-') setScale(view.scale - PREVIEW_ZOOM_STEP);
    else if (event.key === '0') reset();
    else return;
    consume(event);
  };
  const cancelGesture = () => {
    const ids = [...touches.keys(), ...(pan ? [pan.id] : [])];
    options.cancelPrimaryGesture();
    touches.clear();
    ownsTouchGesture = false;
    pinch = null;
    pan = null;
    setPanning(false);
    for (const id of ids) release(id);
  };

  element.addEventListener('pointerdown', onDown, { capture: true, passive: false });
  element.addEventListener('pointermove', onMove, { capture: true, passive: false });
  element.addEventListener('pointerup', finish, true);
  element.addEventListener('pointercancel', finish, true);
  element.addEventListener('lostpointercapture', finish, true);
  if (options.pinch || options.wheel) element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', cancelGesture);
  element.dataset.zoomReady = 'true';
  return {
    setScale, reset, cancelGesture,
    resize() { cancelGesture(); update(boundPreviewZoom(view, size(), maxScale)); },
    destroy() {
      element.removeEventListener('pointerdown', onDown, true);
      element.removeEventListener('pointermove', onMove, true);
      element.removeEventListener('pointerup', finish, true);
      element.removeEventListener('pointercancel', finish, true);
      element.removeEventListener('lostpointercapture', finish, true);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', cancelGesture);
      delete element.dataset.zoomReady;
      cancelGesture();
    },
  };
}
