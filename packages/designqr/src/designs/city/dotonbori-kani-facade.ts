import { CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { frontPoint, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { mapDotonboriSignArt } from './dotonbori-sign-layout.ts';
import { wallCoverage } from './dotonbori-walls.ts';
import { tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';
import { dotonboriShopDesign } from './dotonbori-storefront-design.ts';

/** S19/F1 owner's street/corner photograph, registered to B046's oblique south
 * plane. Dimensions are miniature interpretations within that source envelope.
 * The photograph covers the lower elevation; the upper wall stays structural. */
export function createDotonboriKaniFacade(b: DotonboriGeometry, front: DotonboriFront, artwork: PlaneGeometry[], fragments: DotonboriFragment[]) {
  const size = front.size, base = front.bottom, width = front.width - .28;
  const design = dotonboriShopDesign(front, 'restaurant', 3, width, false);
  const point = (x: number, y: number, depth: number) => frontPoint(front, x, base + y, depth);
  const supported = (x: number, y: number, w: number, h: number) => wallCoverage(front.wall, {
    minU: front.u + (x - w / 2) / size, maxU: front.u + (x + w / 2) / size,
    minY: (base + y - h / 2) / size, maxY: (base + y + h / 2) / size,
  }) >= w * h / size ** 2 * .999;
  const box = (x: number, y: number, depth: number, w: number, h: number, d: number, color: string, morph = false, glow = false) => {
    if (supported(x, y, w, h)) b.box(point(x, y, depth), w, h, d, color, front.yaw, morph, glow);
  };
  // Pale folded panels, deep horizontal rails and inset window strips visible
  // above the entrance. Relief sits outside the solid; glazing remains opaque.
  const observedTop = 12.6;
  box(0, (observedTop + 3.65) / 2, .12, width, observedTop - 3.65, .10, P.stone);
  for (let panel = 0; panel < 30; panel++) {
    const x = ((panel + .5) / 30 - .5) * (width - .52);
    box(x, 7.62, .23, (width - .52) / 30 - .06, 7.45, .12, P.light);
  }
  for (const y of [7.9, 11.95]) {
    box(0, y, .315, width - .34, .92, .15, P.dark, true);
    for (let bay = 0; bay < 6; bay++) {
      const pitch = (width - .62) / 6, x = (bay - 2.5) * pitch;
      box(x, y, .403, pitch - .12, .67, .022, P.glass);
      box(x, y + .015, .425, .045, .65, .035, P.metal);
    }
    box(0, y - .57, .32, width, .20, .30, P.metal);
    box(0, y + .56, .29, width, .18, .25, P.metal);
  }
  for (const x of [-width / 2 + .12, width / 2 - .12]) {
    box(x, observedTop / 2, .31, .24, observedTop, .32, P.metal, true);
    box(x, 6.10, .47, .32, .18, .20, P.roof);
    box(x, 10.03, .47, .32, .18, .20, P.roof);
  }
  // One entrance composition, not another row of riverside dining bays. Keep
  // its source floor; street datum uncertainty does not justify invented steps.
  box(0, 1.38, .16, width - .48, 2.76, .15, P.dark);
  const entryWidth = width * .52, sideWidth = (width - .94 - entryWidth) / 2;
  box(0, 1.30, .255, entryWidth, 2.55, .025, P.glass, true);
  box(0, 2.35, .30, entryWidth - .20, .38, .04, P.warmWindow, false, true);
  for (const side of [-1, 1]) {
    const x = side * (entryWidth / 2 + sideWidth / 2 + .16);
    box(x, 1.3, .29, sideWidth, 2.5, .20, P.stone);
    box(x, 1.44, .404, sideWidth - .25, 1.90, .022, P.warmWindow, false, true);
    box(x, .44, .43, sideWidth - .25, .18, .08, S.charcoal);
    box(side * (entryWidth / 2 + .05), 1.37, .40, .12, 2.74, .27, S.charcoal);
  }
  // Continuous shallow tiled eave with closed ends, separate fascia and a
  // recessed warm soffit. Ceramic rolls lie along the canopy's slope.
  box(0, 2.89, .45, width, .20, .72, S.charcoal, true);
  box(0, 3.20, .72, width - .06, .48, .14, P.light, true);
  box(0, 3.48, .39, width, .10, .64, P.metal, true);
  box(0, 2.775, .55, width - .34, .025, .47, S.coral, false, true);
  for (let tile = 0; tile < Math.floor(width / .26); tile++) {
    const count = Math.floor(width / .26), x = ((tile + .5) / count - .5) * (width - .10);
    const p = point(x, 3.545, .40);
    b.add(new CylinderGeometry(.062 / size, .062 / size, .66 / size, 6)
      .rotateX(Math.PI / 2).rotateY(front.yaw).translate(p.x, p.y, p.z), P.roof);
  }
  for (let light = 0; light < 10; light++) {
    const x = ((light + .5) / 10 - .5) * (entryWidth + .8), p = point(x, 2.59, .55);
    b.add(new SphereGeometry(.10 / size, 8, 6).translate(p.x, p.y, p.z), S.coral, true);
    box(x, 2.74, .55, .022, .14, .022, P.metal);
  }
  // Cell 14 is the photographed store name, outlined with the bundled font.
  const w = Math.min(9.1, width - .40), h = .39, p = point(0, 3.20, .799);
  const art = new PlaneGeometry(w / size, h / size).rotateY(front.yaw).translate(p.x, p.y, p.z);
  mapDotonboriSignArt(art, 14);
  tagDotonboriBuilding(art, front.building); artwork.push(art);
  fragments.push({ x: p.x, y: p.y, z: p.z, width: w / size, height: h / size, depth: .04 / size, angle: front.yaw,
    color: P.light, kind: 'sign', group: 'dotonbori-frontage-B046-south', sourceBuilding: front.building });
  return { front: front.id, building: front.building, kind: 'restaurant', bays: 3, entrances: 0, entranceFrames: 1,
    counters: 0, lanterns: 10, menus: 0, bottom: base, top: base + 3.65, maxProjection: .81,
    identity: design.identity, finish: design.finish, artVariant: design.artVariant, layoutKey: `${front.id}:S19-F1`,
    bayRoles: ['display', 'entrance-reveal', 'display'], bayWidthsM: [sideWidth, entryWidth, sideWidth],
    diningWindows: 0, crabTanks: 0, evidence: 'S19/F1 owner street/corner photo; source plane and floor; interpreted proportions; street walking datum unresolved' };
}
