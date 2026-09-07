import type { CityFacadePanel } from './architecture.ts';

/** Spend texels on lettering, not on an independently clamped short axis.
 * Thin fascias can use a long texture without allocating a square 2K image. */
export const CITY_SIGN_TEXTURE_MAX_EDGE = 2048;

export function citySignTextureSize(panel: Pick<CityFacadePanel, 'id' | 'width' | 'height' | 'hero' | 'transit'>) {
  const { width, height } = panel;
  const aspect = Math.max(width / height, height / width);
  const landmark = panel.hero || panel.id === 'magnet-corner-poster' || panel.id === 'magnet-side-poster';
  // Ordinary near-square ads retain at least their former 512px long edge.
  // Portrait maps/KOBAN were oversampled; their savings fund the main posters.
  const pixels = landmark ? 512 * 1024 : panel.transit === 'entrance' ? 320 * 1024
    : panel.transit ? 256 * 1024 : Math.max(192 * 1024, 512 * 512 / aspect);
  const scale = Math.min(CITY_SIGN_TEXTURE_MAX_EDGE / Math.max(width, height), Math.sqrt(pixels / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

/** Fit the font itself uniformly. Canvas fillText(maxWidth) may squash glyphs.
 * Called only while painting a cached sign, never during animation or zoom. */
export function paintCitySignText(ctx: CanvasRenderingContext2D, label: string, x: number, y: number,
  size: number, width: number, color: string, weight = '900') {
  ctx.fillStyle = color;
  let fitted = size;
  // A second measurement accounts for browser font hinting at the fitted size.
  for (let i = 0; i < 2; i++) {
    ctx.font = `${weight} ${fitted}px sans-serif`;
    const metrics = ctx.measureText(label);
    const measured = Math.max(metrics.width, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
    if (measured <= width || measured === 0) break;
    fitted *= width / measured;
  }
  ctx.font = `${weight} ${fitted}px sans-serif`;
  ctx.fillText(label, x, y);
}
