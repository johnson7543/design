import type { BufferGeometry } from 'three';

/** Low northeast opening, 65 degrees north of east, facing the Glico sign. */
export const DOTONBORI_CAMERA_YAW_OFFSET = 31 * Math.PI / 36;
export const DOTONBORI_CAMERA_ELEVATION = Math.PI / 6;
export const DOTONBORI_RIVER_CAMERA_ELEVATION = 5 * Math.PI / 18;

// Preserve the established southeast height envelope independently of the camera.
const DOTONBORI_CONTEXT_YAW = Math.PI / 4 + 5 * Math.PI / 18;

/** Static composition in tile coordinates. Southeastern context graduates to
 * low-rise roofs; opening-angle changes and live orbit never change heights. */
export function dotonboriContextTop(x: number, z: number) {
  const depth = x * Math.sin(DOTONBORI_CONTEXT_YAW) + z * Math.cos(DOTONBORI_CONTEXT_YAW);
  const t = Math.max(0, Math.min(1, (depth + .18) / .55));
  return (48 - 36 * t * t * (3 - 2 * t)) / 144;
}

/** Metric presentation boundary in the bridge and Donki source coordinate frame. */
export interface DotonboriLayout {
  tileSizeM: number;
  centerEastNorthM: [number, number];
  rotationYRadians: number;
  outlineEastNorthM: number[][];
  /** Authored landmark relocation; source geography is retained in the assets. */
  landmarkOffsetsEastNorthM: Record<string, readonly [number, number]>;
}

export function dotonboriLandmarkLocation(layout: DotonboriLayout, sourceId: string, east: number, north: number) {
  const offset = layout.landmarkOffsetsEastNorthM[sourceId] ?? [0, 0];
  return [east + offset[0], north + offset[1]] as const;
}

export function transformDotonboriGeometry<T extends BufferGeometry>(geometry: T, layout: DotonboriLayout): T {
  const [east, north] = layout.centerEastNorthM, scale = 1 / layout.tileSizeM;
  return geometry.translate(-east, 0, north).rotateY(layout.rotationYRadians).scale(scale, scale, scale);
}
