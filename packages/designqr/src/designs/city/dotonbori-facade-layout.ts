import { Vector3 } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import type { DotonboriLayout } from './dotonbori-layout.ts';
import { dotonboriLandmarkLocation } from './dotonbori-layout.ts';
import { DOTONBORI_REFERENCE_HOSTS } from './dotonbori-composition.ts';
import { dotonboriPoint } from './dotonbori-detail-layout.ts';
import { dotonboriBuildingWalls, wallCoverage, wallPoint, type DotonboriWall, type WallRect } from './dotonbori-walls.ts';
import type { DotonboriShopKind } from './dotonbori-storefront-design.ts';

/** Photo registration hints, not surveyed planes. Resolve against the actual
 * wall below before placing glazing, ribs, shops or sign artwork. */
export const DOTONBORI_NIGHT_FRONTS = [
  { id: 'B037', e: -9.43, n: -12.64, width: 6.5, bottom: 2.0, top: 35.4, face: 'north' },
  { id: 'B039', e: -40.68, n: -13.36, width: 12.9, bottom: 1.95, top: 29.8, face: 'north' },
  { id: 'B040', e: -17.6735967, n: -12.8052594, width: 10.4, bottom: 1.95, top: 33.7, face: 'north' },
  { id: 'B041', e: -28.55, n: -12.85, width: 10.6, bottom: 1.95, top: 27.6, face: 'north' },
  { id: 'B046', e: 22.33, n: -15.88, width: 14.3, bottom: 1.95, top: 37.8, face: 'north' },
  { id: 'B046-west', e: 14.68, n: -22.8, width: 12.7, bottom: 1.95, top: 37.8, face: 'west' },
  { id: 'B046-south', e: 22.3264, n: -28.3823, width: 14.9, bottom: 1.26, top: 34.50, face: 'south', normalEastNorth: [-.19226348, -.98134334] },
  { id: 'B034-south-lower', e: -16.6, n: 16.98, width: 20.8, bottom: 2.2, top: 30.6, face: 'south' },
  { id: 'B034-south-upper', e: -18.1, n: 17.01, width: 14.2, bottom: 31.1, top: 49.4, face: 'south' },
  { id: 'B034-east-lower', e: -5.52, n: 27.3, width: 19.2, bottom: 2.2, top: 30.6, face: 'east' },
  { id: 'B034-east-upper', e: -10.63, n: 24.96, width: 15.0, bottom: 31.1, top: 49.4, face: 'east' },
  { id: 'B031-west', e: 15.97, n: 27.5, width: 18.6, bottom: 2.0, top: 34.2, face: 'west' },
  { id: 'B037-east', e: -5.957, n: -17.882, width: 9.6, bottom: 5.25, top: 35.4, face: 'east' },
  { id: 'B092', e: 135.52, n: 15.91, width: 32.3, bottom: 1.95, top: 44.57, face: 'south' },
] as const;

export interface DotonboriFront extends WallRect {
  id: string; building: string; wall: DotonboriWall; size: number; u: number;
  width: number; bottom: number; top: number; yaw: number;
  /** A contextual shop reserves only its ground floor; upper QR detail stays. */
  groundFloorOnly?: boolean;
  /** Unverified context use, fitted to exposed source walls rather than photos. */
  context?: { kind: DotonboriShopKind; entrance: boolean; projection: number; seed: number; partial?: boolean };
}

