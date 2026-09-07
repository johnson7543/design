import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CircleGeometry, Color, CylinderGeometry,
  Float32BufferAttribute, Matrix4, Quaternion, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHIBUYA_PALETTE as P } from './palette.ts';
import { CITY_PAVEMENT_HEIGHT, roadMetres, type RoadPoint } from './road-network.ts';
import { SHIBUYA_CENTER_GAI_ENTRANCE as ENTRANCE, SHIBUYA_GUARDRAILS, SHIBUYA_STREET_LANTERNS,
  SHIBUYA_STREET_SIGNALS } from './street-layout.ts';
import { cityStreetSignalPhase } from './traffic-cycle.ts';
export { cityStreetSignalPhase } from './traffic-cycle.ts';

export const SHIBUYA_SIGNAL_DIMENSIONS = Object.freeze({ vehicleLens: .30, vehicleHeadHeight: 5.65,
  mastHeight: 6.15, mastReach: 3.8, pedestrianHeadHeight: 2.85, pedestrianLens: .30 });

type Aspect = 'vehicle-go' | 'vehicle-amber' | 'vehicle-stop' | 'walk' | 'dont-walk';
interface LightRange { start: number; count: number; aspect: Aspect; movingApproach: boolean }

/** Original metric geometry: one static batch + one small phase-updated batch.
 * No textures, external models, fonts, lights, shadows or per-frame rebuilding. */
