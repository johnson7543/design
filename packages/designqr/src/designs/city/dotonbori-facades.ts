import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { mergeDotonboriGeometry, tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { frontPoint, fitDotonboriPanel, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { wallPatch, wallCoverage, type WallRect } from './dotonbori-walls.ts';
export { DOTONBORI_NIGHT_FRONTS } from './dotonbori-facade-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { contentVariation } from '../content-variation.ts';
import { cityNoise } from './building-variation.ts';

import { paintDotonboriNightSigns } from './dotonbori-sign-artwork.ts';
import { DOTONBORI_SIGN_ARTWORK, DOTONBORI_SIGN_ATLAS, DOTONBORI_SIGN_PANELS, mapDotonboriSignArt } from './dotonbori-sign-layout.ts';
export { paintDotonboriNightSigns } from './dotonbori-sign-artwork.ts';

import { createDotonboriStorefront, dotonboriStoreKind } from './dotonbori-storefronts.ts';
import { paintDotonboriStorefronts } from './dotonbori-storefront-artwork.ts';
import { addDotonboriStorefrontAccess } from './dotonbori-storefront-access.ts';
import { createDotonboriContextStorefront } from './dotonbori-ground-floor-details.ts';
import { createDotonboriCloth, DOTONBORI_NOREN, type DotonboriClothPanel } from './dotonbori-cloth.ts';
import { createDotonboriShopActivity, type DotonboriShopActionAnchor } from './dotonbori-shop-activity.ts';
import { addDotonboriReferenceMargins, dotonboriReferenceWallColor } from './dotonbori-surface-finishes.ts';
import { createDotonboriKaniFacade } from './dotonbori-kani-facade.ts';
import { createDotonboriKaniSign, addDotonboriKaniSupports } from './dotonbori-kani-sign.ts';
import { dotonboriFacadeRib } from './dotonbori-facade-ribs.ts';
import { addDotonboriEbisubashiSetback, dotonboriRibPositions } from './dotonbori-ebisubashi-facade.ts';

export function createDotonboriFacades(library: DotonboriLibrary, modules: readonly (readonly boolean[])[], fronts: readonly DotonboriFront[], retainedMaterials?: MeshBasicMaterial[]) {
  const size = library.layout.tileSizeM, root = new Group(); root.name = 'dotonbori-night-frontages';
  const b = new DotonboriGeometry(size, 'dotonbori-observed-facades');
  const access = new DotonboriGeometry(size, 'dotonbori-storefront-forecourts');
  const signs: PlaneGeometry[] = [], shopArtwork: PlaneGeometry[] = [], fragments: DotonboriFragment[] = [];
  const clothPanels: DotonboriClothPanel[] = [];
  const actionAnchors: DotonboriShopActionAnchor[] = [];
  const shops: (ReturnType<typeof createDotonboriStorefront> | ReturnType<typeof createDotonboriContextStorefront> | ReturnType<typeof createDotonboriKaniFacade>)[] = [];
  const marginCoverage = addDotonboriReferenceMargins(b, fronts);
  const signPanels: { front: string; building: string; art: number; y: number; width: number; height: number; vertex: number }[] = [];
  let logoSlot: { vertex: number; x: number; y: number; z: number; width: number; height: number; angle: number; sourceBuilding: string } | undefined;
  const seed = contentVariation(modules);
  for (const [frontIndex, front] of fronts.entries()) {
    if (front.id === 'B092') {
      b.buildingId = front.building;
      const skin = wallPatch(front.wall, front, .055 / size);
      if (skin) b.add(skin, P.building);
      continue; // Ebisu Tower supplies the Donki fittings above this exclusive finish.
    }
    const sourceBuilding = b.buildingId = front.building, fragmentStart = b.fragments.length, yaw = front.yaw;
    const point = (x: number, y: number, offset = 0) => frontPoint(front, x, y, offset);
    const rect = (x: number, y: number, w: number, h: number): WallRect => ({
      minU: Math.max(front.minU, front.u + (x - w / 2) / size), maxU: Math.min(front.maxU, front.u + (x + w / 2) / size),
      minY: Math.max(front.minY, (y - h / 2) / size), maxY: Math.min(front.maxY, (y + h / 2) / size),
    });
    const patch = (x: number, y: number, w: number, h: number, color: string, offset = .08, glow = false, morph = false, excluded: WallRect[] = []) => {
      const region = rect(x, y, w, h);
      if (region.maxU <= region.minU || region.maxY <= region.minY) return;
      const geometry = wallPatch(front.wall, region, offset / size, excluded);
      if (!geometry) return;
      b.add(geometry, color, glow);
      if (morph && wallCoverage(front.wall, region) >= w * h / size ** 2 * .999) {
        const p = point(x, y, offset);
        fragments.push({ x: p.x, y: p.y, z: p.z, width: w / size, height: h / size, depth: .04 / size,
          color, angle: yaw, kind: 'furniture', group: `dotonbori-frontage-${front.id}`, sourceBuilding });
      }
    };
    const panel = (art: number, requestedY: number, requestedW: number, requestedH: number) => {
      const fitted = fitDotonboriPanel(front, requestedY, requestedW, requestedH);
      if (!fitted) throw new Error(`Dotonbori sign ${front.id}/${art} has no supporting wall`);
      const { y, width: w, height: h } = fitted;
      patch(0, y, w + .24, h + .24, P.dark, .34, false, true);
      // Shallow cabinet reveals and separate metal caps, as visible between
      // the dense sign stacks in S6/S14. Caps meet edge rails without doubles.
      for (const side of [-1, 1]) {
        b.box(point(side * (w / 2 + .06), y, .25), .12, h, .30, P.metal, yaw, false);
        b.box(point(0, y + side * (h / 2 + .06), .25), w + .24, .12, .30, P.metal, yaw, false);
      }
      const plane = new PlaneGeometry(w / size, h / size).rotateY(yaw);
      tagDotonboriBuilding(plane, sourceBuilding);
      const p = point(0, y, .42); plane.translate(p.x, p.y, p.z);
      mapDotonboriSignArt(plane, art);
      const vertex = signs.reduce((n, g) => n + g.getAttribute('position').count, 0);
      signPanels.push({ front: front.id, building: sourceBuilding, art, y, width: w, height: h, vertex });
      if (front.id === 'B046' && art === 6) {
        const anchor = point(0, y, .60);
        logoSlot = { vertex,
          x: anchor.x, y: anchor.y, z: anchor.z, width: (w - .40) / size, height: (h - .40) / size, angle: yaw, sourceBuilding };
      }
      signs.push(plane);
      for (const edge of [-1, 1]) patch(edge * (w / 2 + .06), y, .055, h, P.coolWindow, .44, true);
      if ([1, 4, 5, 6, 7, 8, 13, 15, 16, 17].includes(art)) {
        const lights = Math.max(2, Math.floor(w / 2.8));
        for (let light = 0; light < lights; light++) {
          const x = ((light + .5) / lights - .5) * w, top = y + h / 2 - .12;
          b.beam(point(x, top, .40), point(x, top, .90), .075, P.metal);
          b.box(point(x, top, .87), .42, .16, .26, P.dark, yaw, false);
          patch(x, top - .04, .31, .07, P.warmWindow, 1.01, true);
        }
      }
      const rows = art >= 15 ? 2 : 4;
      for (let row = 0; row < rows; row++) for (let col = 0; col < 3; col++) {
        const p = point((col - 1) * w / 3, y + ((row + .5) / rows - .5) * h, .42);
        fragments.push({ x: p.x, y: p.y, z: p.z, width: w / 3 / size, height: h / rows / size, depth: .10 / size,
          angle: yaw, color: DOTONBORI_SIGN_ARTWORK[art][1],
          kind: 'sign', group: `dotonbori-${front.id}-sign-${art}`, sourceBuilding });
      }
    };
    if (!front.groundFloorOnly) patch(0, (front.top + front.bottom) / 2, front.width, front.top - front.bottom, dotonboriReferenceWallColor(front), .055);
    if (front.id === 'B046-south') {
      shops.push(createDotonboriKaniFacade(b, front, signs, fragments));
      addDotonboriKaniSupports(b, front);
      for (const fragment of b.fragments.slice(fragmentStart)) fragment.group = 'dotonbori-frontage-B046-south';
      continue;
    }
    const centralShop = !!dotonboriStoreKind(front) || !!front.context;
    const shop = rect(0, front.bottom + 1.55, front.width, 3.1);
    const top = front.groundFloorOnly ? front.top : front.id.startsWith('B034') ? Math.min(front.top, 42) : front.id.startsWith('B031') ? 33 : front.id === 'B040' ? front.top : front.id.startsWith('B046') ? 18 : front.id === 'B037-east' ? 11.6 : front.id === 'B037' ? 7.8 : 7;
    patch(0, (top + front.bottom) / 2, front.width, top - front.bottom, front.id === 'B046-west' ? P.stone : P.glass, .08, false, false, centralShop ? [shop] : []);
    const bays = Math.max(3, Math.round(front.width / 1.8)), floors = Math.floor((top - front.bottom) / 3.1);
    for (let floor = centralShop ? 1 : 0; floor < floors; floor++) {
      const y = front.bottom + 1.55 + floor * 3.1;
      for (let col = 0; col < bays; col++) {
        const x = (col + .5) / bays * front.width - front.width / 2;
        const lit = floor === 0 || cityNoise(frontIndex * 601 + floor * 13 + col * 7, seed) > .66;
        patch(x, y, front.width / bays - .16, 2.47, lit ? (floor + col) % 3 ? P.warmWindow : P.coolWindow : P.glass, .14, lit);
        // Split glazing, recessed transoms and occasional drawn blinds make
        // the narrow bays readable without adding a second facade skin.
        patch(x, y + .64, front.width / bays - .16, .06, P.metal, .18);
        if (lit && cityNoise(frontIndex * 809 + floor * 19 + col * 11, seed) > .52) {
          patch(x, y + .93, front.width / bays - .20, .29, P.stone, .17);
        }
      }
      patch(0, y + 1.4, front.width, .20, P.metal, .20, false, floor % 2 === 0);
    }
    const mullionBase = front.bottom + (centralShop ? 3.1 : 0);
    if (top > mullionBase) for (let col = 0; col <= bays; col++) patch(col / bays * front.width - front.width / 2, (top + mullionBase) / 2, .10, top - mullionBase, P.metal, .24);
    if (centralShop) {
      access.buildingId = sourceBuilding;
      addDotonboriStorefrontAccess(access, front, library);
      shops.push(front.context ? createDotonboriContextStorefront(b, front, patch, shopArtwork, fragments)
        : createDotonboriStorefront(b, front, patch, shopArtwork, fragments, clothPanels, actionAnchors));
    }
    else {
      patch(0, front.bottom + .12, front.width, .24, P.dark, .26);
      patch(0, front.bottom + 3.05, front.width, .10, P.warmWindow, .28, true);
    }
    if (front.id.startsWith('B034')) {
      const base = Math.max(front.bottom, 10);
      for (const x of dotonboriRibPositions(front, fronts)) {
        const geometry = dotonboriFacadeRib(front.wall, rect(x, (top + base) / 2, .42, top - base), size);
        if (!geometry) continue;
        b.add(geometry, P.metal);
        const p = point(x, (top + base) / 2, .35);
        fragments.push({ x: p.x, y: p.y, z: p.z, width: .42 / size, height: (top - base) / size, depth: .12 / size,
          color: P.metal, angle: yaw, kind: 'furniture', group: `dotonbori-frontage-${front.id}`, sourceBuilding });
      }
    } else if (front.id === 'B039') {
      // The window/service band below SAMTY is visible in both S6 and S14.
      // Unit sizes and spacing are miniature interpretations of that band.
      for (let bay = 0; bay < 4; bay++) {
        const x = (bay - 1.5) * front.width / 4;
        patch(x, 13.4, front.width / 4 - .16, 2.2, P.glass, .14);
        patch(x, 13.4, .075, 2.2, P.metal, .20);
        b.box(point(x, 12.6, .27), .96, .55, .34, P.stone, yaw, false);
        for (let fin = 0; fin < 4; fin++) patch(x, 12.41 + fin * .11, .80, .035, P.dark, .46);
      }
      patch(0, 12.17, front.width, .13, P.metal, .22);
    }
    for (const sign of DOTONBORI_SIGN_PANELS.filter(s => s.front === front.id)) {
      panel(sign.art, sign.y, 'widthInset' in sign ? front.width - sign.widthInset : sign.width, sign.height);
    }
    for (const fragment of b.fragments.slice(fragmentStart)) fragment.group = `dotonbori-frontage-${front.id}`;
  }
  addDotonboriEbisubashiSetback(b, library, fronts);
  const material = retainedMaterials?.[0] ?? new MeshBasicMaterial({ vertexColors: true, transparent: true });
  const facade = new Mesh(b.finish(), material); facade.userData.storefronts = shops; facade.userData.marginCoverage = marginCoverage;
  facade.name = 'dotonbori-photo-facade-details'; root.add(facade);
  const forecourts = new Mesh(access.finish(), material); forecourts.name = 'dotonbori-storefront-forecourts'; root.add(forecourts);
  let map: CanvasTexture | undefined;
  if (!retainedMaterials && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = DOTONBORI_SIGN_ATLAS.width; canvas.height = DOTONBORI_SIGN_ATLAS.height;
    const ctx = canvas.getContext('2d');
    if (ctx) { paintDotonboriNightSigns(ctx); map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 2; }
  }
  const signMaterial = retainedMaterials?.[1] ?? new MeshBasicMaterial({ ...(map ? { map } : { color: S.blue }), transparent: true });
  const signMesh = new Mesh(mergeDotonboriGeometry(signs), signMaterial); signMesh.name = 'dotonbori-night-signs'; signMesh.userData.panels = signPanels; root.add(signMesh);
  signs.forEach(geometry => geometry.dispose());
  let shopMap: CanvasTexture | undefined;
  if (!retainedMaterials && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1536;
    const ctx = canvas.getContext('2d');
    if (ctx) { paintDotonboriStorefronts(ctx); shopMap = new CanvasTexture(canvas); shopMap.colorSpace = SRGBColorSpace; shopMap.anisotropy = 2; }
  }
  const shopMaterial = retainedMaterials?.[2] ?? new MeshBasicMaterial({ ...(shopMap ? { map: shopMap } : { color: P.warmWindow }), transparent: true });
  const shopMesh = new Mesh(mergeDotonboriGeometry(shopArtwork), shopMaterial); shopMesh.name = 'dotonbori-storefront-artwork'; root.add(shopMesh);
  shopArtwork.forEach(geometry => geometry.dispose());
  const cloth = createDotonboriCloth(clothPanels, size, retainedMaterials?.[3]);
  cloth.mesh.name = DOTONBORI_NOREN; root.add(cloth.mesh);
  const actions = createDotonboriShopActivity(library, actionAnchors, retainedMaterials?.[4]); root.add(actions.mesh);
  const kaniFront = fronts.find(f => f.id === 'B046-south');
  const kani = kaniFront ? createDotonboriKaniSign(kaniFront, retainedMaterials?.[5]) : undefined;
  if (kani) root.add(kani.mesh);
  const uv = signMesh.geometry.getAttribute('uv');
  const slot = logoSlot;
  const originalUV = slot ? Array.from({ length: 4 }, (_, i) => [uv.getX(slot.vertex + i), uv.getY(slot.vertex + i)]) : [];
  let hasLogo = false, lightLogoBacking = signMaterial.userData.lightLogoBacking === true;
  const setLogoPresent = (present: boolean, lightBacking = false) => {
    if (!slot || (present === hasLogo && lightBacking === lightLogoBacking)) return;
    if (lightBacking !== lightLogoBacking) {
      const canvas = signMaterial.map?.image as HTMLCanvasElement | undefined;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const { columns, rows, width, height } = DOTONBORI_SIGN_ATLAS;
        ctx.fillStyle = lightBacking ? S.ivory : S.navy;
        ctx.fillRect(0, 3 * height / rows, width / columns, height / rows);
        signMaterial.map!.needsUpdate = true;
      }
      lightLogoBacking = lightBacking;
      signMaterial.userData.lightLogoBacking = lightBacking;
    }
    hasLogo = present;
    originalUV.forEach(([u, v], i) => uv.setXY(slot.vertex + i,
      present ? u - 2 / DOTONBORI_SIGN_ATLAS.columns : u, present ? v - 2 / DOTONBORI_SIGN_ATLAS.rows : v));
    uv.needsUpdate = true;
  };
  return { root, materials: [material, signMaterial, shopMaterial, cloth.material, actions.material, ...(kani ? [kani.material] : [])],
    fragments: [...b.fragments, ...fragments], cloth, actions, kani, logoSlot, setLogoPresent };
}
