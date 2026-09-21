import { BufferGeometry, Vector3 } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { cityBuildingVariation, cityFacadeVariation, cityNoise } from './building-variation.ts';
import { DOTONBORI_CONTEXT_TOP_LIMITS_M, DOTONBORI_REFERENCE_HOSTS } from './dotonbori-composition.ts';
import { dotonboriContextTop } from './dotonbori-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { dotonboriRoofAt } from './dotonbori-morph.ts';
import type { DotonboriFragment } from './dotonbori-ownership.ts';
import { clipWallPolygon, wallArea as area, wallCoverage, wallPatch, wallPoint, dotonboriBuildingWalls, type DotonboriWall, type WallPoint as Point } from './dotonbori-walls.ts';
import type { DotonboriFront } from './dotonbori-facade-layout.ts';
import { dotonboriBuildingSections } from './dotonbori-walls.ts';
import { addDotonboriSectionEdges, finishDotonboriSectionColors } from './dotonbori-surface-finishes.ts';
import { addDotonboriRoofDetails } from './dotonbori-roof-details.ts';
export { dotonboriBuildingWalls, type DotonboriWall } from './dotonbori-walls.ts';

export interface DotonboriBuilding {
  id: string; index: number; geometry: BufferGeometry; fixed: boolean; seed: number;
  floors: number; facade: 'glass' | 'concrete' | 'stone'; sign: number; walls: DotonboriWall[]; sections: DotonboriWall[];
}
export interface DotonboriGeneratedPanel {
  id: string; building: string; position: Vector3; width: number; height: number; angle: number; design: number;
}

function clipTriangle(triangle: Point[], minU: number, minY: number, maxU: number, maxY: number) {
  return clipWallPolygon(triangle, { minU, minY, maxU, maxY });
}

/** Preserve all horizontal vertices and reference-host heights. Context keeps
 * its source roof/setback topology and quantized QR variation within the
 * static foreground height envelope. Details are generated after this step. */
export function createDotonboriBuildings(library: DotonboriLibrary, modules: readonly (readonly boolean[])[]): DotonboriBuilding[] {
  const fixedIds = new Set(Object.values(DOTONBORI_REFERENCE_HOSTS)), size = library.layout.tileSizeM;
  return library.templates.filter(t => t.kind === 'building').map(template => {
    const index = template.variationIndex;
    const bounds = template.geometry.boundingBox!, center = bounds.getCenter(new Vector3());
    const variation = cityBuildingVariation(modules, index, center.x, center.z), fixed = fixedIds.has(template.id);
    const sourceHeight = bounds.max.y - bounds.min.y;
    const contextLimit = Math.min(dotonboriContextTop(center.x, center.z),
      (DOTONBORI_CONTEXT_TOP_LIMITS_M[template.id] ?? Infinity) / size) - bounds.min.y;
    const contextHeight = Math.min(sourceHeight, contextLimit);
    const height = fixed ? sourceHeight : Math.min(contextLimit,
      Math.max(8 / size, Math.round(contextHeight * variation.heightScale / .005) * .005));
    const geometry = template.geometry.clone(), p = geometry.getAttribute('position');
    if (!fixed) for (let i = 0; i < p.count; i++) p.setY(i, bounds.min.y + (p.getY(i) - bounds.min.y) * height / sourceHeight);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    finishDotonboriSectionColors(geometry);
    return { id: template.id, index, geometry, fixed, seed: variation.seed, sign: variation.sign,
      floors: Math.max(2, Math.round(height * size / variation.floorMetres)), facade: variation.facade,
      walls: dotonboriBuildingWalls(geometry), sections: dotonboriBuildingSections(geometry) };
  });
}

/** All corners AND the full projected area must have one flat roof below them. */
export function dotonboriRoofSupport(geometry: BufferGeometry, x: number, z: number, width: number, depth: number) {
  const height = dotonboriRoofAt(geometry, x, z);
  if (!Number.isFinite(height)) return undefined;
  const p = geometry.getAttribute('position'); let covered = 0;
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].some(j => Math.abs(p.getY(i + j) - height) > .00002)) continue;
    const triangle: Point[] = [0, 1, 2].map(j => [p.getX(i + j), p.getZ(i + j)]);
    covered += area(clipTriangle(triangle, x - width / 2, z - depth / 2, x + width / 2, z + depth / 2));
  }
  return covered >= width * depth * .999 ? height : undefined;
}

/** QR-generated architecture is illustrative, as in Shibuya; only the source
 * envelope and separately photographed fronts claim geographic evidence. */
