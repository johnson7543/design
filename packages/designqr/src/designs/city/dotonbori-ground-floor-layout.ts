import { Vector3 } from 'three';
import type { DotonboriLibrary, DotonboriPolygon } from './dotonbori-assets.ts';
import type { DotonboriBuilding } from './dotonbori-buildings.ts';
import type { DotonboriFront } from './dotonbori-facade-layout.ts';
import { dotonboriContains } from './dotonbori-detail-layout.ts';
import { dotonboriRoofAt } from './dotonbori-morph.ts';
import { DOTONBORI_STOREFRONT_ACCESS } from './dotonbori-storefront-access-data.ts';
import { wallCoverage, wallPoint } from './dotonbori-walls.ts';
import { cityNoise } from './building-variation.ts';
import { dotonboriStoreKind } from './dotonbori-storefronts.ts';

/** Cover every exposed source-ground wall, retaining the registered shop fronts.
 * Party walls and tile-cut caps are not public facades. Uses are QR-generated
 * interpretations; source bases are not silently moved to the diagrammatic road. */
export function resolveDotonboriGroundFloors(buildings: readonly DotonboriBuilding[], library: DotonboriLibrary,
  registered: readonly DotonboriFront[]) {
  const { layout, waterfront } = library, size = layout.tileSizeM;
  const upper = [...waterfront.upperWalk, ...DOTONBORI_STOREFRONT_ACCESS.map(a => a.polygon as unknown as DotonboriPolygon)];
  const fronts: DotonboriFront[] = [];
  const byBuilding = buildings.map(building => ({ building: building.id, groundWalls: 0, registeredFronts: registered.filter(f => f.building === building.id && f.bottom < 6).length,
    contextFronts: 0, exposedMetres: 0, coveredMetres: 0, excludedMetres: 0, occludedMetres: 0, narrowMetres: 0, unsupportedMetres: 0 }));
  const en = (p: Vector3) => {
    const q = p.clone().multiplyScalar(size).applyAxisAngle(new Vector3(0, 1, 0), -layout.rotationYRadians);
    return [q.x + layout.centerEastNorthM[0], -q.z + layout.centerEastNorthM[1]] as const;
  };
  const terrain = (p: Vector3) => {
    const [e, n] = en(p);
    if (dotonboriContains(upper, e, n)) return waterfront.levelsM.upperWalk;
    if (dotonboriContains(waterfront.lowerWalk, e, n)) return waterfront.levelsM.lowerWalk;
    return dotonboriContains(library.plan.water, e, n) ? undefined : 0;
  };
  const occupied = (p: Vector3) => buildings.some(other => {
    const b = other.geometry.boundingBox!;
    return p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z
      && p.y < b.max.y && dotonboriRoofAt(other.geometry, p.x, p.z) > p.y;
  });
  for (const [buildingIndex, building] of buildings.entries()) {
    const audit = byBuilding[buildingIndex], sourceBase = building.geometry.boundingBox!.min.y * size;
    const reference = registered.find(f => f.building === building.id && dotonboriStoreKind(f));
    const known = reference && dotonboriStoreKind(reference);
    for (const [edge, wall] of building.walls.entries()) {
      if (wall.minY * size > sourceBase + .25 || (wall.maxY - wall.minY) * size < .35) continue;
      audit.groundWalls++;
      const groundTop = Math.max(sourceBase + .04, waterfront.levelsM.upperWalk) + 3.1;
      const reservations = registered.filter(f => f.building === building.id && f.wall === wall && f.bottom < groundTop);
      if (reservations.some(f => !f.groundFloorOnly)) continue;
      const left = wall.minU + .10 / size, right = wall.maxU - .10 / size;
      const length = (right - left) * size;
      if (length < .65) { audit.excludedMetres += Math.max(0, length); audit.narrowMetres += Math.max(0, length); continue; }
      const samples = Math.max(1, Math.ceil(length / .45)), step = (right - left) / samples;
      type Cell = { minU: number; maxU: number; bottom: number; projection: number; entrance: boolean; partial: boolean };
      const cells: (Cell | undefined)[] = [];
      for (let cell = 0; cell < samples; cell++) {
        const minU = left + step * cell, maxU = minU + step, u = (minU + maxU) / 2;
        if (reservations.some(f => maxU > f.minU && minU < f.maxU)) { cells.push(undefined); continue; }
        const floor = terrain(wallPoint(wall, u, 0, .20 / size));
        const bottom = Math.max(wall.minY * size + .04, floor ?? 0), top = bottom + 3.1;
        const rect = { minU, maxU, minY: bottom / size, maxY: top / size };
        const coverage = wallCoverage(wall, rect) / ((maxU - minU) * 3.1 / size), partial = coverage < .999;
        if (coverage < .03) {
          cells.push(undefined); audit.excludedMetres += step * size; audit.unsupportedMetres += step * size; continue;
        }
        let clearance = 1.8;
        for (const offset of [.08, .2, .4, .7, 1.1, 1.8]) {
          if ([minU, u, maxU].some(t => {
            const p = wallPoint(wall, t, (bottom + 1.2) / size, offset / size);
            return Math.abs(p.x) >= .4999 || Math.abs(p.z) >= .4999 || occupied(p);
          })) { clearance = offset === .08 ? 0 : offset === .2 ? .08 : offset === .4 ? .2 : offset === .7 ? .4 : offset === 1.1 ? .7 : 1.1; break; }
        }
        if (clearance < .2) { cells.push(undefined); audit.excludedMetres += step * size; audit.occludedMetres += step * size; continue; }
        // Each side uses less than half an alley's available clearance.
        const projection = Math.min(partial ? .12 : .62, clearance * .42, floor === undefined ? .16 : .62);
        const supported = [minU, u, maxU].every(t => [.20, projection].every(offset => {
          const level = terrain(wallPoint(wall, t, 0, offset / size));
          return level !== undefined && Math.abs(bottom - level) < .16;
        }));
        cells.push({ minU, maxU, bottom, projection, partial, entrance: !partial && supported && projection > .3 });
        audit.exposedMetres += step * size;
      }
      for (let start = 0; start < cells.length;) {
        const first = cells[start]; if (!first) { start++; continue; }
        let end = start + 1;
        while (end < cells.length && cells[end] && Math.abs(cells[end]!.bottom - first.bottom) < .01
          && cells[end]!.projection === first.projection && cells[end]!.entrance === first.entrance && cells[end]!.partial === first.partial) end++;
        const run = cells.slice(start, end) as Cell[], minU = first.minU, maxU = run.at(-1)!.maxU;
        const width = (maxU - minU) * size;
        if (width < .65) { audit.excludedMetres += width; audit.narrowMetres += width; audit.exposedMetres -= width; start = end; continue; }
        const projection = Math.min(...run.map(c => c.projection)), seed = Math.floor(cityNoise(edge * 151 + start * 7, building.seed) * 100000);
        const kinds = ['cafe', 'retail', 'dining', 'lobby', 'sweets', 'shutter'] as const;
        const kind = first.partial || width < 2.2 || projection < .2 ? 'service' : known
          ?? kinds[Math.floor(cityNoise(edge * 379 + start * 29 + building.index, building.seed) * kinds.length)];
        fronts.push({ minU, maxU, minY: first.bottom / size, maxY: (first.bottom + 3.1) / size,
          id: `context-${building.index}-${edge}-${start}`, building: building.id, wall, size, u: (minU + maxU) / 2,
          width, bottom: first.bottom, top: first.bottom + 3.1, yaw: Math.atan2(wall.nx, wall.nz), groundFloorOnly: true,
          context: { kind, entrance: run.every(c => c.entrance) && width >= 2.6 && !['shutter', 'service'].includes(kind), projection, seed, partial: first.partial } });
        audit.contextFronts++; audit.coveredMetres += width; start = end;
      }
    }
  }
  return { fronts, byBuilding };
}
