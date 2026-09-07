import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_PAVEMENT_HEIGHT, SHIBUYA_LAND, SHIBUYA_STATION, cityStationPoint,
  citySurfaceContainsBounds, roadMetres, type RoadPoint } from './road-network.ts';
import { SHIBUYA_RAIL_BRIDGE, SHIBUYA_SUBWAY_ENTRANCES, citySubwayPoint } from './station-layout.ts';
import { SHIBUYA_PALETTE as P } from './palette.ts';
import type { CityFacadePanel } from './architecture.ts';

/** Transit structures and their glass each use one merged batch. */
export function createShibuyaStationGeometry() {
  const solid: BufferGeometry[] = [], glass: BufferGeometry[] = [], panels: CityFacadePanel[] = [];
  const swatches = new Set<string>(), up = new Vector3(0, 1, 0);
  const light = new Vector3(-.4, .8, .5).normalize(), normal = new Vector3(), shadow = new Color(P.ink);
  const add = (geometry: BufferGeometry, swatch: string, glazed = false) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv'); swatches.add(swatch);
    const colors: number[] = [], base = new Color(swatch), color = new Color(), normals = g.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) {
      color.copy(base).lerp(shadow, glazed ? 0 : .32 * (1 - Math.max(0, normal.fromBufferAttribute(normals, i).dot(light))));
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    (glazed ? glass : solid).push(g);
  };
  const box = (p: RoadPoint, y: number, w: number, h: number, d: number, color: string, angle: number, glazed = false) =>
    add(new BoxGeometry(roadMetres(w), roadMetres(h), roadMetres(d)).rotateY(angle)
      .translate(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(y), p.z), color, glazed);
  const beam = (a: Vector3, b: Vector3, radius: number, color: string) => {
    const rotation = new Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    const matrix = new Matrix4().compose(a.clone().add(b).multiplyScalar(.5), rotation, new Vector3(1, 1, 1));
    add(new CylinderGeometry(roadMetres(radius), roadMetres(radius), a.distanceTo(b), 6).applyMatrix4(matrix), color);
  };

  for (const e of SHIBUYA_SUBWAY_ENTRANCES) {
    const angle = Math.atan2(e.facing.x, e.facing.z), half = e.length / 2, w = e.width;
    const at = (x: number, y: number, z: number) => {
      const p = citySubwayPoint(e, x, z);
      return new Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(y), p.z);
    };
    const part = (x: number, y: number, z: number, width: number, height: number, depth: number, color: string, glazed = false) =>
      box(citySubwayPoint(e, x, z), y, width, height, depth, color, angle, glazed);
    // Retaining walls frame a real hole in the ground, not a painted dark patch.
    for (const side of [-1, 1]) {
      part(side * (w / 2 - .16), -1.18, 0, .32, 3.02, e.length, P.stone);
      part(side * (w / 2 - .15), .18, 0, .30, .36, e.length, P.roof);
      part(side * (w / 2 - .15), .37, 0, .35, .08, e.length, P.concrete);
      part(side * (w / 2 - .15), 1.42, -.03, .035, 1.95, e.length - .44, P.glassLight, true);
      for (let z = -half + .18; z <= half; z += (e.length - .36) / 5) {
        part(side * (w / 2 - .15), 1.47, z, .085, 2.28, .085, P.concrete);
        part(side * (w / 2 - .15), .54, z, .14, .14, .14, P.roof);
      }
      for (const y of [.45, 1.06, 2.42]) part(side * (w / 2 - .15), y, 0, .08, .075, e.length, P.concrete);
      // Continuous handrails follow the descent and return horizontally at the lip.
      const lateral = side * (w / 2 - .46);
      beam(at(lateral, 1.00, half + .25), at(lateral, 1.00, half - .38), .037, P.concrete);
      beam(at(lateral, 1.00, half - .38), at(lateral, -1.58, -half + .7), .037, P.concrete);
      for (const t of [0, .33, .66, 1]) {
        const z = half - .38 - t * (e.length - 1.08), y = 1 - t * 2.58;
        beam(at(lateral, y, z), at(lateral + side * .17, y - .10, z), .022, P.roof);
      }
    }
    part(0, -1.27, -half + .21, w, 2.86, .42, P.roof);
    part(0, -2.72, 0, w - .64, .08, e.length - .6, P.ink);
    const count = 18, run = (e.length - .85) / count;
    for (let i = 0; i < count; i++) {
      const z = half - .18 - run * (i + .5), top = -.15 * (i + 1);
      part(0, top - .075, z, w - .64, .15, run + .008, P.roof);
      part(0, top + .007, z, w - .65, .014, run - .025, P.concrete);
      part(0, top + .016, z + run / 2 - .045, w - .70, .012, .045, i === 0 || i === 17 ? P.warmLight : P.stone);
    }
    // Slim metal canopy with translucent top panes and transverse framing.
    for (const side of [-1, 1]) part(side * (w / 2 - .10), 2.58, 0, .21, .22, e.length + .10, P.concrete);
    part(0, 2.55, 0, w - .42, .045, e.length - .3, P.glassLight, true);
    for (let z = -half; z <= half + .01; z += e.length / 5) part(0, 2.60, z, w, .13, .11, P.concrete);
    for (const z of [-half + .35, half - .7]) part(0, 2.44, z, w - .5, .055, .10, P.warmLight);
    // The photo's taller rear service cabinet and horizontal ventilation louvers.
    part(0, 3.03, -half + .63, 1.26, 1.17, 1.10, P.concrete);
    part(0, 3.05, -half + 1.19, 1.02, .80, .025, P.roof);
    for (let i = 0; i < 8; i++) part(0, 2.73 + i * .09, -half + 1.22, 1.05, .032, .06, P.concrete);
    part(0, 3.65, -half + .63, 1.35, .10, 1.17, P.stone);
    part(-w * .29, 2.97, -half + .56, .48, .83, .65, P.roof);
    // Fascia is legible on both approaches. Its backing stays visible from above.
    for (const side of [-1, 1]) {
      const z = side * half;
      part(0, 2.55, z, w + .12, .59, .20, P.concrete);
      const a = citySubwayPoint(e, -side * w / 2, z + side * .106);
      const b = citySubwayPoint(e, side * w / 2, z + side * .106);
      panels.push({ id: `subway-${e.id}-${side === 1 ? 'entry' : 'rear'}`, path: [a, b], width: roadMetres(w),
        height: roadMetres(.49), y: CITY_PAVEMENT_HEIGHT + roadMetres(2.55), design: 10, transit: 'entrance', exit: e.id });
    }
    // Warning dots and a short guidance stem end before the open stair mouth.
    part(0, .014, half + .63, w - .3, .026, .62, P.warmLight);
    for (let x = -w / 2 + .3; x < w / 2 - .18; x += .20) for (const z of [.43, .63, .83])
      part(x, .035, half + z, .055, .018, .055, P.stone);
    for (const x of [-.18, -.06, .06, .18]) part(x, .026, half + 1.12, .045, .025, .35, P.warmLight);
    // Protective corner bollards leave the width of the entry unobstructed.
    for (const side of [-1, 1]) beam(at(side * (w / 2 - .1), 0, half + .70),
      at(side * (w / 2 - .1), .72, half + .70), .07, P.roof);
  }

  // Railway: steel ribs, a deep continuous fascia and a clear road portal.
  const track = SHIBUYA_STATION.trackHeight, trackMetres = (track - CITY_PAVEMENT_HEIGHT) / roadMetres(1);
  const halfLength = SHIBUYA_STATION.halfLength - .025, halfMetres = halfLength / roadMetres(1);
  const rail = (along: number, y: number, across: number, width: number, height: number, depth: number, color: string) =>
    box(cityStationPoint(roadMetres(along), roadMetres(across)), y, width, height, depth, color, SHIBUYA_STATION.angle);
  rail(0, trackMetres - .63, 0, halfMetres * 2, 1.10, 8, P.roof);
  rail(0, trackMetres - .06, 0, halfMetres * 2, .12, 7.6, P.glassLight);
  for (const side of [-1, 1]) {
    rail(0, trackMetres - .61, side * 3.95, halfMetres * 2, SHIBUYA_RAIL_BRIDGE.fasciaHeightMetres, .20, P.stone);
    for (const y of [-1.35, -1.05, -.74, -.43, .13]) rail(0, trackMetres + y, side * 4.07,
      halfMetres * 2, .055, .07, y === -.74 ? P.glassLight : P.concrete);
    for (let a = -halfMetres + .7; a < halfMetres; a += 2.2) {
      rail(a, trackMetres - .62, side * 4.08, .06, 1.57, .045, P.concrete);
      for (const y of [-1.26, -.12]) rail(a, trackMetres + y, side * 4.12, .075, .075, .03, P.roof);
    }
    rail(0, trackMetres + .50, side * 3.76, halfMetres * 2, .05, .045, P.roof);
    rail(0, trackMetres + .90, side * 3.76, halfMetres * 2, .05, .045, P.roof);
    for (let a = -halfMetres + .3; a < halfMetres; a += 2.2) rail(a, trackMetres + .48, side * 3.76, .055, .95, .055, P.roof);
  }
  for (const side of [-1, 1]) rail(0, trackMetres + .035, side * .5335, halfMetres * 2, .12, .09, P.roof);
  for (let a = -halfMetres + .2; a < halfMetres; a += .85) rail(a, trackMetres - .10, 0, .20, .14, 2.15, P.stone);
  for (let a = -halfMetres + 2; a < halfMetres; a += 9) {
    const p = cityStationPoint(roadMetres(a)), r = roadMetres(2.35);
    if (!citySurfaceContainsBounds(SHIBUYA_LAND, { minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r })) continue;
    const pierHeight = SHIBUYA_RAIL_BRIDGE.soffitHeightMetres;
    rail(a, pierHeight / 2, 0, 1.45, pierHeight, 4.1, P.concrete);
    rail(a, .28, 0, 2.05, .56, 4.7, P.stone);
    rail(a, pierHeight + .15, 0, 2.0, .32, 6.8, P.concrete);
  }
  const bridgeCenter = (SHIBUYA_RAIL_BRIDGE.startMetres + SHIBUYA_RAIL_BRIDGE.endMetres) / 2;
  const bridgeLength = SHIBUYA_RAIL_BRIDGE.endMetres - SHIBUYA_RAIL_BRIDGE.startMetres;
  // Readable JR 渋谷駅 on the crossing-facing fascia, in the existing transit hue.
  panels.push({ id: 'jr-shibuya-rail-bridge', path: [cityStationPoint(roadMetres(bridgeCenter + bridgeLength / 2), roadMetres(-4.145)),
    cityStationPoint(roadMetres(bridgeCenter - bridgeLength / 2), roadMetres(-4.145))],
    width: roadMetres(bridgeLength), height: roadMetres(1.43), y: track - roadMetres(.61), design: 10,
    transit: 'viaduct', transparent: true });
  for (let a = -halfMetres + 4; a < halfMetres - 1; a += 16) {
    for (const side of [-1, 1]) rail(a, trackMetres + 2.6, side * 3.2, .11, 5.2, .11, P.roof);
    rail(a, trackMetres + 5.18, 0, .13, .13, 6.65, P.roof);
    for (const side of [-1, 1]) rail(a, trackMetres + 4.93, side * .90, .10, .35, .12, P.stone);
  }
  rail(0, trackMetres + 4.80, 0, halfMetres * 2, .028, .028, P.roof);
  // End portal roofs conceal the existing clipped train loop at both tile edges.
  for (const a of [-halfMetres + 6.72, halfMetres - 6.72]) {
    rail(a, trackMetres + 4.6, 0, 13.44, .32, 8, P.roof);
    for (const side of [-1, 1]) {
      rail(a, trackMetres + 2.2, side * 3.6, 13.44, 4.4, .20, P.glass);
      for (let bay = -6; bay <= 6; bay += 2) rail(a + bay, trackMetres + 2.2, side * 3.74, .10, 4.4, .08, P.concrete);
      for (const y of [.18, 2.5, 4.3]) rail(a, trackMetres + y, side * 3.74, 13.44, .10, .09, P.concrete);
    }
  }
  const merge = (items: BufferGeometry[]) => {
    const geometry = mergeGeometries(items)!;
    for (const item of items) item.dispose();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData.authoredSwatches = [...swatches];
    return geometry;
  };
  return { geometry: merge(solid), glassGeometry: merge(glass), panels };
}
