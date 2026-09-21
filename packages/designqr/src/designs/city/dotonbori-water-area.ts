import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { dotonboriContains } from './dotonbori-detail-layout.ts';

/** Metric distance to the mapped shoreline, holes and rotated tile edge.
 * A circle smaller than this clearance stays wholly on the source water. */
export function dotonboriWaterClearance(library: DotonboriLibrary) {
  const edges: number[][] = [];
  for (const feature of library.plan.water) {
    const polygons = feature.type === 'Polygon' ? [feature.coordinates as number[][][]] : feature.coordinates as number[][][][];
    for (const rings of polygons) for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      edges.push([...ring[j], ...ring[i]]);
    }
  }
  const { layout } = library, c = Math.cos(layout.rotationYRadians), s = Math.sin(layout.rotationYRadians);
  return (east: number, north: number) => {
    const e = east - layout.centerEastNorthM[0], n = layout.centerEastNorthM[1] - north;
    let distance = layout.tileSizeM * .4998 - Math.max(Math.abs(e * c + n * s), Math.abs(n * c - e * s));
    if (distance <= 0 || !dotonboriContains(library.plan.water, east, north)) return 0;
    for (const [ax, ay, bx, by] of edges) {
      const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((east - ax) * dx + (north - ay) * dy) / length)) : 0;
      distance = Math.min(distance, Math.hypot(east - ax - t * dx, north - ay - t * dy));
    }
    return distance;
  };
}
