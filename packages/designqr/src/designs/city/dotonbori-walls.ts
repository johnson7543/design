import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

export type WallPoint = [number, number];
export interface WallRect { minU: number; maxU: number; minY: number; maxY: number }
export interface DotonboriWall extends WallRect {
  nx: number; nz: number; dx: number; dz: number; plane: number; triangles: WallPoint[][];
}

function halfPlane(points: WallPoint[], axis: number, limit: number, sign: number): WallPoint[] {
  const result: WallPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = (a[axis] - limit) * sign, db = (b[axis] - limit) * sign;
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

export function clipWallPolygon(points: WallPoint[], rect: WallRect): WallPoint[] {
  for (const [axis, limit, sign] of [[0, rect.minU, 1], [0, rect.maxU, -1], [1, rect.minY, 1], [1, rect.maxY, -1]]) {
    points = halfPlane(points, axis, limit, sign);
  }
  return points;
}

export function wallArea(points: WallPoint[]) {
  return Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
}

/** Disjoint pieces outside a reserved storefront/reference rectangle. */
function subtract(points: WallPoint[], rect: WallRect): WallPoint[][] {
  const result: WallPoint[][] = [];
  for (const [axis, limit, sign] of [[0, rect.minU, 1], [0, rect.maxU, -1], [1, rect.minY, 1], [1, rect.maxY, -1]]) {
    const outside = halfPlane(points, axis, limit, -sign);
    if (wallArea(outside) > 1e-11) result.push(outside);
    points = halfPlane(points, axis, limit, sign);
  }
  return result;
}

export function wallPoint(w: DotonboriWall, u: number, y: number, offset = 0) {
  return new Vector3(w.dx * u + w.nx * (w.plane + offset), y, w.dz * u + w.nz * (w.plane + offset));
}

/** One rhythm per physical wall. Millimetre source triangulation noise must not
 * create a second facade. Keep the original body; only the detail support plane
 * is fitted (maximum 0.001 tile, 14.4 cm in this 144 m crop). Fuzzy joins
 * require a shared source edge; nearby parallel setback walls stay separate. */
export function dotonboriBuildingWalls(geometry: BufferGeometry): DotonboriWall[] {
  return buildingPlanes(geometry, false);
}

export function dotonboriSectionTriangle(vertices: readonly Vector3[]) {
  return (['x', 'z'] as const).some(axis => [-.5, .5].some(edge => vertices.every(v => Math.abs(v[axis] - edge) < 1e-6)));
}

/** Tile sections are closed presentation surfaces, never street elevations. */
export function dotonboriBuildingSections(geometry: BufferGeometry): DotonboriWall[] {
  return buildingPlanes(geometry, true);
}

function buildingPlanes(geometry: BufferGeometry, sections: boolean): DotonboriWall[] {
  const p = geometry.getAttribute('position');
  type WallGroup = { normal: Vector3; triangles: Vector3[][] };
  const groups: WallGroup[] = [];
  const joins = (a: WallGroup, b: WallGroup) => {
    if (a.normal.dot(b.normal) < .9998) return false;
    const vertices = [...a.triangles.flat(), ...b.triangles.flat()];
    const thickness = (normal: Vector3) => {
      const distances = vertices.map(v => normal.dot(v)); return Math.max(...distances) - Math.min(...distances);
    };
    const span = Math.max(thickness(a.normal), thickness(b.normal));
    if (span >= .001) return false;
    return span < 1e-6 || a.triangles.some(t => b.triangles.some(u => t.filter(v => u.some(p => v.distanceToSquared(p) < 1e-14)).length >= 2));
  };
  for (let i = 0; i < p.count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j));
    if (dotonboriSectionTriangle(vertices) !== sections) continue;
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    if (Math.abs(normal.y) > .012 || normal.lengthSq() < .5) continue;
    normal.y = 0; normal.normalize();
    const candidate = { normal, triangles: [vertices] }, group = groups.find(g => joins(g, candidate));
    if (group) group.triangles.push(vertices); else groups.push(candidate);
  }
  // A later triangle can connect two earlier groups; source face order must
  // not leave an otherwise continuous wall with two competing window grids.
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) if (joins(groups[i], groups[j])) {
      groups[i].triangles.push(...groups[j].triangles); groups.splice(j, 1); j = i;
    }
  }
  return groups.map(g => {
    const nx = g.normal.x, nz = g.normal.z, dx = -nz, dz = nx;
    const triangles: WallPoint[][] = g.triangles.map(t => t.map(v => [v.x * dx + v.z * dz, v.y]));
    const points = triangles.flat();
    // Use the outward support plane so the fitted skin never cuts through
    // the slightly warped original wall, even at oblique camera angles.
    const plane = Math.max(...g.triangles.flat().map(v => g.normal.dot(v)));
    return { nx, nz, dx, dz, plane, triangles,
      minU: Math.min(...points.map(p => p[0])), maxU: Math.max(...points.map(p => p[0])),
      minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
  }).filter(w => w.maxU - w.minU > (sections ? 1e-7 : .0005) && w.maxY - w.minY > (sections ? 1e-7 : .0005));
}

export function wallCoverage(wall: DotonboriWall, rect: WallRect) {
  return wall.triangles.reduce((sum, triangle) => sum + wallArea(clipWallPolygon(triangle, rect)), 0);
}

/** Source-clipped patches with explicit exclusive ownership. No degenerate
 * fan triangles, no geometry beyond a setback, and no reference/QR double skin. */
export function wallPatch(wall: DotonboriWall, rect: WallRect, offset: number, excluded: readonly WallRect[] = []) {
  const positions: number[] = [];
  for (const triangle of wall.triangles) {
    let pieces = [clipWallPolygon(triangle, rect)];
    for (const cut of excluded) pieces = pieces.flatMap(p => subtract(p, cut));
    for (const piece of pieces) {
      for (let i = 1; i + 1 < piece.length; i++) {
        const tri = [piece[0], piece[i], piece[i + 1]];
        if (wallArea(tri) < 1e-11) continue;
        const vertices = tri.map(([u, y]) => {
          const p = wallPoint(wall, u, y, offset); return new Vector3(Math.fround(p.x), Math.fround(p.y), Math.fround(p.z));
        });
        // A sub-millimetre remainder can collapse after the GPU Float32 round
        // trip, even when its double-precision clipping polygon has area.
        if (vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() <= 1e-24) continue;
        positions.push(...vertices.flatMap(p => p.toArray()));
      }
    }
  }
  if (!positions.length) return undefined;
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}
