import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4,
  Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_PAVEMENT_HEIGHT, citySurveyPoint, roadMetres } from './road-network.ts';
import { SHIBUYA_WORKSITE, SHIBUYA_WORKSITE_POINTS } from './construction-layout.ts';
import { SHIBUYA_PALETTE as P } from './palette.ts';
import type { CityFacadePanel } from './architecture.ts';

/** One static batch for the miniature worksite; no extra animation clock. */
export function createShibuyaConstructionGeometry() {
  const parts: BufferGeometry[] = [], panels: CityFacadePanel[] = [];
  const up = new Vector3(0, 1, 0), light = new Vector3(-.35, .82, .45).normalize();
  const world = (e: number, h: number, s: number) => {
    const p = citySurveyPoint(e, s);
    return new Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(h), p.z);
  };
  const add = (geometry: BufferGeometry, swatch: string) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const normals = g.getAttribute('normal'), color = new Color(swatch), normal = new Vector3();
    const colors = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      const shade = .62 + .38 * Math.max(0, normal.fromBufferAttribute(normals, i).dot(light));
      colors.set([color.r * shade, color.g * shade, color.b * shade], i * 3);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3)); parts.push(g);
  };
  const box = (e: number, h: number, s: number, w: number, height: number, d: number, color: string, yaw = -Math.PI / 4) => {
    const p = world(e, h, s);
    add(new BoxGeometry(roadMetres(w), roadMetres(height), roadMetres(d)).rotateY(yaw).translate(p.x, p.y, p.z), color);
  };
  const beam = (a: Vector3, b: Vector3, radius: number, color: string) => {
    const rotation = new Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    const matrix = new Matrix4().compose(a.clone().add(b).multiplyScalar(.5), rotation, new Vector3(1, 1, 1));
    add(new CylinderGeometry(roadMetres(radius), roadMetres(radius), a.distanceTo(b), 6).applyMatrix4(matrix), color);
  };
  // Slightly raised aggregate base; the public pavement remains outside the fence.
  const ring = SHIBUYA_WORKSITE.rings[0], positions: number[] = [];
  for (const [a, b, c] of ShapeUtils.triangulateShape(ring.map(p => new Vector2(p.x, p.z)), [])) {
    for (const i of [a, c, b]) positions.push(ring[i].x, CITY_PAVEMENT_HEIGHT + roadMetres(.018), ring[i].z);
  }
  const ground = new BufferGeometry(); ground.setAttribute('position', new Float32BufferAttribute(positions, 3));
  ground.computeVertexNormals(); add(ground, P.asphaltLight);

  for (const [edge, a] of SHIBUYA_WORKSITE_POINTS.entries()) {
    const b = SHIBUYA_WORKSITE_POINTS[(edge + 1) % SHIBUYA_WORKSITE_POINTS.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.ceil(length / 1.8);
    const dx = (b[0] - a[0]) / length, ds = (b[1] - a[1]) / length;
    const yaw = -Math.PI / 4 - Math.atan2(ds, dx);
    // Inset every panel so all projecting feet and caps remain in the enclosure.
    const at = (t: number, inset = .20) => [a[0] + dx * length * t - ds * inset,
      a[1] + ds * length * t + dx * inset];
    for (let j = 0; j < count; j++) {
      const [e, s] = at((j + .5) / count), gate = edge === 0 && j >= 2 && j <= 4;
      const endInset = j === 0 || j === count - 1 ? .35 : .035;
      box(e, 1.22, s, length / count - endInset, 2.35, .10, gate ? P.glassLight : P.stone, yaw);
      box(e, .28, s, length / count - endInset, .38, .13, P.blue, yaw);
      box(e, 2.43, s, length / count - endInset, .10, .16, P.concrete, yaw);
      if (gate) for (let rib = -2; rib <= 2; rib++) {
        box(e + dx * rib * .26, 1.37, s + ds * rib * .26, .04, 1.74, .15, P.concrete, yaw);
      }
      const [pe, ps] = at((j + .35) / count, .38);
      box(pe, 1.25, ps, .10, 2.5, .10, P.concrete);
      box(pe, .08, ps, .40, .15, .40, P.roof);
      if (j % 3 === 0) box(pe, 2.54, ps, .14, .12, .14, P.warmLight);
    }
    if (edge === 0 || edge === 1) {
      const center = edge === 0 ? .73 : .48, half = 1.65 / length;
      const left = at(center + half, .135), right = at(center - half, .135);
      panels.push({ id: `worksite-notice-${edge}`, path: [citySurveyPoint(left[0], left[1]), citySurveyPoint(right[0], right[1])],
        width: roadMetres(3.3), height: roadMetres(1.05), y: CITY_PAVEMENT_HEIGHT + roadMetres(1.48), design: 10,
        label: edge === 0 ? 'SHIBUYA / WORKS' : 'STATION RENEWAL', caption: 'PEDESTRIAN ROUTE OPEN', layout: 'lightbox' });
    }
  }

  // Foundation formwork and concrete starters with exposed reinforcement cages.
  box(33, .12, 61, 11, .20, 10, P.roof);
  for (const e of [28, 38]) box(e, .42, 61, .34, .6, 9.8, P.concrete);
  for (const s of [56.2, 65.8]) box(33, .42, s, 10.3, .6, .34, P.concrete);
  for (const e of [30, 35.5]) for (const s of [58.3, 63.4]) {
    box(e, .72, s, 1.55, 1.3, 1.55, P.concrete);
    for (const de of [-.47, .47]) for (const ds of [-.47, .47]) beam(world(e + de, 1.3, s + ds), world(e + de, 3.7, s + ds), .035, P.roof);
    for (const h of [1.8, 2.5, 3.2]) for (const side of [-1, 1]) {
      beam(world(e - .5, h, s + side * .5), world(e + .5, h, s + side * .5), .025, P.roof);
      beam(world(e + side * .5, h, s - .5), world(e + side * .5, h, s + .5), .025, P.roof);
    }
  }
  // A compact scaffold bay: decks, guardrails, diagonal braces and access ladder.
  for (const e of [37, 40]) for (const s of [54, 58, 62]) beam(world(e, .1, s), world(e, 6.2, s), .055, P.concrete);
  for (const h of [2.2, 4.4]) {
    box(38.5, h, 58, 3.1, .13, 8.3, P.glassLight);
    for (const e of [37, 40]) for (const rail of [.5, 1]) beam(world(e, h + rail, 54), world(e, h + rail, 62), .035, P.concrete);
    for (const s of [54, 58]) beam(world(40, h - 2.1, s), world(40, h, s + 4), .04, P.stone);
  }
  for (const e of [37.8, 38.4]) beam(world(e, .2, 53.6), world(e, 4.5, 54.6), .04, P.roof);
  for (let h = .4; h < 4.5; h += .35) beam(world(37.8, h, 53.6 + h / 4.5), world(38.4, h, 53.6 + h / 4.5), .03, P.concrete);

  // Site cabin and neatly stored materials along the rear service edge.
  box(10, 1.38, 75, 6.3, 2.7, 3.2, P.concrete);
  box(10, 2.81, 75, 6.5, .20, 3.4, P.stone);
  for (const e of [8.2, 11.6]) box(e, 1.68, 73.38, 1.35, .85, .06, P.glass);
  box(10, 1.12, 73.36, .88, 2.18, .08, P.roof);
  box(10.27, 1.14, 73.30, .07, .17, .05, P.stone);
  for (let i = 0; i < 12; i++) box(7.05 + i * .54, 1.35, 76.62, .045, 2.55, .06, P.glassLight);
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 4; i++) {
    box(19 + i * .42, .22 + layer * .21, 69.5, .28, .18, 3.9, P.concrete);
  }
  for (let i = 0; i < 5; i++) beam(world(25.4 + i * .35, .36, 68.4), world(25.4 + i * .35, .36, 72), .13, P.roof);
  for (const e of [18.5, 20.4]) {
    box(e, .17, 72.3, 1.45, .3, 1.15, P.roof);
    box(e, .65, 72.3, 1.25, .65, .95, P.glassLight);
    box(e, 1.01, 72.3, 1.28, .06, .99, P.stone);
  }

  // Parked tracked excavator, in muted site colors with a small gold boom.
  for (const e of [30.1, 32.3]) {
    box(e, .42, 70.5, .62, .7, 3.3, P.roof);
    for (let i = 0; i < 9; i++) box(e, .80, 69.05 + i * .36, .68, .07, .14, P.concrete);
  }
  box(31.2, .97, 70.5, 2.45, .58, 2.55, P.blue);
  box(30.65, 1.92, 71.0, 1.25, 1.46, 1.52, P.concrete);
  box(30.65, 2.11, 70.22, 1.04, .88, .055, P.glass);
  box(29.99, 2.11, 71.0, .055, .88, 1.22, P.glass);
  box(30.65, 2.72, 71.0, 1.4, .14, 1.65, P.stone);
  beam(world(31.8, 1.35, 70.2), world(31.8, 3.3, 68.4), .20, P.warmLight);
  beam(world(31.8, 3.3, 68.4), world(31.8, 1.0, 67.2), .16, P.warmLight);
  beam(world(31.55, 1.6, 70.0), world(31.55, 2.9, 68.6), .065, P.concrete);
  box(31.8, .65, 67.1, 1.15, .75, .80, P.roof);
  for (const e of [31.4, 31.8, 32.2]) box(e, .28, 66.75, .13, .12, .38, P.concrete);
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return { geometry, panels };
}