export function createShibuyaStreetFurniture() {
  const parts: BufferGeometry[] = [], lamps: BufferGeometry[] = [], lightRanges: LightRange[] = [];
  const up = new Vector3(0, 1, 0), rotation = new Quaternion(), matrix = new Matrix4();
  const light = new Vector3(-.4, .8, .5).normalize(), normal = new Vector3(), shadow = new Color(P.ink);
  const authoredSwatches = new Set<string>();
  let lightVertices = 0;
  const point = (p: RoadPoint, y: number) => new Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(y), p.z);
  const offset = (p: RoadPoint, direction: RoadPoint, metres: number) => ({
    x: p.x + direction.x * roadMetres(metres), z: p.z + direction.z * roadMetres(metres),
  });
  const add = (geometry: BufferGeometry, swatch: string, aspect?: Aspect, movingApproach = false) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    authoredSwatches.add(swatch);
    const count = g.getAttribute('position').count, colors = new Float32Array(count * 3), base = new Color(swatch), c = new Color();
    const normals = g.getAttribute('normal');
    for (let i = 0; i < count; i++) {
      // Baked shape shading derives only from approved bases. No runtime lights.
      c.copy(base).lerp(shadow, aspect ? 0 : .34 * (1 - Math.max(0, normal.fromBufferAttribute(normals, i).dot(light))));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    if (aspect) {
      lightRanges.push({ start: lightVertices, count, aspect, movingApproach }); lightVertices += count; lamps.push(g);
    } else parts.push(g);
  };
  const box = (p: Vector3, w: number, h: number, d: number, color: string, facing: RoadPoint = { x: 0, z: 1 }) => {
    add(new BoxGeometry(roadMetres(w), roadMetres(h), roadMetres(d))
      .rotateY(Math.atan2(facing.x, facing.z)).translate(p.x, p.y, p.z), color);
  };
  const bar = (a: Vector3, b: Vector3, radius: number, color: string, segments = 6, aspect?: Aspect) => {
    rotation.setFromUnitVectors(up, b.clone().sub(a).normalize());
    matrix.compose(a.clone().add(b).multiplyScalar(.5), rotation, new Vector3(1, 1, 1));
    add(new CylinderGeometry(roadMetres(radius), roadMetres(radius), a.distanceTo(b), segments).applyMatrix4(matrix), color, aspect);
  };
  const tube = (points: Vector3[], radius: number, color: string, steps = 18, sides = 8) =>
    add(new TubeGeometry(new CatmullRomCurve3(points), steps, roadMetres(radius), sides, false), color);
  const facePoint = (p: RoadPoint, facing: RoadPoint, x: number, y: number, depth = 0) => point({
    x: p.x + roadMetres(facing.z * x + facing.x * depth),
    z: p.z + roadMetres(-facing.x * x + facing.z * depth),
  }, y);
  const disk = (p: Vector3, facing: RoadPoint, radius: number, color: string, aspect?: Aspect, moving = false) =>
    add(new CircleGeometry(roadMetres(radius), 16).rotateY(Math.atan2(facing.x, facing.z)).translate(p.x, p.y, p.z), color, aspect, moving);
  const faceStroke = (p: RoadPoint, facing: RoadPoint, stroke: number[], y: number, depth: number, color: string,
    radius = .022, aspect?: Aspect) => {
    for (let i = 2; i < stroke.length; i += 2) {
      bar(facePoint(p, facing, stroke[i - 2], y + stroke[i - 1], depth),
        facePoint(p, facing, stroke[i], y + stroke[i + 1], depth), radius, color, 4, aspect);
    }
  };

  for (const signal of SHIBUYA_STREET_SIGNALS) {
    const { position: p, pedestrianFacing: f, vehicle } = signal;
    const poleHeight = vehicle ? 4.25 : 3.45;
    bar(point(p, 0), point(p, poleHeight), .075, P.roof, 8);
    bar(point(p, 0), point(p, .38), .115, P.roof, 8);
    for (const y of [.12, 2.35, 3.2]) bar(point(p, y), point(p, y + .07), .094, P.concrete, 8);
    box(facePoint(p, f, 0, 1.3, .095), .16, .31, .075, P.ink, f);

    // Lower, vertically paired pedestrian figures face their own crossing.
    const py = SHIBUYA_SIGNAL_DIMENSIONS.pedestrianHeadHeight;
    box(facePoint(p, f, 0, py, .16), .40, .82, .22, P.roof, f);
    for (const [aspect, y] of [['dont-walk', py + .20], ['walk', py - .20]] as const) {
      box(facePoint(p, f, 0, y, .275), .32, .32, .018, P.ink, f);
      box(facePoint(p, f, 0, y + .17, .34), .38, .035, .23, P.roof, f);
      disk(facePoint(p, f, 0, y + .075, .292), f, .036, P.ink, aspect);
      const strokes = aspect === 'walk'
        ? [[0, .025, -.023, -.04, -.08, -.12], [-.023, -.04, .057, -.115],
          [-.005, .017, -.068, -.014, -.09, -.052], [-.005, .017, .065, -.025]]
        : [[0, .025, 0, -.045], [-.016, -.04, -.025, -.125], [.016, -.04, .025, -.125],
          [-.023, .01, -.065, -.055], [.023, .01, .065, -.055]];
      for (const stroke of strokes) faceStroke(p, f, stroke, y, .295, P.ink, .014, aspect);
    }

    if (!vehicle) continue;
    const { armDirection: inward, facing, movingApproach } = vehicle;
    // Paired curb-mounted masts bend into their respective lanes; bases stay off asphalt.
    const curve = [point(p, 3.9), point(p, 4.25), point(offset(p, inward, .13), 5.02),
      point(offset(p, inward, .55), 5.68), point(offset(p, inward, 1.22), 6.05),
      point(offset(p, inward, 2.1), 6.15), point(offset(p, inward, 3.8), 6.15)];
    tube(curve, .075, P.roof, 22);
    const head = offset(p, inward, SHIBUYA_SIGNAL_DIMENSIONS.mastReach);
    bar(point(head, 6.15), point(head, 5.81), .055, P.roof);
    const height = SHIBUYA_SIGNAL_DIMENSIONS.vehicleHeadHeight;
    box(point(head, height), .80, .40, .22, P.roof, facing);
    for (const side of [-1, 1]) {
      const end = facePoint(head, facing, side * .40, height);
      add(new CylinderGeometry(roadMetres(.20), roadMetres(.20), roadMetres(.22), 12)
        .rotateX(Math.PI / 2).rotateY(Math.atan2(facing.x, facing.z)).translate(end.x, end.y, end.z), P.roof);
    }
    // Viewed by its approaching driver: blue/go LEFT, amber MIDDLE, coral/stop RIGHT.
    for (const [index, aspect] of (['vehicle-go', 'vehicle-amber', 'vehicle-stop'] as const).entries()) {
      const x = (index - 1) * .38;
      disk(facePoint(head, facing, x, height, .116), facing, .174, P.ink);
      disk(facePoint(head, facing, x, height, .119), facing, .15, P.ink, aspect, movingApproach);
      const hood = facePoint(head, facing, x, height, .22);
      add(new CylinderGeometry(roadMetres(.17), roadMetres(.17), roadMetres(.22), 12, 1, true, Math.PI / 2, Math.PI)
        .rotateX(Math.PI / 2).rotateY(Math.atan2(facing.x, facing.z)).translate(hood.x, hood.y, hood.z), P.roof);
    }

    // Reference-style regulatory stack; original geometric symbols, not decals.
    disk(facePoint(p, facing, 0, 4.25, .13), facing, .31, P.paper);
    disk(facePoint(p, facing, 0, 4.25, .134), facing, .285, P.blue);
    for (const stroke of [[0, -.20, 0, .20], [-.09, .09, 0, .20, .09, .09],
      [0, -.04, .17, -.04], [.1, .04, .18, -.04, .1, -.12]]) faceStroke(p, facing, stroke, 4.25, .14, P.paper, .024);
    disk(facePoint(p, facing, 0, 3.57, .13), facing, .30, P.coral);
    disk(facePoint(p, facing, 0, 3.57, .134), facing, .245, P.blue);
    for (const stroke of [[-.17, -.17, .17, .17], [-.17, .17, .17, -.17]]) faceStroke(p, facing, stroke, 3.57, .14, P.coral, .025);
    box(facePoint(p, facing, 0, 3.19, .13), .49, .13, .035, P.paper, facing);
    faceStroke(p, facing, [-.16, 0, .16, 0], 3.19, .153, P.coral, .018);
  }

  for (const { start, end } of SHIBUYA_GUARDRAILS) {
    for (const p of [start, end]) bar(point(p, 0), point(p, .92), .035, P.paper);
    for (const y of [.25, .85]) bar(point(start, y), point(end, y), .025, P.paper);
    const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
    bar(point(mid, .25), point(mid, .85), .018, P.paper, 4);
    // Shibuya-style low decorative pedestrian rails, leaving every zebra open.
    for (const p of [start, end]) {
      const near = { x: mid.x + (p.x - mid.x) * .38, z: mid.z + (p.z - mid.z) * .38 };
      tube([point(p, .30), point(near, .73), point(mid, .29)], .013, P.paper, 6, 4);
    }
  }
  for (const p of SHIBUYA_STREET_LANTERNS) {
    bar(point(p, 0), point(p, 3.2), .045, P.roof, 8);
    bar(point(p, .06), point(p, .37), .085, P.roof, 8);
    const glass = point(p, 3.35);
    add(new CylinderGeometry(roadMetres(.13), roadMetres(.09), roadMetres(.38), 6).translate(glass.x, glass.y, glass.z), P.paper);
    for (const y of [3.13, 3.55]) {
      const cap = point(p, y);
      add(new CylinderGeometry(roadMetres(.16), roadMetres(.16), roadMetres(.055), 8).translate(cap.x, cap.y, cap.z), P.roof);
    }
    const roof = point(p, 3.69);
    add(new CylinderGeometry(roadMetres(.018), roadMetres(.18), roadMetres(.25), 8).translate(roof.x, roof.y, roof.z), P.roof);
    for (let i = 0; i < 4; i++) {
      const post = offset(p, { x: Math.cos(i * Math.PI / 2), z: Math.sin(i * Math.PI / 2) }, .095);
      bar(point(post, 3.15), point(post, 3.56), .013, P.roof, 4);
    }
  }

  // Permanent paired Center-Gai main poles: curled tips, three ring collars,
  // recessed end caps and vertical 渋谷センター街 name plates. No ad texture.
  const glyphs = [
    [[0, 1, 1.5, 2], [0, 4, 1.5, 5], [1, 9, 2, 7], [5, 0, 5, 3], [3, 3, 9, 3], [7, 0, 7, 2, 9, 2], [6, 4, 6, 9], [3, 8, 3, 9, 9, 9, 9, 8], [3, 5, 4, 6], [9, 5, 8, 6]],
    [[3, 0, 1, 2], [6, 0, 8, 2], [4.5, 3, 1, 6], [4.5, 3, 8, 6], [2, 6, 7, 6, 7, 9, 2, 9, 2, 6]],
    [[1, 4, 9, 3, 7, 6], [3, 1, 3, 8, 8, 8]],
    [[2, 2, 4, 4], [2, 9, 7, 7, 9, 2]],
    [[4, 0, 1, 5], [3, 2, 9, 2, 7, 7, 3, 10], [3, 4, 6, 6]],
    [[5, 1, 5, 9]],
    [[2, 0, 0, 2], [2, 3, 0, 5], [1, 4, 1, 9], [4, 1, 6, 1], [5, 0, 5, 3], [3, 3, 7, 3], [4, 5, 6, 5], [5, 4, 5, 8], [3, 8, 7, 8], [8, 1, 10, 1], [8, 4, 10, 4], [9, 4, 9, 9, 8, 9]],
  ];
  for (const [index, p] of ENTRANCE.posts.entries()) {
    const other = ENTRANCE.posts[1 - index], length = Math.hypot(other.x - p.x, other.z - p.z);
    const inward = { x: (other.x - p.x) / length, z: (other.z - p.z) / length };
    const arc = (t: number) => point(offset(p, inward, ENTRANCE.curlMetres * (1 - Math.cos(t))),
      ENTRANCE.heightMetres - 1.8 + 1.8 * Math.sin(t));
    bar(point(p, 0), point(p, 4.6), ENTRANCE.postRadiusMetres, P.concrete, 12);
    tube(Array.from({ length: 13 }, (_, i) => arc(i / 12 * Math.PI / 2)), ENTRANCE.postRadiusMetres, P.concrete, 20, 12);
    for (const y of [.10, 3.16, 3.34, 3.52]) {
      bar(point(p, y), point(p, y + .10), .30, P.roof, 12);
      bar(point(p, y + .10), point(p, y + .16), .29, P.concrete, 12);
    }
    const tip = arc(Math.PI / 2);
    disk(tip.clone().add(new Vector3(inward.x, 0, inward.z).multiplyScalar(roadMetres(.008))), inward, .21, P.roof);
    disk(tip.clone().add(new Vector3(inward.x, 0, inward.z).multiplyScalar(roadMetres(.012))), inward, .14, P.ink);
    const nameBand: number[] = [], edges: Vector3[][] = [[], []];
    for (let j = 0; j <= 20; j++) {
      const y = 4.0 + j / 20 * 2.32, t = Math.asin(Math.max(0, (y - 4.6) / 1.8));
      const anchor = offset(p, inward, ENTRANCE.curlMetres * (1 - Math.cos(t)));
      for (const [side, x] of [-.17, .17].entries()) edges[side].push(facePoint(anchor, ENTRANCE.facing, x, y, .25));
      if (j) for (const v of [edges[0][j - 1], edges[1][j - 1], edges[1][j], edges[0][j - 1], edges[1][j], edges[0][j]]) {
        nameBand.push(v.x, v.y, v.z);
      }
    }
    const plaque = new BufferGeometry(); plaque.setAttribute('position', new Float32BufferAttribute(nameBand, 3)); plaque.computeVertexNormals();
    add(plaque, P.paper);
    for (const edge of edges) for (let j = 1; j < edge.length; j++) bar(edge[j - 1], edge[j], .010, P.roof, 4);
    for (const [letter, strokes] of glyphs.entries()) {
      const y = 6.16 - letter * .33;
      const t = Math.asin(Math.max(0, (y - 4.6) / 1.8));
      const anchor = offset(p, inward, ENTRANCE.curlMetres * (1 - Math.cos(t)));
      for (const stroke of strokes) faceStroke(anchor, ENTRANCE.facing,
        stroke.map((v, i) => i % 2 ? (.5 - v / 10) * .24 : (v / 10 - .5) * .24), y, .265, P.ink, .009);
    }
    // Small permanent access panels on the lower mast, not seasonal campaign flags.
    box(facePoint(p, ENTRANCE.facing, 0, 1.08, .242), .22, .56, .025, P.roof, ENTRANCE.facing);
    box(facePoint(p, ENTRANCE.facing, 0, 1.1, .258), .17, .47, .014, P.concrete, ENTRANCE.facing);
  }

  const merge = (items: BufferGeometry[]) => {
    const geometry = mergeGeometries(items)!;
    for (const item of items) item.dispose();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  };
  const geometry = merge(parts), lightGeometry = merge(lamps);
  geometry.userData.authoredSwatches = [...authoredSwatches];
  let lastPhase: ReturnType<typeof cityStreetSignalPhase> | undefined;
  const setTime = (time: number) => {
    const phase = cityStreetSignalPhase(time);
    if (phase === lastPhase) return;
    lastPhase = phase;
    const colors = lightGeometry.getAttribute('color'), color = new Color();
    for (const { start, count, aspect, movingApproach } of lightRanges) {
      const go = movingApproach && phase === 'drive', amber = movingApproach && phase === 'amber';
      const lit = aspect === 'walk' ? phase === 'walk' : aspect === 'dont-walk' ? phase !== 'walk'
        : aspect === 'vehicle-go' ? go : aspect === 'vehicle-amber' ? amber : !go && !amber;
      color.set(!lit ? P.ink : aspect === 'walk' || aspect === 'vehicle-go' ? P.signalGo
        : aspect === 'vehicle-amber' ? P.warmLight : P.coral);
      for (let i = start; i < start + count; i++) colors.setXYZ(i, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  };
  setTime(4);
  return { geometry, lightGeometry, lightRanges: Object.freeze(lightRanges), setTime };
}
