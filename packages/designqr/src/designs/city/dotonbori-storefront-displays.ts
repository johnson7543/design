import type { DotonboriShopBay } from './dotonbori-storefront-design.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';

type Draw = {
  box: (x: number, y: number, d: number, w: number, h: number, depth: number, color: string, morph?: boolean) => void;
  face: (x: number, y: number, w: number, h: number, color: string, d: number, glow?: boolean) => void;
};

/** Complementary bays within a shop: seats, shelves and quieter glazing give
 * counters/display windows room to read. All fittings stay wall-attached. */
export function dotonboriSecondaryDisplay(role: DotonboriShopBay, x: number, inner: number, variation: number, finish: number, draw: Draw) {
  const { box, face } = draw, tone = [S.charcoal, S.blue, P.metal, S.gold][finish];
  if (role === 'seating' || role === 'bench') {
    face(x, 1.53, inner - .12, 1.86, P.warmWindow, .20, true);
    const w = Math.min(1.2, inner * .48), center = x + (variation - .5) * inner * .22;
    if (role === 'seating') {
      box(center, .82, .39, w, .065, .36, S.gold, true);
      box(center, .43, .33, .075, .72, .075, P.metal);
      for (const side of [-1, 1]) {
        box(center + side * w * .31, .49, .24, w * .28, .075, .24, tone);
        box(center + side * w * .31, .75, .18, w * .28, .43, .055, tone);
        box(center + side * w * .24, .865, .41, .17, .018, .14, P.light);
      }
      box(center, .915, .35, .055, .09, .055, P.coolWindow);
    } else {
      box(center, .48, .31, inner * .73, .12, .30, tone, true);
      box(center, .82, .20, inner * .73, .57, .09, tone);
      for (const side of [-1, 1]) box(center + side * inner * .27, .26, .30, .07, .35, .08, P.metal);
    }
    if (variation > .45) {
      const u = x - inner * .32;
      box(u, 2.12, .25, Math.min(.43, inner * .24), .38, .08, tone);
      face(u, 2.12, Math.min(.34, inner * .19), .28, P.light, .295);
    }
    face(x, 2.46, inner * .77, .05, P.warmWindow, .29, true);
    return true;
  }
  if (role === 'shelf' || role === 'folded') {
    face(x, 1.48, inner - .12, 1.88, P.dark, .20);
    const rows = role === 'folded' ? 2 : 3 + finish % 2, w = inner * (.66 + variation * .15);
    for (let row = 0; row < rows; row++) {
      const y = .59 + row * .42;
      box(x, y, .30, w, .055, .20, tone);
      const count = role === 'folded' ? 3 : 4 + (row + finish) % 3;
      for (let item = 0; item < count; item++) {
        const u = x + ((item + .5) / count - .5) * w * .90;
        const color = [P.light, S.blue, S.coral, S.gold][(item + row + finish) % 4];
        box(u, y + (role === 'folded' ? .10 : .16), .29, w / count * .72, role === 'folded' ? .12 : .22 + (item % 3) * .035, .13, color);
        if (role === 'folded') box(u, y + .19, .29, w / count * .68, .045, .12, P.light);
      }
    }
    face(x, 2.40, w, .055, P.warmWindow, .31, true);
    return true;
  }
  if (role === 'glazing') {
    face(x, 1.48, inner - .12, 2.02, P.glass, .20);
    face(x, .58 + variation * .13, inner - .15, .52, finish % 2 ? P.stone : P.coolWindow, .23);
    const split = x + (variation - .5) * inner * .40;
    face(split, 1.49, .055, 2.02, tone, .26);
    if (finish % 2) for (let slat = 0; slat < 5; slat++) face(x, 2.13 + slat * .065, inner - .18, .025, P.metal, .25);
    else face(x, 2.34, inner - .16, .10, P.warmWindow, .25, true);
    return true;
  }
  if (role === 'service') {
    face(x, 1.44, inner - .10, 2.06, P.stone, .20);
    const w = inner * (.50 + variation * .19), center = x + (variation - .5) * inner * .18;
    face(center, 1.87, w, .70, P.dark, .24);
    for (let slat = 0; slat < 6; slat++) face(center, 1.59 + slat * .11, w - .045, .025, tone, .26);
    face(x - inner * .29, .95, Math.min(.20, inner * .18), .29, P.metal, .27);
    face(x, 2.47, inner * .54, .05, P.warmWindow, .27, true);
    return true;
  }
  return false;
}
