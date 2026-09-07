import type { CityBuilding } from './layout.ts';
import { CITY_PAVEMENT_HEIGHT, cityPointInPolygon, citySurfaceContainsBounds } from './road-network.ts';
import { SHIBUYA_PALETTE } from './palette.ts';
import { cityStationMassingHeight } from './station-frontage-layout.ts';

export function cityEase(progress: number, start = 0, end = 1) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export interface CityMorphVoxel {
  x: number; y: number; z: number;
  width: number; height: number; depth: number; color: string;
  angle?: number;
  kind?: 'building' | 'road' | 'pavement' | 'marking' | 'people' | 'vehicle' | 'train' | 'sign' | 'station' | 'furniture' | 'garden';
  id?: string;
  /** Pieces of one object keep a shared translation before resolving into cells. */
  group?: string;
}

export interface CityMorphMotion { x: number; z: number; settle: number }

export const CITY_BUILDING_REVEAL_START = .08;

/** Start with upper storeys, with a small stable offset between buildings.
 * Only the reveal changes: source volumes, destinations and travel stay intact.
 * Every window is wider than the street/detail handoff and completes by .42,
 * while the original city is still opaque underneath. */
export function cityBuildingRevealWindows(sources: readonly CityMorphVoxel[]): [number, number][] {
  const bounds = new Map<string | undefined, { bottom: number; top: number; phase: number }>();
  for (const source of sources) {
    if (source.kind !== 'building') continue;
    let group = bounds.get(source.group);
    if (!group) {
      let hash = 0;
      for (const character of source.group ?? '') hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
      group = { bottom: Infinity, top: -Infinity, phase: (hash >>> 0) % 101 / 100 };
      bounds.set(source.group, group);
    }
    group.bottom = Math.min(group.bottom, source.y - source.height / 2);
    group.top = Math.max(group.top, source.y + source.height / 2);
  }
  return sources.map(source => {
    if (source.kind !== 'building') return [.30, .42];
    const group = bounds.get(source.group)!;
    const storey = Math.max(0, Math.min(1, (source.y - group.bottom) / Math.max(.00001, group.top - group.bottom)));
    const phase = (1 - storey) * .8 + group.phase * .2;
    return [CITY_BUILDING_REVEAL_START + phase * .10, .34 + phase * .08];
  });
}

/** Pack each building's actual volume into the QR cells it will become. */
export function buildCityMorphVoxels(targets: readonly { x: number; z: number }[], buildings: readonly CityBuilding[]): CityMorphVoxel[] {
  const groups: number[][] = buildings.map(() => []);
  targets.forEach((target, index) => {
    let nearest = 0, distance = Infinity;
    for (const [i, b] of buildings.entries()) {
      const d = (b.x - target.x) ** 2 + (b.z - target.z) ** 2;
      if (d < distance) { nearest = i; distance = d; }
    }
    groups[nearest].push(index);
  });
  const result: CityMorphVoxel[] = new Array(targets.length);
  groups.forEach((indices, building) => {
    if (!indices.length) return;
    const b = buildings[building];
    const desiredLayers = Math.max(1, Math.round(Math.cbrt(indices.length * b.height ** 2 / (b.width * b.depth))));
    const columns = Math.max(2, Math.ceil(Math.sqrt(indices.length / desiredLayers * b.width / b.depth)));
    const rows = Math.max(2, Math.ceil(columns * b.depth / b.width));
    const cells: { x: number; z: number; width: number; depth: number }[] = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const x = b.footprint.bounds.minX + (col + .5) / columns * b.width;
      const z = b.footprint.bounds.minZ + (row + .5) / rows * b.depth;
      if (!cityPointInPolygon({ x, z }, b.footprint)) continue;
      // Shrink boundary cells, not the road. Full rectangles must fit curved/
      // concave walls; corner-only or bounding-box packing leaks into streets.
      let width = b.width / columns, depth = b.depth / rows;
      for (let attempt = 0; attempt < 12; attempt++) {
        if (citySurfaceContainsBounds([b.footprint], { minX: x - width / 2, maxX: x + width / 2,
          minZ: z - depth / 2, maxZ: z + depth / 2 })) { cells.push({ x, z, width, depth }); break; }
        width *= .75; depth *= .75;
      }
    }
    if (!cells.length) throw new Error(`No morph volume inside ${b.id}.`);
    const layers = Math.max(1, Math.ceil(indices.length / cells.length));
    let offset = 0;
    for (let layer = 0; layer < layers; layer++) {
      const count = Math.floor(indices.length / layers) + (layer < indices.length % layers ? 1 : 0);
      for (let cell = 0; cell < count; cell++) {
        const source = cells[Math.floor((cell + .5) / count * cells.length)];
        const base = b.baseHeight ?? 0;
        const height = (b.kind === 'station-front' ? cityStationMassingHeight(b, source) : b.height) - base;
        result[indices[offset++]] = { ...source, y: CITY_PAVEMENT_HEIGHT + base + (layer + .5) / layers * height,
          height: height / layers, color: SHIBUYA_PALETTE[b.facade], group: b.id };
      }
    }
  });
  return result;
}

export function cityMorphState(progress: number) {
  // Building blocks reveal gradually in roof-to-base sections beforehand;
  // streets/details keep this coverage-first handoff. Never fade the original
  // city throughout the reveal: that exposes back faces and looks glassy.
  const handoff = cityEase(progress, .40, .46);
  return {
    cityOpacity: 1 - handoff,
    voxelOpacity: handoff,
    vertical: cityEase(progress, .02, .92),
    // Full-color city tiles supply BOTH light and dark cells. The canonical
    // paper/ink layer is only a final, pixel-identical endpoint handoff.
    // Keep coverage beneath the final QR until it is fully opaque, too.
    tileOpacity: progress < 1 ? cityEase(progress, .30, .42) : 0,
    qrOpacity: cityEase(progress, .94, 1),
    plateOpacity: cityEase(progress, .94, 1),
  };
}

export function cityMorphPose(source: CityMorphVoxel, target: { x: number; z: number; light?: boolean }, grid: number,
  progress: number, motion: CityMorphMotion = { x: 0, z: 0, settle: .54 }) {
  const vertical = cityMorphState(progress).vertical;
  const travel = cityEase(progress, .42, .90);
  const settle = cityEase(progress, motion.settle, .94);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return {
    x: source.x + motion.x * travel + (target.x - source.x - motion.x) * settle,
    y: mix(source.y, target.light ? -.002 : .001, vertical),
    z: source.z + motion.z * travel + (target.z - source.z - motion.z) * settle,
    width: mix(source.width, 1.002 / grid, settle),
    height: mix(source.height, .002, vertical),
    depth: mix(source.depth, 1.002 / grid, settle),
    angle: (source.angle ?? 0) * (1 - settle),
    ink: cityEase(progress, .50, .94),
  };
}
