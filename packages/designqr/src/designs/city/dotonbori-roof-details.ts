import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { DotonboriBuilding } from './dotonbori-buildings.ts';
import type { DotonboriFront } from './dotonbori-facade-layout.ts';
import { cityNoise } from './building-variation.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { clipWallPolygon, wallArea, type WallPoint, type WallRect } from './dotonbori-walls.ts';

interface RoofFace {
  vertices: Vector3[];
  normal: Vector3;
  plane: number;
  reference: boolean;
}

/** Structural roof finishes are QR-derived interpretation, not a surveyed
 * equipment or rear-window inventory. Keep the source solid as the backing;
 * fit only narrow joints and flashing to its actual flat/sloping triangles. */
export function addDotonboriRoofDetails(b: DotonboriGeometry, building: DotonboriBuilding, fronts: readonly DotonboriFront[]) {
  const size = b.metres, position = building.geometry.getAttribute('position');
  const lower = fronts.find(f => f.building === building.id && f.id === 'B034-east-lower');
  const upper = fronts.find(f => f.building === building.id && f.id === 'B034-east-upper');
  const roof: RoofFace[] = [];
  const edgeOwners = new Map<string, { face: RoofFace; a: Vector3; c: Vector3 }[]>();
  const vertexKey = (v: Vector3) => v.toArray().map(n => Math.round(n * 1e7)).join(',');
  for (let i = 0; i < position.count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(position, i + j));
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    if (normal.y <= .012) continue;
    // The photographed east setback already has fitted glazing and closed ribs.
    const reference = !!(lower && upper && normal.x * lower.wall.nx + normal.z * lower.wall.nz > .45
      && Math.max(...vertices.map(v => v.y)) > lower.top / size
      && Math.min(...vertices.map(v => v.y)) < upper.bottom / size);
    const face = { vertices, normal, plane: normal.dot(vertices[0]), reference };
    roof.push(face);
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge], c = vertices[(edge + 1) % 3];
      const key = [vertexKey(a), vertexKey(c)].sort().join('|');
      const owners = edgeOwners.get(key) ?? []; owners.push({ face, a, c }); edgeOwners.set(key, owners);
    }
  }
  const longest = building.walls.reduce<(typeof building.walls)[number] | undefined>((best, wall) =>
    !best || wall.maxU - wall.minU > best.maxU - best.minU ? wall : best, undefined);
  const axis = longest ? new Vector3(longest.dx, 0, longest.dz) : new Vector3(1, 0, 0);
  const crossAxis = new Vector3(-axis.z, 0, axis.x), up = new Vector3(0, 1, 0);
  const positions = { joints: [] as number[], flashing: [] as number[] };
  let panels = 0, edges = 0, surfaceArea = 0;

  const patch = (face: RoofFace, u: Vector3, v: Vector3, rect: WallRect, kind: keyof typeof positions) => {
    const triangle: WallPoint[] = face.vertices.map(p => [p.dot(u), p.dot(v)]);
    const clipped = clipWallPolygon(triangle, rect);
    if (wallArea(clipped) < 1e-11) return false;
    const w = u.clone().cross(v), denominator = face.normal.dot(w);
    if (Math.abs(denominator) < .01) return false;
    const points = clipped.map(([x, y]) => {
      const point = u.clone().multiplyScalar(x).addScaledVector(v, y);
      point.addScaledVector(w, (face.plane - face.normal.dot(point)) / denominator);
      return point.addScaledVector(face.normal, (kind === 'joints' ? .018 : .032) / size);
    });
    // Roof contours can meet a tile section; offset paint must stay in the tile.
    let bounded = points;
    for (const component of ['x', 'z'] as const) for (const side of [-1, 1]) {
      const next: Vector3[] = [];
      for (let i = 0; i < bounded.length; i++) {
        const a = bounded[i], c = bounded[(i + 1) % bounded.length];
        const da = .5 - side * a[component], dc = .5 - side * c[component];
        if (da >= 0) next.push(a);
        if ((da >= 0) !== (dc >= 0)) next.push(a.clone().lerp(c, da / (da - dc)));
      }
      bounded = next;
    }
    let added = false;
    for (let i = 1; i + 1 < bounded.length; i++) {
      const vertices = [bounded[0], bounded[i], bounded[i + 1]].map(p => new Vector3(Math.fround(p.x), Math.fround(p.y), Math.fround(p.z)));
      if (vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() <= 1e-24) continue;
      // Projection bases may face either way; retain the source winding.
      if (vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).dot(face.normal) < 0) vertices.reverse();
      positions[kind].push(...vertices.flatMap(p => p.toArray())); added = true;
    }
    return added;
  };

  for (const face of roof) {
    if (face.reference) continue;
    const steep = face.normal.y < .65;
    // A shared building basis keeps courses aligned across warped source faces.
    const u = steep && Math.abs(face.normal.dot(axis)) > Math.abs(face.normal.dot(crossAxis)) ? crossAxis : axis;
    const v = steep ? up : crossAxis;
    const projected = face.vertices.map(p => [p.dot(u), p.dot(v)] as WallPoint);
    const minU = Math.min(...projected.map(p => p[0])), maxU = Math.max(...projected.map(p => p[0]));
    const minY = Math.min(...projected.map(p => p[1])), maxY = Math.max(...projected.map(p => p[1]));
    const pitchU = (steep ? 1.25 : 2.4) / size;
    const pitchV = (steep ? 3.2 : 4.8) / size;
    const phase = cityNoise(building.index * 103, building.seed);
    const width = (steep ? .065 : .045) / size;
    for (let col = Math.floor(minU / pitchU - phase); (col + phase) * pitchU < maxU; col++) {
      const x = (col + phase) * pitchU;
      if (patch(face, u, v, { minU: x, maxU: x + width, minY, maxY }, 'joints')) panels++;
    }
    // Stop cross joints at longitudinal joints to avoid doubled coplanar paint.
    for (let row = Math.floor(minY / pitchV - phase); (row + phase) * pitchV < maxY; row++) {
      const y = (row + phase) * pitchV;
      for (let col = Math.floor(minU / pitchU - phase); (col + phase) * pitchU < maxU; col++) {
        const x = (col + phase) * pitchU;
        if (patch(face, u, v, { minU: x + width, maxU: x + pitchU, minY: y, maxY: y + width }, 'joints')) panels++;
      }
    }
    surfaceArea += face.vertices[1].clone().sub(face.vertices[0]).cross(face.vertices[2].clone().sub(face.vertices[0])).length() / 2 * size ** 2;
  }
  for (const owners of edgeOwners.values()) {
    // Internal triangulation edges are not construction seams. Existing glazing
    // owns shared borders; finish only exposed contours and real roof creases.
    if (owners.some(o => o.face.reference) || owners.length > 1 && owners.every(o => o.face.normal.dot(owners[0].face.normal) > .97)) continue;
    for (const { face, a, c } of owners) {
      const u = c.clone().sub(a).normalize(), v = face.normal.clone().cross(u);
      const edgeY = a.dot(v), inward = face.vertices.reduce((n, p) => n + p.dot(v) - edgeY, 0) >= 0 ? 1 : -1;
      const minY = edgeY + Math.min(0, inward * .12 / size), maxY = edgeY + Math.max(0, inward * .12 / size);
      if (patch(face, u, v, { minU: a.dot(u), maxU: c.dot(u), minY, maxY }, 'flashing')) edges++;
    }
  }
  for (const kind of ['joints', 'flashing'] as const) if (positions[kind].length) {
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions[kind], 3));
    b.add(geometry, kind === 'joints' ? P.joints : P.metal);
  }
  return { panels, edges, surfaceAreaM2: surfaceArea };
}
