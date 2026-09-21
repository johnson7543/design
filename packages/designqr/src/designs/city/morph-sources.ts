import { Color, Matrix4, Mesh, Vector3 } from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import type { CityBuilding } from './layout.ts';
import { buildCityMorphVoxels, type CityMorphMotion, type CityMorphVoxel } from './morph.ts';
import { cohereCityMorphTiles, matchCityMorphBuildings, matchCityMorphDetails } from './morph-correspondence.ts';
import { SHIBUYA_PALETTE as P } from './palette.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_ROAD_HEIGHT, SHIBUYA_CARRIAGEWAYS, SHIBUYA_CROSSWALKS, SHIBUYA_LAND, SHIBUYA_ROAD_MARKINGS,
  cityPointInPolygon, roadMetres, type RoadPolygon } from './road-network.ts';
import { SHIBUYA_STAIR_WELLS } from './station-layout.ts';

export interface CityMorphTarget { x: number; z: number; light?: boolean; ink: Color }
export interface CityMorphTile { source: CityMorphVoxel; target: CityMorphTarget; motion: CityMorphMotion }
export interface CityMorphGround extends CityMorphVoxel { open: boolean }
export type CityMorphPair = Pick<CityMorphTile, 'source' | 'target'>;

/** Visit only cell centers inside each polygon's bounds, retaining the exact
 * surveyed polygon/hole test. Temporary CPU masks, not rasterized textures. */
function groundMask(grid: number, polygons: readonly RoadPolygon[]) {
  const mask = new Uint8Array(grid * grid), point = { x: 0, z: 0 };
  for (const polygon of polygons) {
    const b = polygon.bounds;
    const minX = Math.max(0, Math.ceil((b.minX + .5) * grid - .5));
    const maxX = Math.min(grid - 1, Math.floor((b.maxX + .5) * grid - .5));
    const minZ = Math.max(0, Math.ceil((b.minZ + .5) * grid - .5));
    const maxZ = Math.min(grid - 1, Math.floor((b.maxZ + .5) * grid - .5));
    for (let row = minZ; row <= maxZ; row++) {
      point.z = (row + .5) / grid - .5;
      for (let col = minX; col <= maxX; col++) {
        const index = row * grid + col;
        if (mask[index]) continue;
        point.x = (col + .5) / grid - .5;
        if (cityPointInPolygon(point, polygon)) mask[index] = 1;
      }
    }
  }
  return mask;
}

/** Sample the SAME geographic paint/land as the scene, once per QR grid size.
 * No framebuffer readback, extra textures, per-frame raycasts or voxelization. */
export function createCityMorphGround(grid: number, buildings: readonly CityBuilding[]): CityMorphGround[] {
  const holes = SHIBUYA_STAIR_WELLS.map(ring => ({ rings: [ring], bounds: {
    minX: Math.min(...ring.map(p => p.x)), maxX: Math.max(...ring.map(p => p.x)),
    minZ: Math.min(...ring.map(p => p.z)), maxZ: Math.max(...ring.map(p => p.z)),
  } }));
  const result: CityMorphGround[] = [];
  const landMask = groundMask(grid, SHIBUYA_LAND), roadMask = groundMask(grid, SHIBUYA_CARRIAGEWAYS);
  const closed = groundMask(grid, [...buildings.map(b => b.groundEnvelope ?? b.footprint), ...holes]);
  const paint = SHIBUYA_ROAD_MARKINGS.map(marking => ({ ...marking, mask: groundMask(grid, marking.polygons) }));
  const crossings = SHIBUYA_CROSSWALKS.map(c => ({ ...c, cos: Math.cos(c.angle), sin: Math.sin(c.angle) }));
  const asphalt = new Color(P.asphalt), reflection = new Color(P.asphaltLight), tone = new Color();
  for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
    const x = (col + .5) / grid - .5, z = (row + .5) / grid - .5;
    const index = row * grid + col, road = roadMask[index], land = landMask[index];
    let height = land ? CITY_PAVEMENT_HEIGHT : CITY_ROAD_HEIGHT;
    let kind: CityMorphVoxel['kind'] = land ? 'pavement' : 'road';
    let color = land ? P.pavement : '#' + tone.copy(asphalt).lerp(reflection,
      road ? Math.exp(-(x * x + z * z) / (.17 * .17)) : 0).getHexString();
    for (const marking of paint) {
      const y = marking.role === 'warmLight' ? CITY_PAVEMENT_HEIGHT + .00008
        : CITY_ROAD_HEIGHT + (marking.role === 'paper' ? .00016 : .00008);
      if (y < height || !marking.mask[index]) continue;
      height = y; kind = 'marking';
      color = marking.role === 'paper' ? P.roadPaint : marking.role === 'warmLight' ? P.roadEdge : P.roadAccent;
    }
    const crossing = crossings.find(c => {
      const dx = x - c.x, dz = z - c.z;
      return Math.abs(dx * c.cos - dz * c.sin) < c.length / 2 && Math.abs(dx * c.sin + dz * c.cos) < c.width / 2;
    });
    // Zebra paint has its own thin, correctly oriented fragments below. Keep
    // asphalt beneath those strips rather than inflating a stripe sample into
    // a full QR-sized square before the crossing has actually resolved.
    if (crossing && !land && kind === 'marking' && color === P.roadPaint) {
      kind = 'road'; height = CITY_ROAD_HEIGHT;
      color = '#' + tone.copy(asphalt).lerp(reflection, Math.exp(-(x * x + z * z) / (.17 * .17))).getHexString();
    }
    result.push({ x, z, y: height - .0005, width: .98 / grid, height: .001, depth: .98 / grid,
      group: crossing ? `crosswalk-${crossing.id}` : undefined,
      color, kind, id: `ground-${row}-${col}`, open: !closed[index] });
  }
  return result;
}

