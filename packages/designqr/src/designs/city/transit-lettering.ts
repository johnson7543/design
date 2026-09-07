import { Color, ShapePath } from 'three';
import { CITY_TRANSIT_OUTLINES, type CityLetteringOutline } from './transit-lettering-data.ts';
import { SHIBUYA_PALETTE as P } from './palette.ts';

/** Metal station letters use Mincho forms; the bridge uses spaced Gothic forms. */
export const CITY_STATION_NAME_LAYOUT = [
  { key: 'jr', x: .012, y: .13, width: .115, height: .77 },
  { key: 'stationJapanese', x: .150, y: .04, width: .23, height: .91 },
  { key: 'stationEnglish', x: .410, y: .30, width: .54, height: .62 },
] as const;

export function fitCityLettering(key: string, x: number, y: number, width: number, height: number) {
  const outline = CITY_TRANSIT_OUTLINES[key], scale = Math.min(width / outline.width, height);
  return { outline, scale, x: x + (width - outline.width * scale) / 2, y: y + (height - scale) / 2 };
}

export function paintCityLettering(ctx: CanvasRenderingContext2D, key: string, x: number, y: number,
  width: number, height: number, color: string) {
  const fitted = fitCityLettering(key, x, y, width, height), s = fitted.scale;
  const px = (v: number) => fitted.x + v * s, py = (v: number) => fitted.y + s - v * s;
  ctx.fillStyle = color; ctx.beginPath();
  for (const c of fitted.outline.commands) {
    if (c[0] === 0) ctx.moveTo(px(c[1]), py(c[2]));
    else if (c[0] === 1) ctx.lineTo(px(c[1]), py(c[2]));
    else if (c[0] === 2) ctx.bezierCurveTo(px(c[1]), py(c[2]), px(c[3]), py(c[4]), px(c[5]), py(c[6]));
    else if (c[0] === 3) ctx.quadraticCurveTo(px(c[1]), py(c[2]), px(c[3]), py(c[4]));
    else ctx.closePath();
  }
  ctx.fill();
}

export function cityLetteringShapes(outline: CityLetteringOutline) {
  const path = new ShapePath();
  for (const c of outline.commands) {
    if (c[0] === 0) path.moveTo(c[1], c[2]);
    else if (c[0] === 1) path.lineTo(c[1], c[2]);
    else if (c[0] === 2) path.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
    else if (c[0] === 3) path.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else path.currentPath?.closePath();
  }
  return path.toShapes();
}

/** A muted railway green derived only from approved blue, gold and bay bases. */
export const CITY_JR_BRIDGE_INK = new Color(P.blue).multiply(new Color(P.warmLight)).lerp(new Color(P.glassLight), .12).getStyle();
