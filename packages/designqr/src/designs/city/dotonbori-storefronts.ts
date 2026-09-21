import { CylinderGeometry, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three';
import { frontPoint, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { mixCityColor, OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';
import { wallCoverage } from './dotonbori-walls.ts';
import { dotonboriShopDesign, type DotonboriShopKind } from './dotonbori-storefront-design.ts';
import { dotonboriSecondaryDisplay } from './dotonbori-storefront-displays.ts';
import { mapDotonboriStoreArt } from './dotonbori-storefront-artwork.ts';
import { DOTONBORI_CLOTH_GROUP, type DotonboriClothPanel } from './dotonbori-cloth.ts';
import type { DotonboriShopActionAnchor } from './dotonbori-shop-activity.ts';

/** S14 registers the commercial base. S15 directs plausible, unbranded
 * fittings; these uses are miniature interpretations, not surveyed tenants. */
const STORE_KINDS: Readonly<Record<string, DotonboriShopKind>> = {
  // S14 does not establish a sweets shop below SAMTY. Keep that base neutral.
  B037: 'dining', B039: 'commercial', B040: 'lobby', B041: 'takoyaki',
  B046: 'restaurant', 'B046-west': 'restaurant', 'B049-north': 'cafe',
  'B034-south-lower': 'retail',
  'B034-east-lower': 'retail', 'B031-west': 'commercial', B092: 'retail',
};
export function dotonboriStoreKind(front: DotonboriFront) { return STORE_KINDS[front.id]; }
type Patch = (x: number, y: number, w: number, h: number, color: string, offset?: number, glow?: boolean, morph?: boolean) => void;

/** A single wall owner, a reserved 3.1 m ground floor, and <= .79 m relief.
 * Interiors are opaque shallow stage sets in front of the source solid. No
 * transparent panes, overlapping generic windows, or free-standing pavement props. */
export function createDotonboriStorefront(b: DotonboriGeometry, front: DotonboriFront, patch: Patch,
  artwork: PlaneGeometry[], fragments: DotonboriFragment[], cloth: DotonboriClothPanel[], actions: DotonboriShopActionAnchor[]) {
  const kind = dotonboriStoreKind(front)!, base = front.bottom, width = front.width - .60;
  const bays = Math.max(2, Math.round(width / 3.6));
  const design = dotonboriShopDesign(front, kind, bays, width, kind !== 'restaurant');
  // S16 shows river-facing dining windows. The public entrance is on the
  // street side; do not invent doors in this restaurant's riverside glazing.
  const entry = design.entry, menuBay = design.bays.findIndex(b => b.role === 'counter' || b.role === 'cabinet');
  const food = ['takoyaki', 'dining', 'sweets', 'cafe'].includes(kind);
  const accent = kind === 'takoyaki' ? S.coral : kind === 'restaurant' ? S.charcoal : design.accent;
  const point = (x: number, y: number, depth: number) => frontPoint(front, x, base + y, depth);
  const box = (x: number, y: number, depth: number, w: number, h: number, d: number, color: string, morph = false, glow = false) =>
    b.box(point(x, y, depth), w, h, d, color, front.yaw, morph, glow);
  const face = (x: number, y: number, w: number, h: number, color: string, depth: number, glow = false) => patch(x, base + y, w, h, color, depth, glow);
  const sphere = (x: number, y: number, depth: number, w: number, h: number, d: number, color: string, glow = false) => {
    const p = point(x, y, depth);
    b.add(new SphereGeometry(1, 10, 6).scale(w / front.size, h / front.size, d / front.size).rotateY(front.yaw).translate(p.x, p.y, p.z), color, glow);
  };
  const cylinder = (x: number, y: number, depth: number, r: number, h: number, color: string) => {
    const p = point(x, y, depth);
    b.add(new CylinderGeometry(r / front.size, r / front.size, h / front.size, 8).translate(p.x, p.y, p.z), color);
  };
  const panel = (art: number, x: number, y: number, w: number, h: number, depth: number) => {
    if (art < 4 || art === 8) w = Math.min(w, h * 7);
    const rect = { minU: front.u + (x - w / 2) / front.size, maxU: front.u + (x + w / 2) / front.size,
      minY: (base + y - h / 2) / front.size, maxY: (base + y + h / 2) / front.size };
    if (wallCoverage(front.wall, rect) < w * h / front.size ** 2 * .999) return;
    const p = point(x, y, depth), plane = new PlaneGeometry(w / front.size, h / front.size).rotateY(front.yaw).translate(p.x, p.y, p.z);
    mapDotonboriStoreArt(plane, art, design.artVariant);
    tagDotonboriBuilding(plane, front.building); artwork.push(plane);
    fragments.push({ x: p.x, y: p.y, z: p.z, width: w / front.size, height: h / front.size, depth: .04 / front.size,
      angle: front.yaw, color: art < 4 ? accent : P.warmWindow, kind: 'sign', group: `dotonbori-frontage-${front.id}`, sourceBuilding: front.building });
  };
  face(0, 1.55, width, 3.1, P.dark, .10);
  for (let bay = 0; bay < bays; bay++) {
    const { x, width: pitch, role, variation } = design.bays[bay], door = role === 'entry', inner = pitch - .30;
    face(x, 1.35, inner, 2.45, door ? P.glass : P.warmWindow, .16, !door);
    face(x, .19, inner, .27, P.stone, .19);
    if (door) {
      // Entry mat, double-leaf door, push bars, jambs and a recessed directory.
      face(x, 1.30, inner - .28, 2.25, P.glass, .20);
      for (const side of [-1, 1]) {
        face(x + side * .10, 1.10, .045, .65, P.light, .36);
        face(x + side * inner * .25, 1.19, inner * .32, .045, P.metal, .32);
      }
      face(x, 1.31, .075, 2.38, P.metal, .32);
      box(x, .045, .35, inner, .09, .46, P.stone);
      box(x, .096, .43, inner * .61, .012, .29, P.dark);
      if (food) {
        // Split noren hang clear of the lower doorway, with visible gaps.
        const rod = point(x, 2.505, .418);
        b.box(rod, inner, .024, .024, P.metal, front.yaw, false);
        fragments.push({ x: rod.x, y: rod.y, z: rod.z, width: inner / front.size, height: .024 / front.size, depth: .024 / front.size,
          angle: front.yaw, color: P.metal, kind: 'furniture', group: DOTONBORI_CLOTH_GROUP,
          sourceBuilding: front.building, id: `dotonbori-noren-rod-${front.id}` });
        for (let flap = 0; flap < 4; flap++) cloth.push({
          id: `dotonbori-noren-${front.id}-${flap}`, kind: 'noren', sourceBuilding: front.building,
          anchor: point(x + (flap - 1.5) * inner / 4, 2.505, .418), yaw: front.yaw,
          widthM: inner / 4 - .035, heightM: .53, color: accent, mark: flap === 0 || flap === 3,
        });
      }
    } else if (kind !== 'restaurant' && dotonboriSecondaryDisplay(role, x, inner, variation, design.finish, { box, face })) {
      // Complementary display/seating/glazing, not another copy of the counter.
    } else if (kind === 'restaurant') {
      // Owner's 1F room: timber divisions, chair/table settings, frosted lower
      // glazing and framed pendant lights. Relief is compressed, not a floor plan.
      const timber = mixCityColor(S.gold, S.charcoal, .48), room = mixCityColor(P.stone, S.gold, .20);
      face(x, 1.49, inner - .14, 1.94, room, .20);
      box(x, .245, .39, inner - .16, .065, .38, P.stone);
      box(x, 2.555, .38, inner - .16, .07, .36, timber);
      for (const side of [-1, 1]) box(x + side * (inner / 2 - .10), 1.36, .38, .095, 2.37, .36, S.charcoal);
      for (let beam = 0; beam < 3 + bay % 2; beam++) {
        const u = x + ((beam + .5) / (3 + bay % 2) - .5) * (inner - .26);
        box(u, 2.50, .39, .055, .06, .35, timber);
      }
      face(x, .43, inner - .24, .32, P.coolWindow, .59);
      box(x, .61, .57, inner - .22, .045, .07, S.charcoal);
      // S16's pitched, dark-framed pendant, compressed into the window reveal.
      const lampX = x + (variation - .5) * Math.min(.32, inner * .12);
      box(lampX, 2.44, .39, .025, .17, .025, S.charcoal);
      box(lampX, 2.07, .39, .52, .25, .23, P.warmWindow, true, true);
      const roof = point(lampX, 2.29, .39);
      b.add(new CylinderGeometry(.085 / front.size, .365 / front.size, .19 / front.size, 4)
        .rotateY(Math.PI / 4).scale(1, 1, .445).rotateY(front.yaw).translate(roof.x, roof.y, roof.z), P.warmWindow, true);
      for (const side of [-1, 1]) {
        box(lampX + side * .25, 2.07, .51, .027, .25, .027, S.charcoal);
        box(lampX, 2.07 + side * .13, .39, .55, .025, .25, S.charcoal);
        b.beam(point(lampX + side * .258, 2.195, .505), point(lampX + side * .060, 2.385, .417), .025, S.charcoal);
      }
      face(lampX, 2.07, .027, .25, S.charcoal, .525);
      if (role === 'tank') {
        // The owner explicitly labels a 1F crab tank. This small display
        // vignette communicates that feature; its visible position is interpreted.
        box(x, .70, .37, inner - .40, .55, .35, P.stone, true);
        face(x, .97, inner - .48, .53, P.glass, .39);
        face(x, .72, inner - .47, .055, P.glow, .58, true);
        for (const side of [-1, 1]) box(x + side * (inner / 2 - .22), 1.01, .56, .045, .57, .05, P.metal);
        box(x, 1.31, .42, inner - .39, .07, .34, P.metal);
        actions.push({ kind: 'tank', front, x, width: inner });
      } else {
        const table = Math.min(1.35, inner * (.44 + variation * .15)), tableX = x + (variation - .5) * Math.min(.26, inner * .10);
        box(tableX, .83, .42, table, .065, .43, S.gold, true);
        for (const side of [-1, 1]) {
          const chairX = tableX + side * (table / 2 + .14), settingX = tableX + side * table * .25;
          box(tableX + side * table * .36, .53, .41, .06, .53, .06, timber);
          box(chairX, .80, .29, .31, .48, .10, timber);
          face(chairX, .80, .25, .35, S.coral, .348);
          box(chairX, 1.055, .29, .33, .045, .12, S.gold);
          box(chairX, .49, .40, .31, .075, .26, S.coral);
          for (const leg of [-1, 1]) box(chairX + leg * .115, .365, .43, .035, .18, .035, timber);
          box(settingX, .868, .48, .30, .008, .24, P.light);
          cylinder(settingX, .881, .46, .092, .018, P.light);
          cylinder(settingX, .924, .34, .048, .08, P.coolWindow);
          for (const chopstick of [-1, 1]) box(settingX + chopstick * .014, .878, .57, .008, .007, .15, timber);
        }
        sphere(tableX, .96, .39, .087, .094, .073, P.coolWindow);
        cylinder(tableX, 1.042, .39, .045, .02, P.metal);
        box(tableX - table * .36, .963, .29, .085, .18, .055, timber);
        for (let stick = 0; stick < 3; stick++) box(tableX - table * .36 + (stick - 1) * .015, 1.09, .29, .007, .12, .007, S.gold);
      }
      if (bay === bays - 1) {
        const menuX = x + inner * .35;
        box(menuX, 1.51, .30, .41, .63, .12, S.charcoal);
        panel(9, menuX, 1.51, .35, .55, .37);
      }
      face(x, 2.49, inner - .16, .05, P.light, .36, true);
    } else if (food) {
      // Warm inner wall, dark service opening, tiled counter base and stone top.
      face(x, 1.51, inner - .18, 1.40, P.dark, .20);
      face(x, 2.20, inner - .20, .065, P.light, .23, true);
      box(x, .57, .38, inner - .12, .85, .34, P.stone, true);
      for (let tile = 0; tile < 5; tile++) face(x + (tile - 2) * (inner - .12) / 5, .57, .018, .76, P.dark, .554);
      face(x, .47, inner - .14, .018, P.dark, .558);
      box(x, 1.02, .46, inner, .10, .66, kind === 'takoyaki' ? P.metal : P.light, true);
      // Bottle silhouettes and shelves are deliberately inside the opening.
      box(x, 1.55, .28, inner - .28, .055, .13, P.metal);
      for (let bottle = 0; bottle < 4; bottle++) {
        const u = x - inner * .31 + bottle * inner * .12;
        box(u, 1.73, .29, .105, .28, .10, bottle % 2 ? S.gold : S.blue);
        box(u, 1.90, .29, .05, .06, .06, P.metal);
        face(u, 1.74, .075, .085, P.light, .346);
      }
      const workX = x - inner * .19, workW = inner * .52;
      box(workX, 1.09, .50, workW, .035, .42, kind === 'takoyaki' ? P.dark : P.metal);
      if (role === 'counter' && (front.id === 'B037' || front.id === 'B041')) {
        actions.push({ kind: front.id === 'B041' ? 'prep' : 'service', front, x, width: inner });
      }
      if (kind === 'takoyaki' && role === 'counter') {
        // Takoyaki plate: a compact, plausible display,
        // not an enlarged sculpture or a claim about the photographed menu.
        for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
          sphere(workX + (col - 2) * workW / 5.8, 1.14, .40 + row * .17, .058, .052, .058, S.gold);
        }
      } else if (kind === 'sweets' || role === 'cabinet') {
        // Two pastry tiers in a framed sample cabinet. Open viewing faces
        // preserve the small food silhouettes without alpha-sorting glass.
        for (const tier of [0, 1]) {
          box(workX, 1.12 + tier * .29, .52, workW, .035, .40, P.light);
          for (let cake = 0; cake < 4; cake++) {
            const u = workX + (cake - 1.5) * workW / 4.7;
            if (kind === 'takoyaki') {
              box(u, 1.15 + tier * .29, .53, workW / 5.8, .025, .22, P.light);
              for (const side of [-1, 1]) sphere(u, 1.21 + tier * .29, .53 + side * .058, .055, .05, .055, S.gold);
            } else {
              box(u, 1.20 + tier * .29, .53, workW / 6, .10, .21, S.gold);
              box(u, 1.258 + tier * .29, .53, workW / 6, .016, .21, P.light);
            }
          }
        }
        for (const side of [-1, 1]) box(workX + side * (workW / 2 - .025), 1.41, .73, .04, .53, .04, P.metal);
        box(workX, 1.69, .53, workW, .055, .44, P.metal);
      } else {
        for (let cup = 0; cup < 3; cup++) {
          const u = workX + (cup - 1) * workW / 3.6;
          cylinder(u, 1.113, .53, .11, .012, P.light);
          cylinder(u, 1.19, .53, .065, .135, cup % 2 ? S.coral : P.light);
          cylinder(u, 1.26, .53, .050, .004, P.dark);
        }
      }
      // One menu case anchors the service area instead of repeating at every bay.
      const menuX = x + inner * .32, menuW = Math.min(.53, inner * .23);
      if (bay === menuBay) {
        box(menuX, 1.63, .39, menuW + .09, .92, .18, P.metal);
        panel(kind === 'cafe' ? 5 : kind === 'sweets' ? 11 : 4, menuX, 1.63, menuW, .83, .49);
      }
    } else if (kind === 'retail') {
      // H&M stays a clothing frontage: modest mannequins, folded displays and
      // a garment rail, interpreted from the established retail use.
      box(x, .32, .32, inner - .30, .14, .25, P.light);
      const u = x - inner * .20;
      if (role === 'mannequin') {
        sphere(u, 1.82, .33, .10, .13, .075, P.light);
        box(u, 1.38, .33, .39, .57, .14, bay % 2 ? S.coral : S.blue);
        for (const side of [-1, 1]) {
          box(u + side * .105, .79, .33, .085, .52, .095, P.dark);
          b.beam(point(u + side * .21, 1.57, .33), point(u + side * .32, 1.17, .34), .085, P.light);
        }
      }
      const railX = role === 'rail' ? x - inner * .20 : x + inner * .24;
      box(railX, 1.71, .31, inner * .30, .055, .06, P.metal);
      for (let garment = 0; garment < 3; garment++) box(railX + (garment - 1) * inner * .11, 1.40, .33, .13, .54, .09, garment % 2 ? P.light : S.blue);
      face(x, 2.30, inner - .18, .06, P.light, .28, true);
    } else {
      // Lobby/unspecified commercial use: lit wall panels and tenant directory,
      // avoiding invented restaurants below Glico or the two-screen building.
      face(x, 1.50, inner - .26, 1.55, P.coolWindow, .20, true);
      box(x, .44, .30, inner - .32, .27, .18, P.stone);
      panel(10, x, 1.53, .70, 1.10, .24);
      for (const side of [-1, 1]) face(x + side * inner * .34, 1.45, .035, 1.83, P.metal, .26);
    }
    // Closed jambs and soffit establish depth around the existing opaque room.
    // Keep counter openings and walking clearance; no transparent overlay pane.
    if (kind !== 'restaurant') {
      const depth = door ? .39 : .43, reach = door ? .34 : .42;
      for (const side of [-1, 1]) box(x + side * (inner / 2 - .035), 1.40, depth, .055, 2.30, reach, design.frame);
      box(x, 2.565, depth, inner, .055, reach, design.frame);
      if (!door) box(x, .245, depth, inner, .055, reach, P.stone);
      // Short edge highlights describe glazing without covering the interior.
      if (['glazing', 'mannequin', 'rail', 'folded', 'directory'].includes(role)) {
        face(x + inner * .39, 1.82, .018, .63 + variation * .24, P.coolWindow, depth + reach / 2 + .003);
        face(x + inner * .36, 2.23, .018, .25, P.coolWindow, depth + reach / 2 + .003);
      }
    }
    for (const side of [-1, 1]) box(x + side * (pitch / 2 - .07), 1.37, .29, design.frameWidth, 2.74, .20, design.frame);
    if (food && bay === menuBay && design.finish < 2) {
      box(x, 2.52, .43, inner + .02, .12, .64, accent, true);
      face(x, 2.43, inner, .16, accent, .757);
      if (design.finish === 0) for (let seam = 0; seam < 5; seam++) face(x + (seam - 2) * inner / 5, 2.44, .025, .11, P.light, .763);
    }
    if (food && bay === menuBay && design.finish !== 2) {
      const u = x - inner * .36;
      box(u, 2.55, .47, .045, .20, .045, P.metal);
      sphere(u, 2.19, .59, .17, .26, .15, kind === 'takoyaki' ? S.coral : P.warmWindow, true);
      for (const y of [-.16, 0, .16]) {
        const p = point(u, 2.19 + y, .59), radius = .17 * Math.sqrt(1 - (y / .26) ** 2) + .004;
        b.add(new TorusGeometry(radius / front.size, .009 / front.size, 4, 12).rotateX(Math.PI / 2).scale(1, 1, .89).rotateY(front.yaw).translate(p.x, p.y, p.z), P.dark);
      }
      for (const y of [1.92, 2.46]) cylinder(u, y, .59, .08, .04, P.dark);
    }
  }
  box(0, 2.91, .30, width - design.fasciaInset, design.fasciaHeight, .38, food ? accent : P.dark, true);
  face(0, 2.70, width - .18, .055, P.warmWindow, .51, true);
  if (kind === 'restaurant') panel(8, 0, 2.92, Math.min(width - design.fasciaInset - .26, 3.5), design.fasciaHeight - .04, .505);
  else if (food) {
    const art = kind === 'takoyaki' ? 0 : kind === 'dining' ? 1 : kind === 'sweets' ? 2 : 3;
    // One compact header per service group, with portable outlined lettering.
    panel(art, 0, 2.92, Math.min(width - design.fasciaInset - .26, 3.5), design.fasciaHeight - .04, .505);
  }
  return { front: front.id, building: front.building, kind, bays, entrances: entry < 0 ? 0 : 1,
    counters: food ? design.bays.filter(b => b.role === 'counter' || b.role === 'cabinet').length : 0,
    lanterns: food && menuBay >= 0 && design.finish !== 2 ? 1 : 0, menus: kind === 'restaurant' || food && menuBay >= 0 ? 1 : 0,
    layoutKey: design.layoutKey, identity: design.identity, finish: design.finish, artVariant: design.artVariant,
    bayRoles: design.bays.map(b => b.role), bayWidthsM: design.bays.map(b => b.width),
    diningWindows: kind === 'restaurant' ? bays : 0, crabTanks: front.id === 'B046-west' ? 1 : 0,
    bottom: base, top: base + 3.1, maxProjection: .79, evidence: kind === 'restaurant' ? 'S16 owner photos; interpreted window fit' : 'S14 facade; S15 interpreted fittings' };
}
