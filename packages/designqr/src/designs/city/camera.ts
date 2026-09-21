import { BLOCK_SIZE, QR_VISUAL_REFERENCE_GRID_SIZE } from '../tree/constants.ts';

/** Start south of the crossing, looking at the Hachiko-facing facades.
 * This offsets the camera while preserving the surveyed foundation. */
export const CITY_CAMERA_YAW_OFFSET = -Math.PI / 2;

/** Distance from the city focus that keeps every model corner inside the frustum. */
export function fitCityCameraDistance(aspect: number, verticalFov: number, yaw: number, pitch: number, bounds?: { height: number; focus: number; profile?: readonly (readonly [number, number])[] }): number {
  const referenceWidth = BLOCK_SIZE * QR_VISUAL_REFERENCE_GRID_SIZE;
  const focusY = bounds?.focus ?? .10;
  const tanY = Math.tan(verticalFov * Math.PI / 360) * .92;
  const tanX = tanY * aspect;
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  let distance = 0;
  const profile = bounds?.profile ?? [[-.05, .515], [bounds?.height ?? .56, .515]];
  for (const [y, half] of profile) for (const x of [-half, half]) for (const z of [-half, half]) {
    const px = x * referenceWidth, py = y * referenceWidth - focusY, pz = z * referenceWidth;
    const horizontal = px * cosYaw - pz * sinYaw;
    const vertical = px * sinPitch * sinYaw + py * cosPitch + pz * sinPitch * cosYaw;
    const depth = px * cosPitch * sinYaw - py * sinPitch + pz * cosPitch * cosYaw;
    distance = Math.max(distance, depth + Math.abs(horizontal) / tanX, depth + Math.abs(vertical) / tanY);
  }
  return distance;
}
