import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry,
  Matrix4, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HACHIKO_SCULPTURE_DATA as SCULPTURE } from './hachiko-sculpture-data.ts';
import { HACHIKO_BENCHES, HACHIKO_FORECOURT, HACHIKO_GARDEN_BEDS, HACHIKO_MONUMENT, HACHIKO_TREES,
  HACHIKO_SQUARE_OFFSET, STATION_CURB_TREES, STATION_CURB_GARDENS, hachikoSquarePoint } from './hachiko-layout.ts';
import { CITY_PAVEMENT_HEIGHT, cityPointInPolygon, citySurfaceDistance, roadMetres, type RoadPolygon } from './road-network.ts';
import { SHIBUYA_PALETTE as P } from './palette.ts';

const noise = (n: number) => { const v = Math.sin(n * 127.1 + 813.7) * 43758.5453; return v - Math.floor(v); };

/** Static landmark and Blender sculpture in one merged draw call.
 * Hachiko uses the shared metric scale and city-group morph. */
export function createHachikoSquareGeometry() {
  const parts: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0), light = new Vector3(-.35, .82, .45).normalize();
  const normal = new Vector3(), matrix = new Matrix4(), rotation = new Quaternion();
  const world = (e: number, y: number, s: number) => {
    const p = hachikoSquarePoint(e, s);
    return new Vector3(p.x, CITY_PAVEMENT_HEIGHT + roadMetres(y), p.z);
  };
  const add = (geometry: BufferGeometry, swatch: string | Color, shade = true) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const n = g.getAttribute('normal'), count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3), color = new Color(swatch);
    for (let i = 0; i < count; i++) {
      const amount = shade ? .62 + .38 * Math.max(0, normal.fromBufferAttribute(n, i).dot(light)) : 1;
      colors.set([color.r * amount, color.g * amount, color.b * amount], i * 3);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3)); parts.push(g);
  };
  const box = (e: number, y: number, s: number, w: number, h: number, d: number, color: string | Color, yaw = -Math.PI / 4) => {
    const p = world(e, y, s);
    add(new BoxGeometry(roadMetres(w), roadMetres(h), roadMetres(d)).rotateY(yaw).translate(p.x, p.y, p.z), color);
  };
  const branch = (a: Vector3, b: Vector3, radius: number, color: string, topRadius = radius, segments = 7) => {
    rotation.setFromUnitVectors(up, b.clone().sub(a).normalize());
    matrix.compose(a.clone().add(b).multiplyScalar(.5), rotation, new Vector3(1, 1, 1));
    add(new CylinderGeometry(roadMetres(topRadius), roadMetres(radius), a.distanceTo(b), segments).applyMatrix4(matrix), color);
  };
  const crown = (e: number, y: number, s: number, rx: number, ry: number, rz: number, color: string, detail = 0) => {
    const p = world(e, y, s);
    add(new IcosahedronGeometry(1, detail).scale(roadMetres(rx), roadMetres(ry), roadMetres(rz))
      .rotateY(noise(e * 10 + s) * Math.PI).translate(p.x, p.y, p.z), color);
  };
  const surface = (polygon: RoadPolygon, height: number, color: string | Color) => {
    const ring = polygon.rings[0], points = ring.map(p => new Vector2(p.x, p.z)), positions: number[] = [];
    for (const [a, b, c] of ShapeUtils.triangulateShape(points, [])) {
      const order = (ring[b].x - ring[a].x) * (ring[c].z - ring[a].z) - (ring[b].z - ring[a].z) * (ring[c].x - ring[a].x) > 0
        ? [a, c, b] : [a, b, c];
      for (const i of order) positions.push(ring[i].x, CITY_PAVEMENT_HEIGHT + roadMetres(height), ring[i].z);
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); add(g, color, false);
  };

  // Subtle staggered paving continues across the photo forecourt, with no
  // contrasting rectangular pad around the statue or blocked station approach.
  surface(HACHIKO_FORECOURT, .018, new Color(P.concrete).lerp(new Color(P.roof), .09));
  const paver = new Color(P.concrete), joint = new Color(P.roof);
  for (let row = 0; row < 100; row++) for (let col = 0; col < 40; col++) {
    const e = 4.7 + col * .6 + (row % 2) * .3, s = 32 + row * .3;
    const corners = [[e, s], [e + .582, s], [e + .582, s + .284], [e, s + .284]].map(([x, z]) => hachikoSquarePoint(x, z));
    if (!corners.every(p => cityPointInPolygon(p, HACHIKO_FORECOURT))) continue;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 2, 1, 0, 3, 2].flatMap(i =>
      [corners[i].x, CITY_PAVEMENT_HEIGHT + roadMetres(.023), corners[i].z]), 3));
    g.computeVertexNormals();
    add(g, paver.clone().lerp(joint, .015 + noise(row * 40 + col) * .022), false);
  }
  for (const [index, bed] of HACHIKO_GARDEN_BEDS.entries()) {
    surface(bed, .10, new Color(P.foliage).lerp(new Color(P.roof), .46));
    const ring = bed.rings[0];
    for (let i = 0; i < ring.length; i++) {
      const a = new Vector3(ring[i].x, CITY_PAVEMENT_HEIGHT + roadMetres(.13), ring[i].z);
      const next = ring[(i + 1) % ring.length], b = new Vector3(next.x, a.y, next.z);
      rotation.setFromUnitVectors(up, b.clone().sub(a).normalize());
      matrix.compose(a.clone().add(b).multiplyScalar(.5), rotation, new Vector3(1, 1, 1));
      add(new CylinderGeometry(roadMetres(.15), roadMetres(.15), a.distanceTo(b), 5).applyMatrix4(matrix),
        new Color(P.roof).lerp(new Color(P.stone), .38));
    }
    // Low shrubs and ornamental grass leave the dog and its pedestal legible.
    for (let i = 0; i < 300; i++) {
      const e = -4.3 + noise(i * 5 + index) * 13, s = 35.9 + noise(i * 5 + index + 1) * 26;
      if (!cityPointInPolygon(hachikoSquarePoint(e, s), bed)) continue;
      crown(e, .25, s, .38 + noise(i) * .28, .28, .44, i % 17 === 0 ? P.foliageHighlight : P.foliage);
    }
  }

  for (const { from, to } of HACHIKO_BENCHES) {
    for (const y of [.48, .69]) branch(world(from[0], y, from[1]), world(to[0], y, to[1]), .11, P.concrete, .11, 10);
    for (const t of [0, .5, 1]) {
      const e = from[0] + (to[0] - from[0]) * t, s = from[1] + (to[1] - from[1]) * t;
      branch(world(e, .08, s), world(e, .85, s), .075, P.roof);
    }
  }
  // Stone lanterns, natural rocks and the low rear rail visible in the supplied garden views.
  for (const [e, s] of [[2.0, 43.6], [-1.0, 55.6]]) {
    crown(e, .23, s, .47, .23, .42, P.roof, 1);
    branch(world(e, .26, s), world(e, .94, s), .19, P.roof, .14, 8);
    box(e, 1.01, s, .57, .16, .57, P.roof);
    box(e, 1.28, s, .4, .42, .4, P.roof);
    for (const side of [-1, 1]) box(e + side * .205, 1.30, s, .012, .19, .21, P.ink);
    const p = world(e, 1.58, s);
    add(new CylinderGeometry(roadMetres(.19), roadMetres(.51), roadMetres(.28), 4).rotateY(Math.PI / 4).translate(p.x, p.y, p.z), P.roof);
    crown(e, 1.82, s, .14, .21, .14, P.roof, 1);
  }
  for (const [e, s, size] of [[-.2, 45.6, .6], [2.7, 47.2, .45], [-2.4, 54.3, .5], [1.4, 58.8, .65]]) {
    crown(e, size * .36, s, size, size * .4, size * .73, P.roof, 1);
  }
  box(.3, .70, 53.3, 1.05, 1.4, .32, P.roof);
  box(.3 + .168, .79, 53.3, .014, .90, .70, new Color(P.roof).lerp(new Color(P.stone), .18));

  const stationTrees = STATION_CURB_TREES.map(p => ({ ...p,
    east: p.east - HACHIKO_SQUARE_OFFSET.eastMetres, south: p.south - HACHIKO_SQUARE_OFFSET.southMetres, weeping: false }));
  for (const p of STATION_CURB_GARDENS) {
    surface(p.footprint, .38, new Color(P.foliage).lerp(new Color(P.roof), .55));
    const points = p.points.map(([e, s]) => [e - HACHIKO_SQUARE_OFFSET.eastMetres, s - HACHIKO_SQUARE_OFFSET.southMetres]);
    for (const [i, a] of points.entries()) {
      const b = points[(i + 1) % points.length], de = b[0] - a[0], ds = b[1] - a[1];
      const e = (a[0] + b[0]) / 2, s = (a[1] + b[1]) / 2, length = Math.hypot(de, ds);
      const yaw = -Math.PI / 4 - Math.atan2(ds, de);
      box(e, .23, s, length + .18, .46, .18, P.roof, yaw);
      box(e, .48, s, length + .22, .10, .24, P.concrete, yaw);
    }
    const minE = Math.min(...points.map(p => p[0])), maxE = Math.max(...points.map(p => p[0]));
    const minS = Math.min(...points.map(p => p[1])), maxS = Math.max(...points.map(p => p[1]));
    for (let e = minE + .45; e < maxE; e += .65) for (let s = minS + .45; s < maxS; s += .65) {
      const position = hachikoSquarePoint(e, s);
      if (citySurfaceDistance(position.x, position.z, [p.footprint]) < roadMetres(.4)) continue;
      if (stationTrees.some(tree => Math.hypot(e - tree.east, s - tree.south) < .7)) continue;
      crown(e, .55, s, .27, .20, .25, P.foliage);
      crown(e + .06, .75, s, .07, .05, .07, noise(e + s) > .33 ? P.coolLight : P.warmLight);
    }
  }

  for (const [index, tree] of [...HACHIKO_TREES, ...stationTrees].entries()) {
    const { east: e, south: s, height: h, radius: r, weeping } = tree;
    const fork = world(e - .15, h * .49, s + .13);
    branch(world(e, .1, s), fork, .23, P.roof, .13, 9);
    for (let b = 0; b < 7; b++) {
      const angle = b / 7 * Math.PI * 2 + index, reach = r * (.6 + noise(b + index) * .4);
      const be = e + Math.cos(angle) * reach, bs = s + Math.sin(angle) * reach;
      const height = h * (.77 + noise(b * 13) * .18);
      const tip = world(be, height, bs);
      branch(fork, tip, .115, P.roof, .026);
      crown(be, height, bs, r * .55, r * .48, r * .55, b === 2 ? P.foliageHighlight : P.foliage, 1);
      if (weeping) for (let k = 0; k < 3; k++) {
        const de = be + Math.cos(angle + k - 1) * .35, ds = bs + Math.sin(angle + k - 1) * .35;
        const bottom = height - 1.8 - noise(b * 3 + k) * .6;
        branch(tip, world(de, bottom, ds), .022, P.roof, .008, 5);
        crown(de, bottom + .60, ds, .29, .86, .3, P.foliage);
      }
    }
  }

  const { referencePoint: { eastMetres: e, southMetres: s }, yaw, pedestal: ped, position } = HACHIKO_MONUMENT;
  // The rectangular pedestal and front plaque rotate with the bronze's face.
  box(e, .07, s, ped.width + .20, .14, ped.depth + .20, P.roof, yaw);
  box(e, (ped.height + .14) / 2, s, ped.width, ped.height - .14, ped.depth, new Color(P.roof).lerp(new Color(P.stone), .38), yaw);
  box(e, ped.height + ped.bronzeBaseHeight / 2, s, ped.width * .84, ped.bronzeBaseHeight, ped.depth * .89, P.roof, yaw);
  const frontE = e + ped.depth / 2 + .008;
  box(frontE, .75, s, .24, .86, .018, P.roof, yaw);
  // Original geometric strokes for the actual vertical inscription 忠犬ハチ公.
  // Vector geometry remains readable in exports without CJK fonts or textures.
  const glyphs = [
    [[1, 1, 8, 1, 8, 5, 1, 5, 1, 1], [4.5, 0, 4.5, 6], [1, 7, 0, 9], [3, 7, 3, 9, 7, 9, 8, 8], [5, 6.5, 6, 7.5], [8, 6.5, 9, 8]],
    [[0, 3, 9, 3], [4.5, 0, 4, 5, 2.5, 7, 0, 9], [4, 4, 6, 7, 9, 9], [7, 0, 8.5, 1.5]],
    [[3, 2, 2, 5, 0, 8], [6, 1, 7.5, 5, 9, 8]],
    [[1, 1.5, 7, 0], [0, 4, 9, 4], [4.7, 1, 4.7, 6, 3, 8, 1, 9]],
    [[3, 0, 2, 2, 0, 4], [6, 0, 7, 2, 9, 4], [4, 4, 1.5, 8, 7.8, 8], [6, 5.5, 8.5, 9]],
  ];
  for (const [letter, strokes] of glyphs.entries()) for (const stroke of strokes) {
    for (let i = 2; i < stroke.length; i += 2) {
      const point = (j: number) => world(frontE + .014, 1.105 - letter * .151 - stroke[j + 1] * .013,
        s - (stroke[j] - 4.5) * .016);
      branch(point(i - 2), point(i), .004, P.stone, .004, 4);
    }
  }
  const sculpture = new BufferGeometry();
  sculpture.setAttribute('position', new Float32BufferAttribute(SCULPTURE.positions.map(n => roadMetres(n / SCULPTURE.unitsPerMetre)), 3));
  sculpture.setIndex(SCULPTURE.indices);
  sculpture.computeVertexNormals();
  sculpture.translate(0, roadMetres(ped.height + ped.bronzeBaseHeight), roadMetres(.20));
  sculpture.rotateY(yaw).translate(position.x, CITY_PAVEMENT_HEIGHT, position.z);
  const bronze = sculpture.toNonIndexed(); sculpture.dispose();
  const normals = bronze.getAttribute('normal'), colors = new Float32Array(normals.count * 3);
  const base = new Color(P.roof), recess = new Color(P.roof).lerp(new Color(P.ink), .48), highlight = new Color(P.warmLight), c = new Color();
  for (let i = 0; i < normals.count; i++) {
    const illumination = Math.max(0, normal.fromBufferAttribute(normals, i).dot(light));
    c.copy(SCULPTURE.faceRoles[Math.floor(i / 3)] ? recess : base).lerp(highlight, .07 * illumination).multiplyScalar(.64 + .36 * illumination);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  bronze.setAttribute('color', new Float32BufferAttribute(colors, 3)); parts.push(bronze);
  const result = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}
