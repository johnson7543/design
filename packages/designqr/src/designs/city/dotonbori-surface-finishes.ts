import { BufferGeometry, Color, Vector3 } from 'three';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { dotonboriSectionTriangle, wallPatch, wallPoint, type DotonboriWall, type WallRect } from './dotonbori-walls.ts';
import type { DotonboriFront } from './dotonbori-facade-layout.ts';

/** Recolour the existing closed cap itself; retain every source vertex and face.
 * A mineral section finish makes the crop read as a solid miniature. It carries
 * no invented openings or floor grid through the severed building interior. */
export function finishDotonboriSectionColors(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  const bounds = geometry.boundingBox!, height = bounds.max.y - bounds.min.y;
  const base = new Color(P.building).lerp(new Color(P.stone), .58), edge = new Color(P.section), ink = new Color();
  for (let i = 0; i < p.count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j));
    if (!dotonboriSectionTriangle(vertices)) continue;
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    const shade = Math.abs(normal.x) > .9 ? .94 : .84;
    for (let j = 0; j < 3; j++) {
      const elevation = (vertices[j].y - bounds.min.y) / height;
      ink.copy(base).lerp(edge, .16 * (1 - elevation)).multiplyScalar(shade);
      colors.setXYZ(i + j, ink.r, ink.g, ink.b);
    }
  }
  colors.needsUpdate = true;
}

/** Narrow roof/base and end reveals follow the cap contour. The body remains
 * the sole full-area surface; strips meet without overlapping corners. */
export function addDotonboriSectionEdges(b: DotonboriGeometry, sections: readonly DotonboriWall[], size: number) {
  for (const wall of sections) {
    const trim = Math.min(.16 / size, (wall.maxU - wall.minU) / 5), top = .20 / size, base = .12 / size;
    const regions = [
      { ...wall, minY: Math.max(wall.minY, wall.maxY - top) },
      { ...wall, maxY: Math.min(wall.maxY - top, wall.minY + base) },
      ...[wall.minU, wall.maxU - trim].map(minU => ({ minU, maxU: minU + trim,
        minY: wall.minY + base, maxY: wall.maxY - top })),
    ];
    for (const rect of regions) {
      if (rect.maxY <= rect.minY) continue;
      const g = wallPatch(wall, rect, .006 / size); if (g) b.add(g, P.section);
    }
    const p = wallPoint(wall, (wall.minU + wall.maxU) / 2, wall.maxY - top / 2, .006 / size);
    b.fragments.push({ x: p.x, y: p.y, z: p.z, width: wall.maxU - wall.minU, height: top, depth: .012 / size,
      angle: Math.atan2(wall.nx, wall.nz), color: P.section, kind: 'furniture',
      group: 'dotonbori-section-edges', sourceBuilding: b.buildingId });
  }
}

export function dotonboriReferenceWallColor(front: DotonboriFront) {
  return front.id.startsWith('B034') ? P.metal : front.id.startsWith('B046') ? P.stone : P.building;
}

/** Finish only the complement of all registered rectangles, once per wall.
 * These margins are structural; photography does not establish extra tenants. */
export function addDotonboriReferenceMargins(b: DotonboriGeometry, fronts: readonly DotonboriFront[]) {
  const walls = new Set<DotonboriWall>();
  const coverage: { building: string; fronts: string[]; areaM2: number }[] = [];
  for (const front of fronts) {
    if (front.groundFloorOnly || walls.has(front.wall)) continue;
    walls.add(front.wall); b.buildingId = front.building;
    const reserved = fronts.filter(f => f.building === front.building && f.wall === front.wall);
    const geometry = wallPatch(front.wall, front.wall, .055 / front.size, reserved);
    if (!geometry) continue;
    const positions = geometry.getAttribute('position'); let areaM2 = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const [a, c, d] = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(positions, i + j));
      areaM2 += c.sub(a).cross(d.sub(a)).length() / 2 * front.size ** 2;
    }
    coverage.push({ building: front.building, fronts: reserved.map(f => f.id), areaM2 });
    const w = front.wall, sample = new Vector3();
    for (let i = 0; i < 3; i++) sample.add(new Vector3().fromBufferAttribute(positions, i).divideScalar(3));
    b.fragments.push({ x: sample.x, y: sample.y, z: sample.z, width: .20 / front.size, height: .20 / front.size, depth: .04 / front.size,
      angle: front.yaw, color: dotonboriReferenceWallColor(front), kind: 'furniture', group: `dotonbori-frontage-${front.id}`, sourceBuilding: front.building });
    b.add(geometry, dotonboriReferenceWallColor(front));
    const trim = .10 / front.size;
    const edges: WallRect[] = [
      { ...w, minY: w.maxY - trim },
      { ...w, maxU: w.minU + trim, maxY: w.maxY - trim },
      { ...w, minU: w.maxU - trim, maxY: w.maxY - trim },
    ];
    for (const edge of edges) {
      const g = wallPatch(w, edge, .075 / front.size, reserved); if (g) b.add(g, P.roof);
    }
  }
  return coverage;
}
