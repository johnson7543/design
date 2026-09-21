import { Vector3 } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import type { DotonboriFront } from './dotonbori-facade-layout.ts';
import { dotonboriFacadeRib } from './dotonbori-facade-ribs.ts';
import { wallArea, wallPatch, wallPoint, type WallPoint, type DotonboriWall } from './dotonbori-walls.ts';

/** Align upper and lower ribs in one wall coordinate system. The source
 * contours clip outer strips where the actual elevation narrows. */
export function dotonboriRibPositions(front: DotonboriFront, fronts: readonly DotonboriFront[]) {
  const lower = front.id.endsWith('upper') ? fronts.find(f => f.id === front.id.replace('upper', 'lower')) ?? front : front;
  return Array.from({ length: 12 }, (_, rib) => {
    const p = wallPoint(lower.wall, lower.u + (rib / 11 - .5) * (lower.width - .48) / front.size, 0);
    return (p.x * front.wall.dx + p.z * front.wall.dz - front.u) * front.size;
  }).filter(x => x > -front.width / 2 && x < front.width / 2);
}

/** S19/F2 shows the east-facing rib/glass system bending through the setback.
 * Sample that surface from the source solid, including sloped triangles;
 * vertical-wall rectangles alone cannot cover this interval. */
export function addDotonboriEbisubashiSetback(b: DotonboriGeometry, library: DotonboriLibrary, fronts: readonly DotonboriFront[]) {
  const lower = fronts.find(f => f.id === 'B034-east-lower'), upper = fronts.find(f => f.id === 'B034-east-upper');
  if (!lower || !upper || upper.bottom <= lower.top) return;
  const source = library.templates.find(t => t.id === lower.building)!, p = source.geometry.getAttribute('position'), size = lower.size;
  const wall = lower.wall, normal = new Vector3(wall.nx, 0, wall.nz), tangent = new Vector3(wall.dx, 0, wall.dz);
  const surfaces: { triangle: WallPoint[]; normal: Vector3; plane: number }[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j));
    const n = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    if (n.dot(normal) < .45 || Math.max(...vertices.map(v => v.y)) < lower.top / size || Math.min(...vertices.map(v => v.y)) > upper.bottom / size) continue;
    surfaces.push({ triangle: vertices.map(v => [v.dot(tangent), v.y]), normal: n, plane: n.dot(vertices[0]) });
  }
  const depth = (u: number, y: number) => {
    const point: WallPoint = [u, y];
    const surface = surfaces.find(({ triangle: t }) => Math.abs(wallArea(t) - wallArea([point, t[0], t[1]]) - wallArea([point, t[1], t[2]]) - wallArea([point, t[2], t[0]])) < 2e-8);
    if (!surface) throw new Error('Ebisubashi setback detail lost its source surface');
    return (surface.plane - surface.normal.dot(tangent) * u - surface.normal.y * y) / surface.normal.dot(normal);
  };
  const region = { minU: lower.minU, maxU: lower.maxU, minY: lower.top / size, maxY: upper.bottom / size };
  const support: DotonboriWall = { ...wall, ...region, triangles: surfaces.map(s => s.triangle) };
  const base = wallPatch(support, region, 0); if (!base) return;
  const vertices = base.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const u = vertices.getX(i) * wall.dx + vertices.getZ(i) * wall.dz, y = vertices.getY(i);
    const p = wallPoint(wall, u, y, depth(u, y) - wall.plane + .08 / size); vertices.setXYZ(i, p.x, p.y, p.z);
  }
  b.buildingId = lower.building; b.add(base, P.glass);
  for (const x of dotonboriRibPositions(lower, fronts)) {
    const rect = { ...region, minU: lower.u + (x - .21) / size, maxU: lower.u + (x + .21) / size };
    const rib = dotonboriFacadeRib(support, rect, size, depth); if (!rib) continue;
    b.add(rib, P.metal);
    // Use an actual generated vertex for the morph anchor even when an outer
    // strip terminates at the narrowed roof contour before the midpoint.
    const position = new Vector3().fromBufferAttribute(rib.getAttribute('position'), 0);
    b.fragments.push({ x: position.x, y: position.y, z: position.z, width: .42 / size, height: .6 / size, depth: .12 / size,
      color: P.metal, angle: lower.yaw, kind: 'furniture', group: 'dotonbori-ebisubashi-setback', sourceBuilding: lower.building });
  }
}