/** At most twelve evenly distributed, source-contained stripes per crossing.
 * These supplement the ground tiles in the SAME instanced box batch. */
export function createCityMorphCrosswalks(): CityMorphVoxel[] {
  const paint = SHIBUYA_ROAD_MARKINGS.find(marking => marking.role === 'paper')!.polygons;
  return SHIBUYA_CROSSWALKS.flatMap(crossing => {
    const cos = Math.cos(crossing.angle), sin = Math.sin(crossing.angle);
    const radius = Math.hypot(crossing.length, crossing.width) / 2 + roadMetres(1);
    const stripes: CityMorphVoxel[] = [];
    for (const [index, polygon] of paint.entries()) {
      const bounds = polygon.bounds;
      if (bounds.minX > crossing.x + radius || bounds.maxX < crossing.x - radius
        || bounds.minZ > crossing.z + radius || bounds.maxZ < crossing.z - radius) continue;
      const ring = polygon.rings[0];
      const along = ring.map(p => (p.x - crossing.x) * cos - (p.z - crossing.z) * sin);
      const across = ring.map(p => (p.x - crossing.x) * sin + (p.z - crossing.z) * cos);
      const minA = Math.min(...along), maxA = Math.max(...along), minB = Math.min(...across), maxB = Math.max(...across);
      const a = (minA + maxA) / 2, b = (minB + maxB) / 2;
      if (Math.abs(a) > crossing.length / 2 || Math.abs(b) > crossing.width / 2
        || maxA - minA > roadMetres(1) || maxB - minB < roadMetres(2)) continue;
      const x = crossing.x + a * cos + b * sin, z = crossing.z - a * sin + b * cos;
      let width = (maxB - minB) * .98, depth = (maxA - minA) * .98;
      for (let attempt = 0; attempt < 12; attempt++) {
        if ([-1, 1].every(i => [-1, 1].every(j => cityPointInPolygon({
          x: x + i * width / 2 * sin + j * depth / 2 * cos,
          z: z + i * width / 2 * cos - j * depth / 2 * sin,
        }, polygon)))) {
          stripes.push({ x, z, y: CITY_ROAD_HEIGHT + .0005, width, depth, height: .0005,
            angle: crossing.angle - Math.PI / 2, color: P.roadPaint, kind: 'marking',
            group: `crosswalk-${crossing.id}`, id: `crosswalk-${crossing.id}-${index}` });
          break;
        }
        width *= .9; depth *= .9;
      }
    }
    stripes.sort((a, b) => (a.x - b.x) * cos - (a.z - b.z) * sin);
    const count = Math.min(12, stripes.length);
    return Array.from({ length: count }, (_, i) => stripes[Math.floor((i + .5) * stripes.length / count)]);
  });
}

/** One destination for every canonical cell, plus occupancy-bounded details.
 * Local parcel matching and object groups avoid a city-wide particle scramble. */
export function buildCityMorphBase(targets: readonly CityMorphTarget[], buildings: readonly CityBuilding[],
  ground: readonly CityMorphGround[]): CityMorphPair[] {
  return buildCitySurfaceMorphBase(targets, ground, skyline => buildCityMorphVoxels(skyline, buildings));
}

/** Shared City correspondence, independent of the source city's geometry.
 * Buildings supply dark skyline cells. Occluded light cells use exposed ground.
 * Each preset packs only its own real envelopes in createVolumes. */
