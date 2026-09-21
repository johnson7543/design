import { BufferGeometry, Float32BufferAttribute } from 'three';
import { clipWallPolygon, wallArea, wallPoint, type DotonboriWall, type WallPoint, type WallRect } from './dotonbori-walls.ts';

/** Closed, source-clipped bent rib. Build the whole run together so adjoining
 * slices do not acquire coincident end caps. Split shared edges at T junctions
 * before finding the boundary; only the exterior perimeter receives side faces. */
export function dotonboriFacadeRib(wall: DotonboriWall, rect: WallRect, size: number, supportDepth = (_u: number, _y: number) => wall.plane) {
  const points: WallPoint[] = [], lookup = new Map<string, number>(), triangles: number[][] = [];
  const vertex = (p: WallPoint) => {
    const key = p.map(n => Math.round(n * 1e8)).join(','); let id = lookup.get(key);
    if (id === undefined) {
      const shared = points.findIndex(q => Math.abs(p[0] - q[0]) < 1e-7 && Math.abs(p[1] - q[1]) < 1e-7);
      id = shared >= 0 ? shared : points.length;
      if (shared < 0) points.push(p);
      lookup.set(key, id);
    }
    return id;
  };
  const steps = Math.max(1, Math.ceil((rect.maxY - rect.minY) * size / 1.4)), step = (rect.maxY - rect.minY) / steps;
  for (let slice = 0; slice < steps; slice++) for (const source of wall.triangles) {
    const piece = clipWallPolygon(source, { ...rect, minY: rect.minY + slice * step, maxY: rect.minY + (slice + 1) * step });
    for (let i = 1; i + 1 < piece.length; i++) {
      const tri = [piece[0], piece[i], piece[i + 1]];
      if (wallArea(tri) > 1e-11) {
        const ids = tri.map(vertex);
        if (new Set(ids).size === 3 && wallArea(ids.map(i => points[i])) > 1e-11) triangles.push(ids);
      }
    }
  }
  if (!triangles.length) return undefined;
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (const tri of triangles) for (let edge = 0; edge < 3; edge++) {
    const a = points[tri[edge]], b = points[tri[(edge + 1) % 3]], dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const splits = points.map((p, id) => ({ id, t: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length }))
      .filter(({ id, t }) => t >= -1e-7 && t <= 1 + 1e-7 && Math.abs((points[id][0] - a[0]) * dy - (points[id][1] - a[1]) * dx) < 1e-10)
      .sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < splits.length; i++) {
      const a = splits[i].id, b = splits[i + 1].id; if (a === b) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`, current = edges.get(key);
      if (current) current.count++; else edges.set(key, { a, b, count: 1 });
    }
  }
  const curve = (y: number) => .80 * Math.sin(Math.max(0, Math.min(1, (y * size - 27) / 15)) * Math.PI);
  const offset = (y: number) => {
    const index = Math.min(steps - 1, Math.max(0, Math.floor((y - rect.minY) / step))), low = rect.minY + index * step;
    return .30 + curve(low) + (curve(low + step) - curve(low)) * (y - low) / step;
  };
  const front = points.map(([u, y]) => wallPoint(wall, u, y, supportDepth(u, y) - wall.plane + offset(y) / size));
  const back = points.map(([u, y]) => wallPoint(wall, u, y, supportDepth(u, y) - wall.plane + (offset(y) - .12) / size));
  const positions: number[] = [];
  for (const tri of triangles) {
    positions.push(...tri.flatMap(i => front[i].toArray()), ...tri.toReversed().flatMap(i => back[i].toArray()));
  }
  for (const { a, b, count } of edges.values()) if (count === 1) {
    positions.push(...front[b].toArray(), ...front[a].toArray(), ...back[a].toArray(),
      ...front[b].toArray(), ...back[a].toArray(), ...back[b].toArray());
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}
