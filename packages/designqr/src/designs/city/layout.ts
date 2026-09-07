import { contentVariation } from '../content-variation.ts';
import { BLOCK_SIZE, QR_VISUAL_REFERENCE_GRID_SIZE } from '../tree/constants.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_ROAD_HEIGHT, SHIBUYA_PAVEMENTS,
  citySurfaceDistance, citySurveyPoint, roadMetres, type RoadPolygon } from './road-network.ts';
import { HACHIKO_TREES, STATION_CURB_TREES, isHachikoApproachClear } from './hachiko-layout.ts';
import { SHIBUYA_BUILDING_DATA } from './building-data.ts';
import { isCityStreetApproachClear } from './street-layout.ts';
import { isCitySubwayApproachClear } from './station-layout.ts';
import { MARK_CITY_PASSAGE } from './mark-city-layout.ts';
import { isCityWorksiteApproachClear } from './construction-layout.ts';
export { SHIBUYA_CROSSWALKS } from './road-network.ts';

/** Normalized city coordinates: one uniformly scaled, station-facing survey tile. */
export interface CityBuilding {
  x: number; z: number; width: number; depth: number; height: number;
  facade: 'glass' | 'concrete' | 'stone';
  sign?: number;
  id: string; kind: string; footprint: RoadPolygon; envelope: RoadPolygon;
  sourceHeight: number; floors: number; detailSeed: number;
  /** Elevated structures reserve separate ground supports and overhead volume. */
  groundEnvelope?: RoadPolygon;
  baseHeight?: number;
}

export interface CityBounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function cityBoundsContain(outer: CityBounds, inner: CityBounds) {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX
    && inner.minZ >= outer.minZ && inner.maxZ <= outer.maxZ;
}

/** Broad phase only. Concave building clearance must use its actual polygon. */
export function cityBuildingBounds(b: CityBuilding): CityBounds {
  return b.envelope.bounds;
}

function polygon(rings: readonly (readonly number[][])[]): RoadPolygon {
  const points = rings.map(r => r.map(([x, z]) => ({ x: roadMetres(x), z: roadMetres(z) })));
  return { rings: points, bounds: { minX: Math.min(...points[0].map(p => p.x)), maxX: Math.max(...points[0].map(p => p.x)),
    minZ: Math.min(...points[0].map(p => p.z)), maxZ: Math.max(...points[0].map(p => p.z)) } };
}

export const CITY_BUILDING_PARCELS = Object.freeze(SHIBUYA_BUILDING_DATA.buildings.map(b => polygon(b.envelope)));
export const CITY_BUILDING_PLOTS: readonly CityBounds[] = Object.freeze(CITY_BUILDING_PARCELS.map(p => p.bounds));

/** Start south of the crossing, looking at the Hachiko-facing facades.
 * This offsets the camera while preserving the surveyed foundation. */
export const CITY_CAMERA_YAW_OFFSET = -Math.PI / 2;