export function createDotonboriBuildingDetails(buildings: readonly DotonboriBuilding[], size: number, fronts: readonly DotonboriFront[] = []) {
  const b = new DotonboriGeometry(size, 'dotonbori-generated-architecture');
  const panels: DotonboriGeneratedPanel[] = [], fragments: DotonboriFragment[] = [];
  const counts: Record<string, { windows: number; bands: number; equipment: number; signs: number; roofPanels: number; roofEdges: number; roofAreaM2: number }> = {};
  const opaque = (owner: DotonboriBuilding, point: Vector3) => buildings.some(other => {
    if (other === owner) return false;
    const bounds = other.geometry.boundingBox!;
    return point.x > bounds.min.x && point.x < bounds.max.x && point.z > bounds.min.z && point.z < bounds.max.z
      && point.y < bounds.max.y && dotonboriRoofAt(other.geometry, point.x, point.z) > point.y;
  });
  for (const building of buildings) {
    b.buildingId = building.id;
    const start = b.fragments.length, bounds = building.geometry.boundingBox!, seed = building.seed;
    const roof = addDotonboriRoofDetails(b, building, fronts);
    const count = counts[building.id] = { windows: 0, bands: 0, equipment: 0, signs: 0,
      roofPanels: roof.panels, roofEdges: roof.edges, roofAreaM2: roof.surfaceAreaM2 };
    addDotonboriSectionEdges(b, building.sections, size);
    const wallColor = building.facade === 'glass' ? P.glass : building.facade === 'stone' ? P.stone : P.building;
    const floorHeight = (bounds.max.y - bounds.min.y) / building.floors;
    const band = (wall: DotonboriWall, u0: number, u1: number, low: number, high: number, color: string, offsetM = .04, luminous = false) => {
      const reserved = fronts.filter(f => f.building === building.id && f.wall === wall);
      const geometry = wallPatch(wall, { minU: u0, maxU: u1, minY: low, maxY: high }, offsetM / size, reserved);
      if (!geometry) return false;
      b.add(geometry, color, luminous); return true;
    };
    for (const [edge, wall] of building.walls.entries()) {
      // A reference wall has one facade owner, including its corner margins
      // and the spaces between signs. Do not leave slivers of a second grid.
      if (fronts.some(f => f.building === building.id && f.wall === wall && !f.groundFloorOnly)) continue;
      const margin = Math.min(.06 / size, (wall.maxU - wall.minU) / 8), min = wall.minU + margin, max = wall.maxU - margin;
      const length = max - min, rhythm = cityFacadeVariation(edge, seed), columns = Math.max(1, Math.floor(length * size / rhythm.bayMetres));
      // Material skin follows the actual contour. Window quads are clipped
      // individually, so a stepped roof never acquires a rectangular curtain wall.
      band(wall, min, max, wall.minY, wall.maxY, wallColor, .08);
      const groundFronts = fronts.filter(f => f.building === building.id && f.wall === wall && f.groundFloorOnly);
      const shopLow = groundFronts.length ? Math.min(...groundFronts.map(f => f.minY)) : Math.max(wall.minY + .35 / size, 2.3 / size);
      const shopHigh = groundFronts.length ? Math.max(...groundFronts.map(f => f.maxY)) : Math.min(shopLow + 2.5 / size, wall.maxY);
      for (let floor = 0; floor < building.floors; floor++) {
        const low = bounds.min.y + floor * floorHeight, high = low + floorHeight;
        if (high < wall.minY || low > wall.maxY) continue;
        if (band(wall, min, max, high - .20 / size, high, P.metal, .16)) count.bands++;
        for (let col = 0; col < columns; col++) {
          const u0 = min + length * (col + rhythm.inset) / columns, u1 = min + length * (col + 1 - rhythm.inset) / columns;
          const bottom = Math.max(low + floorHeight * rhythm.sill, shopHigh + .18 / size), top = low + floorHeight * .83;
          if (bottom >= top) continue;
          const point = wallPoint(wall, (u0 + u1) / 2, (bottom + top) / 2, .3 / size);
          if (opaque(building, point)) continue;
          const noise = cityNoise(edge * 601 + col * 31 + floor * 7, seed);
          const light = noise > .62, color = noise > .93 ? P.warmWindow : noise > .62 ? P.coolWindow : P.glass;
          const reveal = .065 / size;
          band(wall, u0, u1, bottom, top, P.dark, .12);
          if (band(wall, u0 + reveal, u1 - reveal, bottom + reveal, top - reveal, color, .14, light)) {
            count.windows++;
            if ((floor + col) % 5 === 0 && bottom >= wall.minY && top <= wall.maxY) {
              const covered = wall.triangles.reduce((sum, t) => sum + area(clipTriangle(t, u0, bottom, u1, top)), 0);
              const reserved = fronts.filter(f => f.building === building.id && f.wall === wall);
              const overlapsFront = reserved.some(f => Math.min(f.maxU, u1) > Math.max(f.minU, u0) && Math.min(f.maxY, top) > Math.max(f.minY, bottom));
              if (!overlapsFront && covered >= (u1 - u0) * (top - bottom) * .999) {
                const sample = wallPoint(wall, (u0 + u1) / 2, (bottom + top) / 2, .14 / size);
                fragments.push({ x: sample.x, y: sample.y, z: sample.z, width: u1 - u0, height: top - bottom, depth: .05 / size,
                  angle: Math.atan2(wall.nx, wall.nz), color, kind: 'furniture', group: building.id, sourceBuilding: building.id });
              }
            }
          }
          band(wall, u0, u1, bottom - .08 / size, bottom, P.metal, .20);
        }
      }
      // Roof edge/cornice and fine corner returns also articulate tiny parcels.
      if (band(wall, min, max, wall.maxY - .23 / size, wall.maxY, P.roof, .24)) count.bands++;
      for (const u of [min, max - .09 / size]) band(wall, u, u + .09 / size, wall.minY, wall.maxY, P.metal, .22);
      if (shopHigh > shopLow && !opaque(building, wallPoint(wall, (min + max) / 2, shopLow, .3 / size))) {
        band(wall, min, max, shopLow, shopHigh, P.warmWindow, .14, true);
        band(wall, min, max, shopHigh, shopHigh + .12 / size, P.dark, .24);
        for (let col = 0; col <= columns; col++) {
          const u = min + length * col / columns;
          band(wall, u, u + .10 / size, shopLow, shopHigh, P.dark, .28);
        }
      }
    }
    // Equipment uses exactly the shared seeded roof rhythm; full-area tests
    // exclude cut edges, lower terraces and holes. Source roof topology survives.
    const pitch = 4 / size, offset = cityNoise(building.index * 47, seed) * pitch;
    for (let x = bounds.min.x + 1.6 / size + offset; x < bounds.max.x - 1.2 / size; x += pitch) {
      for (let z = bounds.min.z + 1.3 / size + offset; z < bounds.max.z - 1.2 / size; z += pitch) {
        if (cityNoise(Math.round(x * size) + Math.round(z * size) * 11, seed) < .64) continue;
        const roof = dotonboriRoofSupport(building.geometry, x, z, 2 / size, 1.6 / size);
        if (roof === undefined || roof < bounds.max.y - 4 / size) continue;
        b.box(new Vector3(x, roof + .55 / size, z), 2, 1.1, 1.6, P.metal);
        for (let fin = 0; fin < 4; fin++) b.box(new Vector3(x, roof + 1.12 / size, z + (fin - 1.5) * .30 / size), 1.8, .07, .09, P.dark, 0, false);
        count.equipment++;
      }
    }
    // One original campaign per suitable context frontage. Reference-host ads
    // keep their photographed identity; no fictional tenant replaces them.
    if (!building.fixed) {
      const candidates = building.walls.filter(w => (w.maxU - w.minU) * size > 3.4)
        .sort((a, c) => {
          const score = (w: DotonboriWall) => { const p = wallPoint(w, (w.minU + w.maxU) / 2, 0); return -(p.x * w.nx + p.z * w.nz) / Math.max(.01, Math.hypot(p.x, p.z)); };
          return score(c) - score(a);
        });
      for (const wall of candidates) {
        const width = Math.min(8 / size, (wall.maxU - wall.minU) * .72), height = width / 2;
        const u = (wall.minU + wall.maxU) / 2;
        const shopTop = Math.max(wall.minY, ...fronts.filter(f => f.building === building.id && f.wall === wall
          && f.maxU > u - width / 2 && f.minU < u + width / 2).map(f => f.maxY));
        // Low foreground blocks still need a complete 1F. A campaign cabinet
        // may rise above it only when the actual wall has room for both.
        const y = Math.max(wall.minY + (wall.maxY - wall.minY) * .58, shopTop + height / 2 + .3 / size);
        const covered = wallCoverage(wall, { minU: u - width / 2, maxU: u + width / 2, minY: y - height / 2, maxY: y + height / 2 });
        const p = wallPoint(wall, u, y, .44 / size);
        if (covered < width * height * .999 || opaque(building, p)) continue;
        const panel = { id: `${building.id}-campaign`, building: building.id, position: p, width, height, angle: Math.atan2(wall.nx, wall.nz), design: building.sign };
        panels.push(panel); count.signs++;
        b.box(wallPoint(wall, u, y, .32 / size), width * size + .20, height * size + .20, .18, P.dark, panel.angle);
        break;
      }
    }
    for (const fragment of b.fragments.slice(start)) fragment.group = building.id;
  }
  return { geometry: b.finish(), fragments: [...b.fragments, ...fragments], panels, counts };
}
