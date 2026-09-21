import { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityMorphVoxel } from './morph.ts';

export interface DotonboriBuildingRange { building?: string; start: number; count: number }
export type DotonboriFragment = CityMorphVoxel & { sourceBuilding?: string };

export function dotonboriBuildingRanges(geometry: BufferGeometry): DotonboriBuildingRange[] {
  return geometry.userData.buildingRanges ?? [];
}

export function tagDotonboriBuilding(geometry: BufferGeometry, building: string) {
  geometry.userData.buildingRanges = [{ building, start: 0, count: geometry.index?.count ?? geometry.getAttribute('position').count }];
}

/** Preserve ownership without splitting a single atlas into dozens of draws. */
export function mergeDotonboriGeometry(parts: BufferGeometry[]) {
  const geometry = parts.length ? mergeGeometries(parts)! : new BufferGeometry();
  let offset = 0; const ranges: DotonboriBuildingRange[] = [];
  const unlit: { start: number; count: number }[] = [];
  for (const part of parts) {
    const count = part.index?.count ?? part.getAttribute('position').count;
    const owned = dotonboriBuildingRanges(part);
    for (const range of owned.length ? owned : [{ start: 0, count }]) ranges.push({ ...range, start: range.start + offset });
    for (const range of part.userData.dotonboriUnlitRanges ?? []) {
      const previous = unlit.at(-1), start = range.start + offset;
      if (previous && previous.start + previous.count === start) previous.count += range.count;
      else unlit.push({ start, count: range.count });
    }
    offset += count;
  }
  // Adjacent primitives usually share a host; keep this metadata compact.
  geometry.userData.buildingRanges = ranges.reduce<DotonboriBuildingRange[]>((result, range) => {
    const previous = result.at(-1);
    if (previous && previous.building === range.building) previous.count += range.count;
    else result.push({ ...range });
    return result;
  }, []);
  if (unlit.length) geometry.userData.dotonboriUnlitRanges = unlit;
  return geometry;
}
