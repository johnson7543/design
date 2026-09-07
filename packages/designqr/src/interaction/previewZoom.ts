// Transient viewing coordinates. Never serialize these into artwork config.
export const PREVIEW_ZOOM_MIN = 1;
export const PREVIEW_ZOOM_MAX = 3;
export const PREVIEW_ZOOM_STEP = 0.25;

export interface PreviewPoint { x: number; y: number }
export interface PreviewSize { width: number; height: number }
export interface PreviewZoom extends PreviewPoint { scale: number }

export const DEFAULT_PREVIEW_ZOOM: Readonly<PreviewZoom> = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
// The editor canvas may opt into detailed inspection; public players stay at 3x.
export const normalizePreviewZoomMax = (value = PREVIEW_ZOOM_MAX) => Number.isFinite(value)
  ? clamp(value, PREVIEW_ZOOM_MIN, 10) : PREVIEW_ZOOM_MAX;
export const normalizePreviewScale = (value: number, maxScale = PREVIEW_ZOOM_MAX) => Number.isFinite(value)
  ? clamp(value, PREVIEW_ZOOM_MIN, normalizePreviewZoomMax(maxScale)) : PREVIEW_ZOOM_MIN;

export function boundPreviewZoom(view: PreviewZoom, size: PreviewSize, maxScale = PREVIEW_ZOOM_MAX): PreviewZoom {
  const scale = normalizePreviewScale(view.scale, maxScale);
  if (scale === PREVIEW_ZOOM_MIN) return DEFAULT_PREVIEW_ZOOM;
  const maxX = Math.max(0, size.width * (scale - 1) / 2);
  const maxY = Math.max(0, size.height * (scale - 1) / 2);
  return { scale, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) };
}

// Anchor coordinates are relative to the viewport center in CSS pixels.
export function zoomPreviewAt(
  view: PreviewZoom, targetScale: number, anchor: PreviewPoint, size: PreviewSize,
  maxScale = PREVIEW_ZOOM_MAX,
): PreviewZoom {
  const scale = normalizePreviewScale(targetScale, maxScale);
  const ratio = scale / view.scale;
  return boundPreviewZoom({
    scale,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  }, size, maxScale);
}

export function pinchPreview(
  view: PreviewZoom, start: readonly [PreviewPoint, PreviewPoint],
  current: readonly [PreviewPoint, PreviewPoint], size: PreviewSize,
  maxScale = PREVIEW_ZOOM_MAX,
): PreviewZoom {
  const midpoint = (points: readonly [PreviewPoint, PreviewPoint]) => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  });
  const distance = (points: readonly [PreviewPoint, PreviewPoint]) =>
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  const from = midpoint(start);
  const to = midpoint(current);
  const scale = normalizePreviewScale(view.scale * distance(current) / Math.max(1, distance(start)), maxScale);
  const ratio = scale / view.scale;
  return boundPreviewZoom({
    scale,
    x: to.x - (from.x - view.x) * ratio,
    y: to.y - (from.y - view.y) * ratio,
  }, size, maxScale);
}

export function wheelPreviewScale(scale: number, delta: number, deltaMode: number, height: number,
  maxScale = PREVIEW_ZOOM_MAX): number {
  const pixels = delta * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
  // Cap individual wheel impulses; continuous trackpad deltas remain smooth.
  return normalizePreviewScale(scale * Math.exp(-clamp(pixels, -160, 160) * 0.003), maxScale);
}
