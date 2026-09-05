import type { AutoRotateDirection } from '../../config/types.ts';

export const BLOCK_SIZE = 0.0245; // voxel cube dimension
export const QR_VISUAL_REFERENCE_GRID_SIZE = 25;
export const TREE_RADIUS_RATIO = 0.46; // Tree canopy covers ~90% of QR code for broad foliage projection

// Shared scan-camera values keep the WebGL QR and its HTML details frame aligned.
export const QR_SCAN_DESKTOP_VERTICAL_FOV = 42;
export const QR_SCAN_MOBILE_HORIZONTAL_FOV = 23;
export const QR_SCAN_DESKTOP_DISTANCE = 2.4;
export const QR_SCAN_MOBILE_DISTANCE = 2.2;
export const QR_COMPACT_DENSITY_START_ASPECT = 0.68;
export const QR_COMPACT_DENSITY_END_ASPECT = 0.86;
export const QR_COMPACT_DISTANCE_SCALE_MAX = 1.35;
export const QR_LANDSCAPE_BLEND_END_ASPECT = 1.6;
export const QR_DESKTOP_WIDTH_BLEND_START = 600;
export const QR_DESKTOP_WIDTH_BLEND_END = 800;
export const QR_DESKTOP_ASPECT_BLEND_START = 0.45;
export const QR_DESKTOP_ASPECT_BLEND_END = 0.65;

export interface QRViewportProjection {
  aspect: number;
  compactDistanceScale: number;
  landscapeBlend: number;
  wideViewportBlend: number;
  desktopBlend: number;
  scanDistance: number;
  verticalFov: number;
}

/**
 * Keeps narrow-phone artwork at its established scale, compresses intermediate
 * portrait canvases as they approach square, then blends into the desktop
 * projection as either landscape space or usable CSS width increases. The
 * aspect gate prevents very narrow, tall canvases from receiving a desktop
 * vertical field of view that would make the artwork wider than their host.
 * Every boundary is continuous so a resize cannot trigger a size jump.
 */
export function resolveQRViewportProjection(
  width: number,
  height: number
): QRViewportProjection {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;
  const smoothstep = (value: number, start: number, end: number): number => {
    const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return progress * progress * (3 - 2 * progress);
  };
  const densityBlend = smoothstep(
    aspect,
    QR_COMPACT_DENSITY_START_ASPECT,
    QR_COMPACT_DENSITY_END_ASPECT
  );
  const compactDistanceScale = 1 + densityBlend
    * (QR_COMPACT_DISTANCE_SCALE_MAX - 1);
  const landscapeBlend = smoothstep(
    aspect,
    1,
    QR_LANDSCAPE_BLEND_END_ASPECT
  );
  const wideViewportBlend = smoothstep(
    safeWidth,
    QR_DESKTOP_WIDTH_BLEND_START,
    QR_DESKTOP_WIDTH_BLEND_END
  ) * smoothstep(
    aspect,
    QR_DESKTOP_ASPECT_BLEND_START,
    QR_DESKTOP_ASPECT_BLEND_END
  );
  const desktopBlend = landscapeBlend
    + (1 - landscapeBlend) * wideViewportBlend;

  const horizontalFovRadians =
    (QR_SCAN_MOBILE_HORIZONTAL_FOV * Math.PI) / 180;
  const compactVerticalFovRadians = 2 * Math.atan(
    Math.tan(horizontalFovRadians / 2) / aspect
  );
  const compactVerticalFov = (compactVerticalFovRadians * 180) / Math.PI;
  const compactScanDistance =
    QR_SCAN_MOBILE_DISTANCE * compactDistanceScale;

  return {
    aspect,
    compactDistanceScale,
    landscapeBlend,
    wideViewportBlend,
    desktopBlend,
    scanDistance: compactScanDistance
      + (QR_SCAN_DESKTOP_DISTANCE - compactScanDistance) * desktopBlend,
    verticalFov: compactVerticalFov
      + (QR_SCAN_DESKTOP_VERTICAL_FOV - compactVerticalFov) * desktopBlend,
  };
}

// One hue-preserving grade gives every settled 2D dark module enough scan
// contrast without changing when a logo is enabled. Theme palettes remain the
// source colors; 3D artwork and light modules do not receive this grade.
export const QR_2D_DEPTH_FILTER = Object.freeze({
  saturationScale: 1.12,
  lightnessScale: 0.874,
});

// Convert theme ground channels from linear values to their displayed sRGB
// values for the light modules on the settled QR face.
export const QR_2D_LIGHT_FILTER = Object.freeze({
  linearThreshold: 0.0031308,
  linearScale: 12.92,
  gammaScale: 1.055,
  gammaExponent: 1 / 2.4,
  gammaOffset: 0.055,
});

function linearChannelToSrgb(channel: number): number {
  const value = Math.max(0, Math.min(1, channel));
  return value <= QR_2D_LIGHT_FILTER.linearThreshold
    ? value * QR_2D_LIGHT_FILTER.linearScale
    : QR_2D_LIGHT_FILTER.gammaScale
      * Math.pow(value, QR_2D_LIGHT_FILTER.gammaExponent)
      - QR_2D_LIGHT_FILTER.gammaOffset;
}

export function resolveQR2DLightDisplayRgb(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgbTuple(hex);
  return [
    linearChannelToSrgb(r),
    linearChannelToSrgb(g),
    linearChannelToSrgb(b),
  ];
}

export const VIEW_TRANSITION_DURATION_SECONDS = 5 / 9;
export const VIEW_TRANSITION_SPEED_MIN = 0.25;
export const VIEW_TRANSITION_SPEED_MAX = 2;
export const VIEW_TRANSITION_SPEED_STEP = 0.25;
export const VIEW_TRANSITION_SPEED_DEFAULT = 1;
export const AUTO_ROTATE_RADIANS_PER_SECOND = 0.3;

/**
 * Keeps the view turn responsive on its first rendered frame while preserving
 * a smooth, zero-velocity settle at the destination.
 */
export function resolveViewTransitionProgress(elapsedRatio: number): number {
  const progress = Math.max(0, Math.min(1, elapsedRatio));
  const remaining = 1 - progress;
  const smoothstep = progress * progress * (3 - 2 * progress);
  return smoothstep + 0.65 * progress * remaining * remaining;
}

export function getAutoRotateDelta(
  direction: AutoRotateDirection,
  deltaSeconds: number
): number {
  const sign = direction === 'clockwise' ? 1 : -1;
  return sign * AUTO_ROTATE_RADIANS_PER_SECOND * Math.max(0, deltaSeconds);
}

export const QR_BORDER_PADDING_MIN = 4;
export const QR_BORDER_PADDING_MAX = 32;
export const QR_BORDER_PADDING_STEP = 4;
export const QR_BORDER_PADDING_DEFAULT = 16;

export const TreeBlockType = {
  Dirt: 0,
  CherryBlossom: 1, // Foliage / Blossom
  Trunk: 2,
  Grass: 3,
  FallenPetals: 4,
  Branch: 5,
} as const;

export type TreeBlockType = (typeof TreeBlockType)[keyof typeof TreeBlockType];

export type TreeShapeStyle = 'dome' | 'wide' | 'pine';

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}
