import { Color, CylinderGeometry, DynamicDrawUsage, ExtrudeGeometry, Group, InstancedMesh, Matrix4,
  Mesh, MeshBasicMaterial, Quaternion, ShapePath, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { DOTONBORI_REFERENCE_HOSTS } from './dotonbori-composition.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P, DOTONBORI_EBISU_PALETTE as E } from './dotonbori-geometry.ts';
import { frontPoint, libraryDotonboriFronts } from './dotonbori-facade-layout.ts';
import { DOTONBORI_LETTERING } from './dotonbori-lettering-data.ts';
import type { DotonboriFragment } from './dotonbori-ownership.ts';
import { OSAKA_NIGHT_SWATCHES as S, mixCityColor } from './palette.ts';

export const DOTONBORI_EBISU_GROUP = 'dotonbori-ebisu-tower';
export const DOTONBORI_EBISU_CABINS = 32;
export const DOTONBORI_EBISU_PERIOD = 15 * 60;
/** Operator: 77.4 m highest point, boarding at 10.5 m, 32 upright cabins.
 * Radius, truss depth and relief are photo-derived, not engineering dimensions.
 * Ground datum is the host's LOD1 minimum; the LOD2 store has a zero base. */
export const DOTONBORI_EBISU = Object.freeze({ groundM: 1.785, highestM: 77.4, boardingM: 10.5,
  cabinRadiusM: 1.4, radiusM: 14.4, lowerM: 28.085, upperM: 63.385 });

/** Arc-length travel around a fixed stadium track. The cabin never rolls with
 * the rail tangent: gravity keeps its seat and floor upright through both turns. */
export function dotonboriEbisuPath(fraction: number, radius: number = DOTONBORI_EBISU.radiusM) {
  const { lowerM: low, upperM: high } = DOTONBORI_EBISU, straight = high - low;
  const perimeter = 2 * straight + 2 * Math.PI * radius;
  let distance = ((fraction % 1 + 1) % 1) * perimeter;
  if (distance < straight) return { x: radius, y: low + distance };
  distance -= straight;
  if (distance < Math.PI * radius) {
    const angle = distance / radius; return { x: radius * Math.cos(angle), y: high + radius * Math.sin(angle) };
  }
  distance -= Math.PI * radius;
  if (distance < straight) return { x: -radius, y: high - distance };
  const angle = Math.PI + (distance - straight) / radius;
  return { x: radius * Math.cos(angle), y: low + radius * Math.sin(angle) };
}

/** Original solid miniature from the operator and Intamin photographs (S22).
 * Closed rails/cabins/relief render from both banks; nothing follows the camera. */
export function createDotonboriEbisuTower(library: DotonboriLibrary) {
  const front = libraryDotonboriFronts(library).find(f => f.id === 'B092');
  if (!front) throw new Error('Ebisu Tower requires its registered Donki source wall.');
  const size = library.layout.tileSizeM, root = new Group(); root.name = DOTONBORI_EBISU_GROUP;
  const sourceBuilding = DOTONBORI_REFERENCE_HOSTS.B092;
  root.userData.sourceBuilding = sourceBuilding;
  root.userData.storefront = { front: 'B092', building: sourceBuilding, kind: 'retail', bays: 6, entrances: 1,
    counters: 0, menus: 0, lanterns: 0, bottom: 2.05, top: 5.15, maxProjection: .39,
    bayRoles: ['merchandise', 'merchandise', 'merchandise', 'entrance', 'merchandise', 'merchandise'],
    bayWidthsM: [4, 4, 4, 5.2, 4, 2.6], evidence: 'S22 Donki identity and river-facing storefront; fitted display/entrance arrangement is interpreted' };
  const b = new DotonboriGeometry(size, DOTONBORI_EBISU_GROUP); b.buildingId = sourceBuilding;
  const fragments: DotonboriFragment[] = [];
  // Author x from the river-facing viewer's left to right, matching the
  // photographed fish/Donpen on the left and Ebisu's bag on the right.
  const point = (x: number, y: number, depth = 3.5) => frontPoint(front, -x, y, depth);
  const shape = (g: BufferGeometry, x: number, y: number, depth: number, color: string, luminous = false) => {
    const p = point(x, y, depth);
    b.add(g.scale(1 / size, 1 / size, 1 / size).rotateY(front.yaw).translate(p.x, p.y, p.z), color, luminous);
  };
  const fragment = (x: number, y: number, depth: number, w: number, h: number, d: number, color: string, id: string) => {
    const p = point(x, y, depth);
    fragments.push({ x: p.x, y: p.y, z: p.z, width: w / size, height: h / size, depth: d / size,
      angle: front.yaw, color, kind: 'furniture', group: DOTONBORI_EBISU_GROUP, sourceBuilding, id });
  };
  const tube = (a: Vector3, c: Vector3, diameter: number, color = P.metal) => {
    const direction = c.clone().sub(a), center = c.clone().add(a).multiplyScalar(.5);
    b.add(new CylinderGeometry(diameter / size / 2, diameter / size / 2, direction.length(), 6)
      .applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
      .translate(center.x, center.y, center.z), color);
  };
  const orb = (x: number, y: number, depth: number, w: number, h: number, d: number, color: string) => {
    shape(new SphereGeometry(1, 16, 10).scale(w / 2, h / 2, d / 2), x, y, depth, color);
  };
  const label = (text: string, x: number, y: number, depth: number, width: number, height: number, color: string) => {
    const outline = DOTONBORI_LETTERING[text], path = new ShapePath(), scale = Math.min(height, width / outline.width);
    for (const [op, ...p] of outline.commands) {
      if (op === 0) path.moveTo(p[0], p[1]);
      else if (op === 1) path.lineTo(p[0], p[1]);
      else if (op === 2) path.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
      else if (op === 3) path.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      else path.currentPath?.closePath();
    }
    const g = new ExtrudeGeometry(path.toShapes(), { depth: .025 / scale, bevelEnabled: false, curveSegments: 3 });
    g.translate(-outline.width / 2, -.5, 0).scale(scale, scale, scale);
    shape(g, x, y, depth, color, true);
  };
  // The commercial body keeps its source roof and setbacks. The wheel projects
  // toward the canal from this wall, rather than occupying a fictional roof site.
  for (const x of [-15.8, 15.8]) b.box(point(x, 23.2, .24), .34, 42, .30, P.metal, front.yaw, false);
  for (let row = 0; row < 8; row++) b.box(point(0, 7.2 + row * 4.6, .15), 30.9, .11, .12, P.roof, front.yaw, false);
  b.box(point(0, 6.5, .32), 31.2, 2.3, .38, S.navy, front.yaw, false);
  label('ドン・キホーテ', 0, 6.5, .55, 23.5, 1.72, P.warmWindow);
  fragment(0, 6.5, .32, 31.2, 2.3, .38, P.warmWindow, 'ebisu-store-fascia');
  // Uneven glazed entrances and merchandise displays, fitted behind the frame.
  for (const [i, x] of [-12.2, -7.6, -2.4, 3.4, 9, 13.2].entries()) {
    const width = i === 3 ? 5.2 : i === 5 ? 2.6 : 4;
    b.box(point(x, 3.6, .15), width, 3.1, .10, i === 3 ? P.dark : P.warmWindow, front.yaw, false, true);
    for (const edge of [-1, 1]) b.box(point(x + edge * width / 2, 3.6, .27), .10, 3.2, .18, P.metal, front.yaw, false);
    if (i !== 3) for (let shelf = 0; shelf < 3; shelf++) {
      b.box(point(x, 2.4 + shelf * .65, .3), width - .35, .055, .20, P.dark, front.yaw, false);
      for (let item = 0; item < 5; item++) b.box(point(x + (item - 2) * (width - .7) / 5, 2.65 + shelf * .65, .29),
        .27, .36, .12, [S.coral, S.gold, S.ivory, S.blue][(item + shelf + i) % 4], front.yaw, false);
    }
  }
  b.box(point(0, 12.05, 1.25), 28.7, .48, 2.7, P.metal, front.yaw, false);
  b.box(point(0, 11, 2.65), 29, 1.55, .23, P.stone, front.yaw, false);
  label('えびすタワー', 0, 10.95, 2.79, 13, .87, P.warmWindow);
  fragment(0, 11.8, 1.3, 29, 2.4, 2.7, P.metal, 'ebisu-boarding-deck');
  // Four tubular rails and transverse/diagonal members form a deep open truss.
  const segments = 96, innerR = 10.4, outerR = 12.8;
  // Match each cross-section by its outer-track station; avoid diagonal members
  // sliding out of register where straight runs meet the rounded returns.
  const station = (i: number, radius: number) => {
    const p = dotonboriEbisuPath(i / segments, outerR);
    if (p.y > DOTONBORI_EBISU.upperM) {
      const a = Math.atan2(p.y - DOTONBORI_EBISU.upperM, p.x);
      return { x: radius * Math.cos(a), y: DOTONBORI_EBISU.upperM + radius * Math.sin(a) };
    }
    if (p.y < DOTONBORI_EBISU.lowerM) {
      const a = Math.atan2(p.y - DOTONBORI_EBISU.lowerM, p.x);
      return { x: radius * Math.cos(a), y: DOTONBORI_EBISU.lowerM + radius * Math.sin(a) };
    }
    return { x: Math.sign(p.x) * radius, y: p.y };
  };
  for (let i = 0; i < segments; i++) {
    const a = station(i, outerR), c = station(i + 1, outerR), ai = station(i, innerR), ci = station(i + 1, innerR);
    for (const depth of [1.25, 3.55]) {
      const rail = depth === 3.55 ? E.frame : P.metal;
      tube(point(a.x, a.y, depth), point(c.x, c.y, depth), .48, rail);
      tube(point(ai.x, ai.y, depth), point(ci.x, ci.y, depth), .38, rail);
      tube(point(a.x, a.y, depth), point(ai.x, ai.y, depth), .16);
      tube(point(a.x, a.y, depth), point(ci.x, ci.y, depth), .14);
    }
    tube(point(a.x, a.y, 1.25), point(c.x, c.y, 3.55), .18);
    if (i % 3 === 0) {
      fragment((a.x + c.x) / 2, (a.y + c.y) / 2, 2.4, Math.abs(c.x - a.x) + .55,
        Math.abs(c.y - a.y) + .55, 2.7, mixCityColor(E.frame, P.metal, .45), `ebisu-track-${i}`);
      orb(a.x, a.y, 3.84, .24, .24, .15, P.warmWindow);
    }
  }
  for (const side of [-1, 1]) {
    for (const depth of [1.25, 3.55]) tube(point(side * outerR, 2, depth), point(side * outerR, 64, depth), .52);
    for (let y = 4; y < 59; y += 4.5) {
      tube(point(side * outerR, y, 1.25), point(side * outerR, y + 4.5, 3.55), .18);
      tube(point(side * outerR, y + 4.5, 1.25), point(side * outerR, y, 3.55), .18);
    }
    tube(point(side * 11.5, 45, 1.4), point(side * 5, 50, 1.4), .24);
    fragment(side * outerR, 32, 2.4, .6, 60, 2.8, P.metal, `ebisu-support-${side}`);
  }
  // Intamin's front/oblique photographs show transverse and diagonal members
  // behind the lower relief, plus oval stiffeners inside the open fixed frame.
  for (const y of [18, 28, 38, 48, 58]) {
    tube(point(-innerR, y, 1.3), point(innerR, y, 1.3), .20);
    tube(point(-innerR, y, 1.3), point(innerR, y + 5, 1.3), .16);
    tube(point(innerR, y, 1.3), point(-innerR, y + 5, 1.3), .16);
    fragment(0, y + 2.5, 1.3, innerR * 2, 5.3, .25, P.metal, `ebisu-brace-${y}`);
  }
  for (const [y, rx, ry, id] of [[35, 9.6, 15.8, 'relief-frame'], [57, 3.6, 2.8, 'upper-stiffener']] as const) {
    for (let i = 0; i < 64; i++) {
      const a = i * Math.PI / 32, c = (i + 1) * Math.PI / 32;
      tube(point(Math.cos(a) * rx, y + Math.sin(a) * ry, 3.2), point(Math.cos(c) * rx, y + Math.sin(c) * ry, 3.2), .22);
    }
    fragment(0, y, 3.2, rx * 2, ry * 2, .3, P.metal, `ebisu-${id}`);
  }
  // Ebisu, his sea bream and Donpen are solid shallow relief. No reference
  // photograph is used as a texture; shapes and palette are original treatments.
  const skin = E.skin, coat = E.coat;
  orb(2, 32.7, 3.9, 15, 20, 2.8, coat);
  orb(-6.4, 36.4, 4.4, 6.5, 15, 1.6, E.coral);
  orb(-6.8, 41.2, 4.5, 6, 5.6, 1.7, E.coral);
  orb(-9.15, 42.1, 4.7, 1.5, .9, .8, skin);
  shape(new CylinderGeometry(0, 1.8, 3.1, 3).rotateZ(Math.PI), -6.1, 28.5, 4.4, E.coral);
  for (let y = 31; y < 41; y += 1.6) for (let x = -8.2; x < -4.5; x += 1.3) {
    shape(new TorusGeometry(.55, .035, 4, 8, Math.PI), x, y, 5.2, skin);
  }
  orb(-6.7, 41.4, 5.2, .65, .65, .25, E.ivory); orb(-6.65, 41.4, 5.36, .28, .3, .12, S.navy);
  orb(7, 28, 4.8, 7, 10, 2.1, E.gold);
  label('ドン・キホーテ', 7, 28.5, 5.9, 5.6, .67, S.navy);
  orb(7.2, 33.8, 5.1, 3.5, 4.5, 1.6, skin);
  orb(1.7, 42.7, 4.6, 10.5, 10.4, 2.5, skin);
  orb(-3.1, 42.3, 4.7, 2.4, 4, 1.8, skin); orb(6.6, 42.3, 4.7, 2.4, 4, 1.8, skin);
  orb(1.6, 47.3, 4.4, 9.5, 2, 2.6, S.navy);
  shape(new CylinderGeometry(1.5, 2.1, 6.7, 8).rotateZ(.08), 1.7, 50, 4.4, S.navy);
  for (const x of [-.55, 4]) {
    shape(new TorusGeometry(1.1, .12, 5, 12, Math.PI), x, 44, 5.9, S.navy);
    orb(x, 41.3, 5.6, 3.7, 2.5, .6, mixCityColor(skin, E.coral, .15));
  }
  orb(1.7, 42.1, 6, 2.1, 2.1, 1.2, skin);
  orb(1.7, 39.8, 5.9, 4.9, 3.2, .4, S.navy);
  orb(1.7, 39.5, 6.15, 3.5, 2, .15, E.coral);
  orb(1.7, 40.3, 6.22, 3.2, .9, .1, E.ivory);
  orb(1.7, 37.4, 5.6, 1.5, 2.2, .7, S.navy);
  // The manufacturer close-ups show inset ears, raised moustache lobes,
  // garment folds and fingers, rather than a flat painted face/mitten outline.
  for (const [x, side] of [[-3.1, -1], [6.6, 1]] as const) {
    orb(x, 42.45, 5.55, 1.05, 2.35, .36, mixCityColor(skin, S.navy, .22));
    shape(new SphereGeometry(1, 12, 8).scale(1.45, .43, .32).rotateZ(side * .32),
      1.7 + side * 1.35, 40.9, 6.14, S.navy);
    tube(point(1.7 + side * 1.05, 38.1, 5.98), point(1.7 + side * .36, 36.8, 5.95), .17, E.ivory);
  }
  for (const side of [-1, 1]) {
    tube(point(1.8 + side * 2.2, 37.8, 5.48), point(2 + side * 1.2, 32.4, 5.52), .22, E.ivory);
    tube(point(2 + side * 1.2, 32.4, 5.52), point(1.8 + side * 3.5, 28.8, 5.15), .12, P.metal);
  }
  for (let finger = 0; finger < 4; finger++) {
    orb(6.8 + finger * .37, 34.5 - finger * .57, 5.94, 1.7, .48, .57, skin);
    orb(-8.6, 35.5 - finger * .58, 5.34, 1.75, .49, .64, skin);
  }
  orb(-8.65, 37.2, 5.25, .65, 1.5, .60, skin);
  orb(-2.9, 26.8, 5.6, 10, 12.3, 2.8, E.blue);
  for (const side of [-1, 1]) shape(new SphereGeometry(1, 12, 8).scale(.85, 2.55, .72).rotateZ(side * .22),
    -2.9 + side * 4.6, 26.1, 5.8, E.blue);
  orb(-2.9, 25.5, 7, 7.5, 8.4, .9, E.ivory);
  for (const x of [-5.1, -1.7]) {
    orb(x, 30.6, 6.9, 2.8, 3.2, .9, E.ivory);
    orb(x + .3, 31.1, 7.4, .82, 1.25, .25, S.navy);
  }
  orb(-3.5, 28.6, 7.4, 6.9, 1.45, 1.1, E.gold);
  orb(-3.5, 28.18, 7.72, 5.5, .40, .58, mixCityColor(E.gold, S.navy, .24));
  orb(-3.5, 27.96, 7.65, 4.8, .47, .63, E.gold);
  orb(-6.1, 21.8, 6.6, 3.8, 2.2, 1, E.gold); orb(.1, 21.8, 6.6, 3.8, 2.2, 1, E.gold);
  for (const foot of [-6.1, .1]) for (const toe of [-1, 0, 1]) orb(foot + toe * .8, 21.7, 7.02, .83, 1.7, .68, E.gold);
  label('ド', -2.9, 25.3, 7.55, 3.8, 3.3, E.coral);
  orb(1.5, 22.3, 5.8, 5.2, 3.5, 1.7, skin);
  for (const [i, [x, y, w, h, color]] of ([[-2.9, 27, 10, 12, E.blue], [1.7, 43, 10, 10, skin],
    [2, 33, 15, 17, coat], [-6.4, 36.4, 6, 15, E.coral], [7, 28, 7, 10, E.gold], [1.7, 49, 5, 7, S.navy]] as const).entries()) {
    fragment(x, y, 5, w, h, 3, color, `ebisu-relief-${i}`);
  }
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true });
  const structure = new Mesh(b.finish(), material); structure.name = 'dotonbori-ebisu-structure';
  structure.userData.sourceBuilding = sourceBuilding; root.add(structure);

  // One shared closed capsule geometry; a single instanced draw for all cabins.
  const cabin = new DotonboriGeometry(1, DOTONBORI_EBISU_GROUP);
  cabin.add(new CylinderGeometry(1.4, 1.4, 1.55, 20).rotateX(Math.PI / 2), E.coral);
  for (const side of [-1, 1]) {
    cabin.add(new CylinderGeometry(1.22, 1.22, .045, 20).rotateX(Math.PI / 2).translate(0, 0, side * .79), P.glass, true);
    cabin.add(new TorusGeometry(1.25, .07, 5, 24).translate(0, 0, side * .835), P.warmWindow, true);
    cabin.box(new Vector3(0, -.65, side * .826), 1.9, .27, .035, E.coral, 0, false);
    cabin.box(new Vector3(0, .2, side * .826), .045, 1.6, .035, P.metal, 0, false);
    for (const x of [-.48, .48]) {
      cabin.add(new SphereGeometry(.16, 6, 5).translate(x, -.02, side * .833), skin);
      cabin.box(new Vector3(x, -.37, side * .836), .29, .42, .04, E.ivory, 0, false);
    }
  }
  cabin.box(new Vector3(0, 1.1, -.96), .55, .5, .38, P.metal, 0, false);
  const cabins = new InstancedMesh(cabin.finish(), material, DOTONBORI_EBISU_CABINS);
  cabins.name = 'dotonbori-ebisu-cabins'; cabins.userData.sourceBuilding = sourceBuilding;
  cabins.instanceMatrix.setUsage(DynamicDrawUsage); cabins.frustumCulled = false; root.add(cabins);
  const matrices = new Matrix4(), rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), front.yaw);
  const scale = new Vector3().setScalar(1 / size), centers = Array.from({ length: DOTONBORI_EBISU_CABINS }, () => new Vector3());
  const cabinInk = new Color(S.ivory);
  for (let i = 0; i < DOTONBORI_EBISU_CABINS; i++) cabins.setColorAt(i, cabinInk);
  let previous = NaN;
  const update = (time: number) => {
    if (time === previous) return;
    previous = time;
    for (let i = 0; i < DOTONBORI_EBISU_CABINS; i++) {
      const p = dotonboriEbisuPath(i / DOTONBORI_EBISU_CABINS + time / DOTONBORI_EBISU_PERIOD);
      centers[i].copy(point(p.x, p.y, 2.4));
      matrices.compose(centers[i], rotation, scale); cabins.setMatrixAt(i, matrices);
    }
    cabins.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { root, material, update, cabins, front,
    snapshot: (): DotonboriFragment[] => [...fragments, ...centers.map((p, i) => ({
      x: p.x, y: p.y, z: p.z, width: 2.8 / size, height: 2.8 / size, depth: 1.7 / size,
      angle: front.yaw, color: E.coral, kind: 'furniture' as const, group: DOTONBORI_EBISU_GROUP,
      sourceBuilding, id: `ebisu-cabin-${i}` }))] };
}