/** All QR bits influence the skyline, including equal-size codes with different text. */
export function createCityBuildings(modules: readonly (readonly boolean[])[]): readonly CityBuilding[] {
  const grid = modules.length;
  if (!grid || modules.some(row => row.length !== grid)) throw new Error('City requires a square QR matrix.');
  const contentSeed = contentVariation(modules);
  const facades = ['glass', 'concrete', 'stone'] as const;
  return SHIBUYA_BUILDING_DATA.buildings.map((source, index) => {
    const passage = source.id === MARK_CITY_PASSAGE.sourceId;
    const footprint = polygon(passage ? [MARK_CITY_PASSAGE.roof] : source.footprint), p = footprint.bounds;
    const noise = (salt: number) => cityNoise(index * 23 + salt, contentSeed);
    const width = p.maxX - p.minX, depth = p.maxZ - p.minZ;
    const x = (p.minX + p.maxX) / 2, z = (p.minZ + p.maxZ) / 2;
    // The local QR neighborhood controls floor density; the full hash adds individuality.
    const row = Math.floor((z + .5) * grid), col = Math.floor((x + .5) * grid);
    const radius = Math.max(1, Math.floor(grid / 8));
    let dark = 0, count = 0;
    for (let r = Math.max(0, row - radius); r <= Math.min(grid - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min(grid - 1, col + radius); c++) {
        dark += Number(modules[r][c]); count++;
      }
    }
    // Landmarks retain measured massing. QR content varies contextual storeys,
    // tenant bays, glazing and roof details, never their geographic street edge.
    const fixed = index < 2 || source.kind === 'station-front' || passage;
    const sourceHeight = roadMetres(source.sourceHeightMetres);
    const height = passage ? roadMetres(MARK_CITY_PASSAGE.roofHeight) : source.kind === 'station-front' ? roadMetres(10.8) : fixed ? sourceHeight
      : Math.max(roadMetres(8), Math.round(sourceHeight * (.73 + .47 * (.25 * dark / Math.max(1, count) + .75 * noise(5))) / .005) * .005);
    return { x, z, width, depth, height,
      id: source.id, kind: passage ? 'mark-city-passage' : source.kind, footprint,
      envelope: passage ? footprint : CITY_BUILDING_PARCELS[index], sourceHeight,
      ...(passage ? { groundEnvelope: CITY_BUILDING_PARCELS[index], baseHeight: roadMetres(MARK_CITY_PASSAGE.clearance) } : {}),
      floors: passage ? 1 : index === 0 ? 8 : index === 1 ? 7 : source.kind === 'station-front' ? 2 : Math.max(2, Math.round(height / roadMetres(3.2 + noise(17) * 1.4))),
      detailSeed: contentSeed,
      facade: passage || index === 0 ? 'glass' : index === 1 || source.kind === 'station-front' ? 'concrete' : facades[Math.floor(noise(6) * facades.length)],
      sign: fixed ? index % 14 : Math.floor(noise(9) * 14),
    };
  });
}

export const SHIBUYA_STREET_TREES = Object.freeze([...HACHIKO_TREES,
  ...STATION_CURB_TREES.map(p => ({ ...p, ...citySurveyPoint(p.east, p.south) }))]);

export function citySidewalkDistance(x: number, z: number) {
  return citySurfaceDistance(x, z, SHIBUYA_PAVEMENTS);
}

export function cityGroundHeight(x: number, z: number) {
  const t = Math.max(0, Math.min(1, (citySidewalkDistance(x, z) + roadMetres(.2)) / roadMetres(1)));
  return CITY_ROAD_HEIGHT + (CITY_PAVEMENT_HEIGHT - CITY_ROAD_HEIGHT) * t * t * (3 - 2 * t);
}

export function isCityWaitingPositionClear(x: number, z: number, buildings: readonly CityBuilding[]) {
  return citySidewalkDistance(x, z) >= .005
    && isCityStreetApproachClear(x, z)
    && isCitySubwayApproachClear(x, z)
    && isHachikoApproachClear(x, z)
    && isCityWorksiteApproachClear(x, z)
    && buildings.every(b => citySurfaceDistance(x, z, [b.groundEnvelope ?? b.envelope]) < -.005)
    && SHIBUYA_STREET_TREES.every(t => Math.abs(x - t.x) > .017 || Math.abs(z - t.z) > .015);
}

export function cityNoise(index: number, seed: number): number {
  const value = Math.sin(index * 127.1 + seed * 7919) * 43758.5453;
  return value - Math.floor(value);
}

/** Distance from the city focus that keeps every model corner inside the frustum. */
export function fitCityCameraDistance(aspect: number, verticalFov: number, yaw: number, pitch: number): number {
  const referenceWidth = BLOCK_SIZE * QR_VISUAL_REFERENCE_GRID_SIZE;
  const focusY = .10;
  const tanY = Math.tan(verticalFov * Math.PI / 360) * .92;
  const tanX = tanY * aspect;
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  let distance = 0;
  for (const x of [-.515, .515]) for (const y of [-.05, .56]) for (const z of [-.515, .515]) {
    const px = x * referenceWidth, py = y * referenceWidth - focusY, pz = z * referenceWidth;
    const horizontal = px * cosYaw - pz * sinYaw;
    const vertical = px * sinPitch * sinYaw + py * cosPitch + pz * sinPitch * cosYaw;
    const depth = px * cosPitch * sinYaw - py * sinPitch + pz * cosPitch * cosYaw;
    distance = Math.max(distance, depth + Math.abs(horizontal) / tanX, depth + Math.abs(vertical) / tanY);
  }
  return distance;
}
