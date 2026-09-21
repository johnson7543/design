import { Path, Shape, ShapeGeometry, Vector2 } from 'three';
import type { BufferGeometry } from 'three';
import type { DotonboriPolygon } from './dotonbori-assets.ts';
import { transformDotonboriGeometry, type DotonboriLayout } from './dotonbori-layout.ts';

export interface DotonboriMorphSurface {
  id: string; kind: 'building' | 'bridge' | 'plan'; geometry: BufferGeometry;
}


/** GSI/PLATEAU horizontal references, drawn on a diagrammatic datum plane. */
export function dotonboriPlanGeometry(features: readonly DotonboriPolygon[], y: number, layout: DotonboriLayout): ShapeGeometry {
  const shapes: Shape[] = [];
  for (const feature of features) {
    const polygons = feature.type === 'Polygon' ? [feature.coordinates as number[][][]] : feature.coordinates as number[][][][];
    for (const polygon of polygons) {
      const rings = polygon.map(ring => ring.map(([east, north]) => new Vector2(east, north)));
      const shape = new Shape(rings[0]);
      shape.holes = rings.slice(1).map(ring => new Path(ring));
      shapes.push(shape);
    }
  }
  return transformDotonboriGeometry(new ShapeGeometry(shapes).rotateX(-Math.PI / 2), layout).translate(0, y, 0);
}

/** Project onto the actual triangular roof envelope, including stepped roofs. */
export function dotonboriRoofAt(geometry: BufferGeometry, x: number, z: number) {
  const p = geometry.getAttribute('position'), index = geometry.index, count = index?.count ?? p.count;
  let height = -Infinity;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
    const ax = p.getX(a), az = p.getZ(a), bx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c);
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-12) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) height = Math.max(height, u * p.getY(a) + v * p.getY(b) + (1 - u - v) * p.getY(c));
  }
  return height;
}

