import type { ResolvedTreeTheme } from '../../config/types.ts';
import { isFinderPattern } from '../tree/qr.ts';
import { cityNoise } from './layout.ts';

/** Facade-sized color groups and a diagonal morning-light band, fixed to cells.
 * Each cell remains one flat ink; logo, motion and Border never change its color. */
export function cityQRModuleColor(row: number, col: number, grid: number, theme: ResolvedTreeTheme): string {
  if (isFinderPattern(row, col, grid)) return theme.qrFinderEyeColor;
  const pane = cityNoise(Math.floor(col / 2) * 31 + Math.floor(row / 3) * 97, 4.2);
  const grain = cityNoise(row * grid + col, 8.7);
  const daylight = Math.sin((col / grid - row / grid * .48) * Math.PI) * .08;
  const position = Math.max(0, Math.min(.999, pane + (grain - .5) * .15 + daylight - .04));
  const index = theme.qrFoliagePaletteStops.findIndex(stop => position < stop);
  return theme.qrFoliagePaletteColors[index === -1 ? 3 : index];
}
