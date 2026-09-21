import type { DesignQRCityPreset } from '../../config/types.ts';
import { DOTONBORI_CAMERA_YAW_OFFSET, DOTONBORI_CAMERA_ELEVATION } from './dotonbori-layout.ts';

/** Shared metadata keeps editor, canonical links and public players in agreement. */
export const CITY_PRESETS = Object.freeze({
  shibuya: { label: '渋谷', accessibleName: '渋谷', night: false, yaw: -Math.PI / 2, pitchOffset: -.16 },
  dotonbori: { label: '道頓堀', accessibleName: '道頓堀', night: true, yaw: DOTONBORI_CAMERA_YAW_OFFSET, pitchOffset: .55 - DOTONBORI_CAMERA_ELEVATION },
  'tokyo-tower': { label: '東京タワー', accessibleName: '東京タワー', night: true, yaw: -Math.PI / 2, pitchOffset: .16 },
} satisfies Record<DesignQRCityPreset, { label: string; accessibleName: string; night: boolean; yaw: number; pitchOffset: number }>);

export function isCityPreset(value: unknown): value is DesignQRCityPreset {
  return typeof value === 'string' && Object.hasOwn(CITY_PRESETS, value);
}
