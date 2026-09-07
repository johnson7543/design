import { Color } from 'three';
import type { CityMorphVoxel } from './morph.ts';
import type { CityMorphTarget, CityMorphTile } from './morph-sources.ts';

type Pair = Pick<CityMorphTile, 'source' | 'target'>;
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const groupKey = (s: CityMorphVoxel) => `${s.kind}:${s.group ?? `${Math.floor((s.x + .5) * 8)}:${Math.floor((s.z + .5) * 8)}`}`;

/** Keep the existing parcel ownership, but uncross unnecessarily long paths
 * inside each building. Two bounded local passes; no global assignment solver. */
export function matchCityMorphBuildings(sources: readonly CityMorphVoxel[], targets: readonly CityMorphTarget[]): Pair[] {
  const groups = new Map<string | undefined, Pair[]>();
  sources.forEach((source, i) => {
    const group = groups.get(source.group) ?? [];
    group.push({ source, target: targets[i] }); groups.set(source.group, group);
  });
  for (const group of groups.values()) for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      if (distance(a.source, b.target) + distance(b.source, a.target) + 1e-12
        < distance(a.source, a.target) + distance(b.source, b.target)) {
        [a.target, b.target] = [b.target, a.target];
      }
    }
  }
  return [...groups.values()].flat();
}

/** Details retain their palette-compatible destinations, with bounded occupancy
 * and distinct cells within each object wherever possible. Reserve long vehicle
 * groups before crowds, rather than collapsing every nearby source onto one cell.
 * Cached at a turn/content change; there is no per-frame destination search. */
export function matchCityMorphDetails(sources: readonly CityMorphVoxel[], targets: readonly CityMorphTarget[], grid: number): Pair[] {
  if (!targets.length) return [];
  const palettes = [targets.filter(t => !t.light), targets.filter(t => t.light)];
  const tone = new Map<CityMorphVoxel, number>(), totals = [0, 0];
  const groups = new Map<string, CityMorphVoxel[]>();
  const color = new Color();
  for (const source of sources) {
    color.set(source.color);
    let ink = Number(.2126 * color.r + .7152 * color.g + .0722 * color.b > .5);
    if (!palettes[ink].length) ink = 1 - ink;
    tone.set(source, ink); totals[ink]++;
    const key = groupKey(source), group = groups.get(key) ?? [];
    group.push(source); groups.set(key, group);
  }
  const capacities = palettes.map((cells, i) => Math.max(2, Math.ceil(totals[i] / (cells.length || 1))));
  const cells: (CityMorphTarget | undefined)[] = new Array(grid * grid), occupancy = new Uint32Array(grid * grid);
  const result = new Map<CityMorphVoxel, CityMorphTarget>();
  for (const target of targets) cells[Math.round((target.z + .5) * grid - .5) * grid + Math.round((target.x + .5) * grid - .5)] = target;
  const priority = (s: CityMorphVoxel) => s.kind === 'train' ? 0 : s.kind === 'vehicle' ? 1 : s.kind === 'sign' ? 2 : 3;
  for (const group of [...groups.values()].sort((a, b) => priority(a[0]) - priority(b[0]))) {
    const used = new Set<CityMorphTarget>();
    const distinct = group[0].group !== undefined;
    // Preserve longitudinal ordering within a car/train and horizontal ordering
    // across sign panels; nearby targets then keep the same spatial sequence.
    const angle = group[0].angle ?? 0, sign = group[0].kind === 'sign';
    const axis = sign ? { x: Math.cos(angle), z: -Math.sin(angle) } : { x: Math.sin(angle), z: Math.cos(angle) };
    const ordered = [...group].sort((a, b) => (a.x - b.x) * axis.x + (a.z - b.z) * axis.z);
    for (const source of ordered) {
      const ink = tone.get(source)!;
      let best = -1, score = Infinity;
      const col = Math.max(0, Math.min(grid - 1, Math.floor((source.x + .5) * grid)));
      const row = Math.max(0, Math.min(grid - 1, Math.floor((source.z + .5) * grid)));
      const offset = Math.max(Math.abs(source.x - ((col + .5) / grid - .5)), Math.abs(source.z - ((row + .5) / grid - .5)));
      // One distinct cell per fragment inside an object, unless the QR itself
      // lacks enough compatible cells. Hard global capacity still always holds.
      for (let pass = 0; pass < 2 && best < 0; pass++) {
        const visit = (x: number, z: number) => {
          const index = z * grid + x, candidate = cells[index], count = occupancy[index];
          if (!candidate || Number(!!candidate.light) !== ink || count >= capacities[ink]
            || pass === 0 && distinct && used.has(candidate)) return;
          const cost = distance(source, candidate) + count * count * 2 / (grid * grid);
          if (cost < score || cost === score && index < best) { score = cost; best = index; }
        };
        // QR targets form a regular grid. Search rings, stopping once even the
        // nearest point of the next ring cannot beat our candidate's score.
        // Dense QR matrices therefore do not trigger full-grid scans per actor.
        for (let radius = 0; radius < grid; radius++) {
          const minX = Math.max(0, col - radius), maxX = Math.min(grid - 1, col + radius);
          for (let x = minX; x <= maxX; x++) {
            if (row - radius >= 0) visit(x, row - radius);
            if (radius > 0 && row + radius < grid) visit(x, row + radius);
          }
          for (let z = Math.max(0, row - radius + 1); z <= Math.min(grid - 1, row + radius - 1); z++) {
            if (col - radius >= 0) visit(col - radius, z);
            if (radius > 0 && col + radius < grid) visit(col + radius, z);
          }
          const nextDistance = Math.max(0, (radius + 1) / grid - offset);
          if (best >= 0 && nextDistance * nextDistance > score) break;
        }
      }
      if (best < 0) throw new Error('City morph detail capacity exhausted.');
      occupancy[best]++; used.add(cells[best]!); result.set(source, cells[best]!);
    }
  }
  return sources.map(source => ({ source, target: result.get(source)! }));
}

/** First move an object's center as a unit, retaining relative offsets, heading
 * and footprint. Only later let its pieces resolve into individual QR cells.
 * The same pure correspondence serves forward, reverse and interrupted turns. */
export function cohereCityMorphTiles(pairs: readonly Pair[]): CityMorphTile[] {
  const groups = new Map<string, { x: number; z: number; count: number }>();
  for (const { source, target } of pairs) {
    const key = groupKey(source), group = groups.get(key) ?? { x: 0, z: 0, count: 0 };
    group.x += target.x - source.x; group.z += target.z - source.z; group.count++;
    groups.set(key, group);
  }
  return pairs.map(pair => {
    const group = groups.get(groupKey(pair.source))!, kind = pair.source.kind;
    const settle = kind === 'train' || kind === 'vehicle' ? .60 : kind === 'marking' ? .62 : kind === 'sign' ? .58 : .54;
    return { ...pair, motion: { x: group.x / group.count, z: group.z / group.count, settle } };
  });
}