export function resolveDotonboriFronts(buildings: readonly { id: string; walls: DotonboriWall[] }[], layout: DotonboriLayout): DotonboriFront[] {
  const size = layout.tileSizeM, fronts: DotonboriFront[] = [];
  for (const hint of DOTONBORI_NIGHT_FRONTS) {
    const building = DOTONBORI_REFERENCE_HOSTS[hint.id.slice(0, 4)], host = buildings.find(b => b.id === building);
    if (!host) continue;
    const yaw = layout.rotationYRadians + ({ north: Math.PI, south: 0, east: Math.PI / 2, west: -Math.PI / 2 })[hint.face];
    const normal = 'normalEastNorth' in hint
      ? new Vector3(hint.normalEastNorth[0], 0, -hint.normalEastNorth[1]).applyAxisAngle(new Vector3(0, 1, 0), layout.rotationYRadians)
      : new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const [east, north] = dotonboriLandmarkLocation(layout, building, hint.e, hint.n);
    const point = dotonboriPoint(east, north, 0, layout);
    const candidates = host.walls.filter(w => w.nx * normal.x + w.nz * normal.z > .99
      && Math.abs(w.nx * point.x + w.nz * point.z - w.plane) * size < 1.2)
      .map(wall => {
        const half = Math.min(hint.width / size, wall.maxU - wall.minU - .16 / size) / 2;
        const u = Math.max(wall.minU + half + .08 / size, Math.min(wall.maxU - half - .08 / size, wall.dx * point.x + wall.dz * point.z));
        const rect = { minU: u - half, maxU: u + half,
          minY: Math.max(hint.bottom / size, wall.minY), maxY: Math.min(hint.top / size, wall.maxY - .08 / size) };
        return { wall, rect, area: wallCoverage(wall, rect) };
      }).sort((a, b) => b.area - a.area);
    const candidate = candidates[0]; if (!candidate || candidate.area < .0001) continue;
    const { wall, rect } = candidate;
    fronts.push({ ...rect, id: hint.id, building, wall, size, u: (rect.minU + rect.maxU) / 2,
      width: (rect.maxU - rect.minU) * size, bottom: rect.minY * size, top: rect.maxY * size,
      yaw: Math.atan2(wall.nx, wall.nz) });
  }
  // The broad block immediately left of Asahi in the opening view keeps its
  // QR-generated envelope. Only its river-facing 1F band gets a shop owner.
  const context = buildings.find(b => b.id === 'bldg_855dffaa-1263-4a5f-bd07-8ed04eded429');
  const normal = new Vector3(Math.sin(layout.rotationYRadians + Math.PI), 0, Math.cos(layout.rotationYRadians + Math.PI));
  const wall = context?.walls.filter(w => w.nx * normal.x + w.nz * normal.z > .99 && w.minY * size < 2)
    .sort((a, b) => (b.maxU - b.minU) - (a.maxU - a.minU))[0];
  if (context && wall) {
    const minU = wall.minU + .16 / size, maxU = wall.maxU - .16 / size, bottom = 1.95, top = bottom + 3.1;
    const rect = { minU, maxU, minY: bottom / size, maxY: top / size };
    if (wallCoverage(wall, rect) >= (maxU - minU) * (top - bottom) / size * .999) fronts.push({
      ...rect, id: 'B049-north', building: context.id, wall, size, u: (minU + maxU) / 2,
      width: (maxU - minU) * size, bottom, top, yaw: Math.atan2(wall.nx, wall.nz), groundFloorOnly: true,
    });
  }
  return fronts;
}

export function libraryDotonboriFronts(library: DotonboriLibrary) {
  const hosts = new Set(Object.values(DOTONBORI_REFERENCE_HOSTS));
  return resolveDotonboriFronts(library.templates.filter(t => hosts.has(t.id)).map(t => ({ id: t.id, walls: dotonboriBuildingWalls(t.geometry) })), library.layout);
}

export function frontPoint(front: DotonboriFront, x: number, y: number, offsetM: number) {
  return wallPoint(front.wall, front.u + x / front.size, y / front.size, offsetM / front.size);
}

/** Keep flat advertisements rectangular and wholly supported across setbacks.
 * Fit proportionally, then move within the registered source frontage. */
export function fitDotonboriPanel(front: DotonboriFront, y: number, width: number, height: number) {
  let scale = Math.min(1, (front.width - .32) / width, (front.top - front.bottom - .32) / height);
  for (let attempt = 0; attempt < 16; attempt++, scale *= .9) {
    const w = width * scale, h = height * scale;
    const centerY = Math.max(front.bottom + h / 2 + .16, Math.min(front.top - h / 2 - .16, y));
    const rect = { minU: front.u - w / front.size / 2, maxU: front.u + w / front.size / 2,
      minY: (centerY - h / 2) / front.size, maxY: (centerY + h / 2) / front.size };
    if (wallCoverage(front.wall, rect) >= w * h / front.size ** 2 * .999) return { width: w, height: h, y: centerY };
  }
  return undefined;
}