export function buildCitySurfaceMorphBase(targets: readonly CityMorphTarget[], ground: readonly CityMorphGround[],
  createVolumes: (skyline: readonly CityMorphTarget[]) => CityMorphVoxel[]): CityMorphPair[] {
  const grid = Math.round(Math.sqrt(ground.length));
  const at = (p: { x: number; z: number }) => ground[Math.min(grid - 1, Math.max(0, Math.floor((p.z + .5) * grid))) * grid
    + Math.min(grid - 1, Math.max(0, Math.floor((p.x + .5) * grid)))];
  const nearest = (p: { x: number; z: number }) => {
    const col = Math.round((p.x + .5) * grid - .5), row = Math.round((p.z + .5) * grid - .5);
    let best = -1, distance = Infinity;
    const visit = (x: number, z: number) => {
      const index = z * grid + x, candidate = ground[index];
      if (!candidate.open) return;
      const d = (p.x - candidate.x) ** 2 + (p.z - candidate.z) ** 2;
      if (d < distance || d === distance && index < best) { best = index; distance = d; }
    };
    for (let radius = 1; radius < grid; radius++) {
      for (let x = Math.max(0, col - radius); x <= Math.min(grid - 1, col + radius); x++) {
        if (row - radius >= 0) visit(x, row - radius);
        if (row + radius < grid) visit(x, row + radius);
      }
      for (let z = Math.max(0, row - radius + 1); z <= Math.min(grid - 1, row + radius - 1); z++) {
        if (col - radius >= 0) visit(col - radius, z);
        if (col + radius < grid) visit(col + radius, z);
      }
      if (((radius + 1) / grid) ** 2 > distance + 1e-12) break;
    }
    return ground[best];
  };
  const skyline = targets.filter(target => !target.light && (at(target).kind === 'pavement' || !at(target).open));
  const volumes = createVolumes(skyline);
  const byTarget = new Map(matchCityMorphBuildings(volumes, skyline).map(({ source, target }) => [target, source]));
  return targets.map(target => {
    const building = byTarget.get(target);
    if (building) return { source: { ...building, kind: 'building' as const }, target };
    const surface = at(target);
    // Light cells behind towers emerge from the closest exposed ground, not
    // from an invisible flat sheet inside the building or an open stairwell.
    return { source: surface.open ? surface : nearest(target) ?? surface, target };
  });
}

/** Static base correspondence survives repeated turns. Only actor/detail
 * correspondence is refreshed; a content change invalidates the cached base. */
export function buildCityMorphPlan(targets: readonly CityMorphTarget[], buildings: readonly CityBuilding[],
  ground: readonly CityMorphGround[], details: readonly CityMorphVoxel[],
  base = buildCityMorphBase(targets, buildings, ground)): CityMorphTile[] {
  return cohereCityMorphTiles([...base, ...matchCityMorphDetails(boundedCityMorphDetails(details), targets, Math.round(Math.sqrt(ground.length)))]);
}

/** Preserve sign halves/actors, then distribute the remaining detail budget
 * across static surfaces. Fine façade density must not enlarge the QR batch. */
export function boundedCityMorphDetails(details: readonly CityMorphVoxel[], limit = 512): readonly CityMorphVoxel[] {
  if (details.length <= limit) return details;
  const active = details.filter(s => s.kind === 'sign' || s.kind === 'people' || s.kind === 'vehicle' || s.kind === 'train');
  const staticDetails = details.filter(s => !active.includes(s));
  const sample = (items: readonly CityMorphVoxel[], count: number) => Array.from({ length: count }, (_, i) => items[Math.floor((i + .5) / count * items.length)]);
  if (active.length >= limit) return sample(active, limit);
  return [...active, ...sample(staticDetails, limit - active.length)];
}

/** Cache a few palette-colored surface fragments per immutable static mesh.
 * Samples are deterministic and follow real geometry (including raised text).
 * The sampler/distribution is temporary CPU data, never another GPU resource. */
export function sampleCityMorphMesh(mesh: Mesh, kind: CityMorphVoxel['kind'], count: number): CityMorphVoxel[] {
  let seed = 7919;
  // Three's public seeded-generator method is missing from its addon typings.
  const sampler = new MeshSurfaceSampler(mesh) as MeshSurfaceSampler & {
    setRandomGenerator(random: () => number): MeshSurfaceSampler;
  };
  sampler.setRandomGenerator(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  });
  sampler.build();
  const position = new Vector3(), color = new Color(P.concrete), result: CityMorphVoxel[] = [];
  for (let i = 0; i < count; i++) {
    sampler.sample(position, undefined, color);
    result.push({ x: position.x, y: position.y, z: position.z, width: .009, height: .009, depth: .009,
      color: '#' + color.getHexString(), kind, id: `${mesh.name}-${i}` });
  }
  return result;
}

/** Copy an actor's already-evaluated local transform, never evaluate its clock.
 * Wheels and limbs merge with their parent body; the live object is untouched. */
export function cityMorphActor(matrix: Matrix4, color: string, kind: CityMorphVoxel['kind'], id: string,
  center: Vector3, size: Vector3): CityMorphVoxel {
  const position = center.clone().applyMatrix4(matrix), scale = new Vector3().setFromMatrixScale(matrix);
  return { x: position.x, y: position.y, z: position.z, width: size.x * scale.x,
    height: size.y * scale.y, depth: size.z * scale.z, angle: Math.atan2(matrix.elements[8], matrix.elements[10]),
    color, kind, id };
}
