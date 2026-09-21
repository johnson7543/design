import { CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three';
import { frontPoint, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';
import { dotonboriShopDesign } from './dotonbori-storefront-design.ts';
import { dotonboriSecondaryDisplay } from './dotonbori-storefront-displays.ts';
import { mapDotonboriStoreArt } from './dotonbori-storefront-artwork.ts';

type Patch = (x: number, y: number, w: number, h: number, color: string, offset?: number, glow?: boolean, morph?: boolean) => void;

/** Compact original interiors for all remaining exposed 1F faces. Depth adapts
 * to alleys; no glazing alpha sorting, fictional brands or detached street props.
 * S15 guides shop character, not the QR-selected uses or interior arrangements. */
export function createDotonboriContextStorefront(b: DotonboriGeometry, front: DotonboriFront, patch: Patch,
  artwork: PlaneGeometry[], fragments: DotonboriFragment[]) {
  const { kind, entrance, projection, seed } = front.context!, width = front.width - .10;
  const bays = Math.max(1, Math.round(width / 3.3));
  const design = dotonboriShopDesign(front, kind, bays, width, entrance);
  const metadata = { layoutKey: design.layoutKey, identity: design.identity, finish: design.finish, artVariant: design.artVariant,
    bayRoles: design.bays.map(b => b.role), bayWidthsM: design.bays.map(b => b.width) };
  if (front.context!.partial) {
    // Sloping/cropped ground-wall pieces cannot support a rectangular shop.
    // Every surface detail is clipped to its actual triangles, including ribs.
    patch(0, front.bottom + 1.55, width, 3.1, P.stone, projection * .35);
    for (let bay = 0; bay < bays; bay++) {
      const { x, width: pitch } = design.bays[bay];
      patch(x, front.bottom + 1.46, pitch * .76, 2.60, P.wall, projection * .50);
      if (design.finish % 2) for (let rib = 0; rib < 7; rib++) patch(x + (rib - 3) * pitch * .10, front.bottom + 1.46, .026, 2.32, P.metal, projection * .68);
      else for (let rib = 0; rib < 11; rib++) patch(x, front.bottom + .28 + rib * .25, pitch * .70, .034, P.metal, projection * .68);
      patch(x, front.bottom + 2.65, pitch * .62, .055, P.warmWindow, projection * .80, true, true);
    }
    return { front: front.id, building: front.building, kind, context: true, partial: true, ...metadata, bayRoles: design.bays.map(() => 'service'), bays, entrances: 0,
      counters: 0, lanterns: 0, menus: 0, diningWindows: 0, crabTanks: 0, bottom: front.bottom, top: front.top,
      maxProjection: projection, evidence: 'Source-clipped panel/service finish on a partial wall; no asserted shop or entrance' };
  }
  const entry = design.entry, menuBay = design.bays.findIndex(b => b.role === 'counter' || b.role === 'cabinet'), depthScale = projection / .64;
  const food = ['cafe', 'dining', 'sweets', 'takoyaki'].includes(kind), accent = design.accent;
  const point = (x: number, y: number, d: number) => frontPoint(front, x, front.bottom + y, d * depthScale);
  const face = (x: number, y: number, w: number, h: number, color: string, d = .16, glow = false) =>
    patch(x, front.bottom + y, w, h, color, d * depthScale, glow);
  const box = (x: number, y: number, d: number, w: number, h: number, depth: number, color: string, morph = false) =>
    b.box(point(x, y, d), w, h, depth * depthScale, color, front.yaw, morph);
  const cup = (x: number, y: number, d: number, color: string) => {
    const p = point(x, y, d);
    b.add(new CylinderGeometry(.065 / front.size, .05 / front.size, .13 / front.size, 6)
      .scale(1, 1, depthScale).rotateY(front.yaw).translate(p.x, p.y, p.z), color);
    face(x, y + .063, .085, .017, P.dark, d + .045);
  };
  const panel = (art: number, x: number, y: number, w: number, h: number, d: number) => {
    if (art < 4 || art === 8) w = Math.min(w, h * 7);
    const p = point(x, y, d), plane = new PlaneGeometry(w / front.size, h / front.size).rotateY(front.yaw).translate(p.x, p.y, p.z);
    mapDotonboriStoreArt(plane, art, design.artVariant);
    tagDotonboriBuilding(plane, front.building); artwork.push(plane);
    fragments.push({ x: p.x, y: p.y, z: p.z, width: w / front.size, height: h / front.size, depth: .035 / front.size,
      angle: front.yaw, color: P.warmWindow, kind: 'sign', group: `dotonbori-frontage-${front.id}`, sourceBuilding: front.building });
  };
  face(0, 1.55, width, 3.1, P.dark, .06);
  face(0, .16, width, .24, P.stone, .13);
  for (let bay = 0; bay < bays; bay++) {
    const { x, width: pitch, role, variation } = design.bays[bay], inner = pitch - .16;
    face(x, 1.40, inner, 2.40, food ? P.warmWindow : P.coolWindow, .11, kind !== 'shutter' && kind !== 'service');
    if (role === 'entry') {
      face(x, 1.31, inner - .16, 2.28, P.glass, .16);
      for (const side of [-1, 1]) {
        face(x + side * .09, 1.10, .035, .46, P.light, .30);
        face(x + side * inner * .23, 1.15, inner * .34, .05, P.metal, .27);
      }
      face(x, 1.33, .06, 2.28, P.metal, .28);
      box(x, .045, .30, inner, .08, .36, P.stone);
      box(x, .089, .36, inner * .64, .008, .23, P.dark);
      if (inner > 1.1) panel(6, x + inner * .30, 1.88, Math.min(.27, inner * .18), .42, .29);
    } else if (dotonboriSecondaryDisplay(role, x, inner, variation, design.finish, { box, face })) {
      // A coordinated shop mixes displays, seating and quieter glazing.
    } else if (food) {
      face(x, 1.53, inner - .12, 1.65, P.dark, .16);
      box(x, .57, .31, inner - .12, .75, .27, P.stone, true);
      box(x, 1.00, .37, inner, .09, .40, kind === 'dining' ? S.gold : P.light);
      for (let tile = 0; tile < 4; tile++) face(x + (tile - 1.5) * inner / 4, .57, .018, .68, P.metal, .456);
      box(x, 1.67, .24, inner - .18, .05, .13, P.metal);
      for (let bottle = 0; bottle < 3; bottle++) {
        const u = x + (bottle - 1) * Math.min(.28, inner / 6);
        box(u, 1.83, .25, .10, .23, .095, (seed + bay + bottle) % 2 ? S.blue : S.gold);
        box(u, 1.97, .25, .04, .05, .05, P.metal);
        face(u, 1.83, .07, .07, P.light, .303);
      }
      const displayW = inner * .52, displayX = x - inner * .17;
      if (kind === 'sweets' || role === 'cabinet') {
        for (let tier = 0; tier < 2; tier++) {
          box(displayX, 1.08 + tier * .27, .39, displayW, .035, .29, P.light);
          for (let cake = 0; cake < 3; cake++) {
            const u = displayX + (cake - 1) * displayW / 3.4;
            if (kind === 'takoyaki') {
              box(u, 1.11 + tier * .27, .40, displayW / 4.8, .02, .17, P.light);
              const p = point(u, 1.17 + tier * .27, .40);
              b.add(new SphereGeometry(.055 / front.size, 6, 4).scale(1, 1, depthScale)
                .rotateY(front.yaw).translate(p.x, p.y, p.z), S.gold);
            } else {
              box(u, 1.15 + tier * .27, .40, displayW / 4.8, .10, .17, S.gold);
              box(u, 1.204 + tier * .27, .40, displayW / 4.8, .012, .17, P.light);
            }
          }
        }
        for (const side of [-1, 1]) box(displayX + side * displayW / 2, 1.35, .54, .035, .58, .03, P.metal);
        box(displayX, 1.65, .40, displayW + .03, .04, .31, P.metal);
      } else if (kind === 'takoyaki') {
        box(displayX, 1.06, .38, displayW, .05, .31, P.metal);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++)
          box(displayX + (col - 1.5) * displayW / 4.5, 1.11, .31 + row * .13, .09, .055, .085, S.gold);
      } else {
        for (const side of [-1, 1]) {
          cup(displayX + side * displayW * .24, 1.10, .42, side > 0 ? P.light : S.coral);
          if (kind === 'dining') box(displayX + side * displayW * .27, .84, .18, .24, .39, .08, S.charcoal);
        }
        if (kind === 'cafe') {
          box(displayX, 1.28, .25, .35, .35, .19, P.metal);
          face(displayX, 1.28, .26, .20, P.dark, .35);
        }
      }
      const menuW = Math.min(.43, inner * .21), menuX = x + inner * .32;
      if (bay === menuBay) {
        box(menuX, 1.52, .35, menuW + .07, .75, .10, P.metal);
        panel(kind === 'cafe' ? 5 : kind === 'sweets' ? 11 : 4, menuX, 1.52, menuW, .67, .41);
      }
      // Warm pendant and shallow awning; the entire relief fits the clearance.
      face(x, 2.43, .025, .25, P.metal, .31);
      box(x, 2.24, .34, Math.min(.42, inner * .4), .18, .21, S.gold);
      face(x, 2.20, Math.min(.33, inner * .32), .06, P.light, .452, true);
      if (bay === menuBay && design.finish < 2) {
        box(x, 2.66, .36, inner + .02, .10, .50, accent, true);
        if (design.finish === 0) for (let seam = 0; seam < 4; seam++) face(x + (seam - 1.5) * inner / 4, 2.65, .018, .07, P.light, .618);
      }
    } else if (kind === 'retail') {
      box(x, .41, .27, inner - .18, .18, .21, P.light, true);
      if (role === 'mannequin') {
        const u = x + (variation - .5) * inner * .25, p = point(u, 1.94, .26);
        b.add(new CylinderGeometry(.095 / front.size, .085 / front.size, .18 / front.size, 8)
          .scale(1, 1, depthScale).rotateY(front.yaw).translate(p.x, p.y, p.z), P.light);
        box(u, 1.56, .26, .36, .52, .12, accent);
        for (const side of [-1, 1]) {
          box(u + side * .10, 1.02, .26, .08, .54, .07, P.dark);
          box(u + side * .23, 1.47, .26, .065, .45, .07, P.light);
        }
      } else {
        box(x, 1.98, .22, inner * .75, .045, .055, P.metal);
        for (let garment = 0; garment < 4; garment++) {
          const u = x + (garment - 1.5) * inner / 5;
          face(u, 1.87, .025, .18, P.metal, .27);
          box(u, 1.57, .24, inner / 6, .49, .07, (seed + bay + garment) % 3 ? S.blue : S.coral);
          box(u, .59, .28, inner / 5.5, .10, .15, garment % 2 ? P.light : S.gold);
        }
      }
      if (inner > 1.4 && role === 'mannequin') panel(7, x + inner * .29, 1.34, .30, .47, .33);
      face(x, 2.36, inner * .81, .05, P.light, .26, true);
    } else if (kind === 'lobby' || kind === 'commercial') {
      const boardW = Math.min(.68, inner * .42);
      box(x - inner * .20, 1.63, .20, boardW + .07, 1.07, .10, P.metal);
      if (bay % 2 === 0) {
        panel(10, x - inner * .20, 1.63, boardW, .99, .26);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
          const u = x + inner * (.12 + col * .16), y = .90 + row * .22;
          box(u, y, .22, inner * .13, .17, .12, P.metal);
          face(u, y + .025, inner * .08, .015, P.dark, .285);
        }
      } else {
        face(x - inner * .20, 1.63, boardW, .99, S.blue, .26);
        for (let bar = 0; bar < 3; bar++) face(x - inner * .20, 1.39 + bar * .24, boardW * (.42 + bar * .15), .08, bar % 2 ? S.gold : P.light, .27);
        box(x + inner * .22, .65, .26, inner * .24, .19, .24, S.charcoal);
        box(x + inner * .22, .92, .23, inner * .24, .41, .09, S.coral);
      }
      box(x, .36, .26, inner * .69, .17, .20, P.stone);
      face(x, 2.39, inner * .71, .05, P.warmWindow, .27, true);
    } else {
      // Closed shops and narrow service faces still get a finished ground floor.
      face(x, 1.41, inner, 2.30, P.stone, .17);
      if (role === 'shutter') {
        for (let slat = 0; slat < 11 + design.finish; slat++) face(x, .39 + slat * (2.0 / (11 + design.finish)), inner - .07, .032, design.frame, .20);
        face(x, .50, Math.min(.29, inner * .4), .065, P.dark, .24);
        face(x + inner * .23, 1.51, Math.min(.29, inner * .28), .38, P.metal, .25);
      } else {
        const ventW = Math.min(.68, inner * .68);
        face(x, 1.93, ventW, .71, P.dark, .21);
        for (let slat = 0; slat < 7; slat++) face(x, 1.66 + slat * .085, ventW - .04, .03, P.metal, .23);
        box(x, .92, .23, Math.min(.44, inner * .6), .62, .11, P.metal);
        face(x, 1.06, Math.min(.22, inner * .3), .11, P.coolWindow, .29);
        face(x, .65, .025, .31, P.dark, .30);
      }
      box(x, 2.62, .25, Math.min(.43, inner * .66), .10, .20, P.metal);
      face(x, 2.59, Math.min(.34, inner * .52), .035, P.warmWindow, .355, true);
    }
  }
  for (const edge of [-width / 2, ...design.bays.map(bay => bay.x + bay.width / 2)]) box(edge, 1.41, .23, design.frameWidth, 2.76, .15, design.frame);
  box(0, 2.90, .22, width - design.fasciaInset, design.fasciaHeight, .24, food ? accent : P.dark, true);
  face(0, 2.71, width - .06, .04, P.warmWindow, .35, true);
  if (food || kind === 'restaurant') panel(kind === 'restaurant' ? 8 : kind === 'takoyaki' ? 0 : kind === 'dining' ? 1 : kind === 'sweets' ? 2 : 3,
    0, 2.90, Math.min(width - design.fasciaInset - .09, 2.55), design.fasciaHeight - .04, .35);
  return { front: front.id, building: front.building, kind, context: true, ...metadata, bays, entrances: entry < 0 ? 0 : 1,
    counters: food ? design.bays.filter(b => b.role === 'counter' || b.role === 'cabinet').length : 0, lanterns: 0, menus: food && menuBay >= 0 ? 1 : 0,
    diningWindows: 0, crabTanks: 0, bottom: front.bottom, top: front.top, maxProjection: projection,
    evidence: 'S15 local shop character; QR-generated use and fittings, not a verified tenant or floor plan' };
}
