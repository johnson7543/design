import { cityGroundHeight, cityNoise, type CityBuilding } from './layout.ts';
import { CITY_PAVEMENT_HEIGHT, cityOnCarriageway, citySurfaceDistance, roadMetres, type RoadPoint, type RoadPolygon } from './road-network.ts';
import { cityStationFrontageFrame, SHIBUYA_STATION_PASSAGE as PASSAGE } from './station-frontage-layout.ts';
import { HACHIKO_OBSTACLES } from './hachiko-layout.ts';
import { SHIBUYA_WORKSITE } from './construction-layout.ts';
import { isCityStreetApproachClear } from './street-layout.ts';
import { isCitySubwayApproachClear } from './station-layout.ts';
import { CITY_CYCLE_SECONDS } from './traffic-cycle.ts';

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => { const f = clamp(t); return f * f * (3 - 2 * f); };
type PathPoint = RoadPoint & { distance: number };
interface WalkLeg { path: readonly PathPoint[]; start: number; duration: number }
export interface CityStationWalk {
  entry: WalkLeg; exit: WalkLeg;
  frame: ReturnType<typeof cityStationFrontageFrame>;
  clear(point: RoadPoint): boolean;
}

/** Sample a curved approach densely enough to check the entire walking corridor. */
function curve(points: readonly RoadPoint[]): PathPoint[] {
  const path: PathPoint[] = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200, s = 1 - t, weights = [s ** 3, 3 * s * s * t, 3 * s * t * t, t ** 3];
    const x = points.reduce((sum, p, j) => sum + p.x * weights[j], 0);
    const z = points.reduce((sum, p, j) => sum + p.z * weights[j], 0);
    const previous = path.at(-1);
    path.push({ x, z, distance: previous ? previous.distance + Math.hypot(x - previous.x, z - previous.z) : 0 });
  }
  return path;
}

/** Use clear plaza routes, leaving the curb queues and Hachiko's garden intact. */
export function createCityStationWalk(curb: RoadPoint, waiting: readonly RoadPoint[], buildings: readonly CityBuilding[],
  seed: number, index: number, arrival: number, order: number): CityStationWalk | undefined {
  const station = buildings.find(b => b.kind === 'station-front');
  if (!station) return;
  const frame = cityStationFrontageFrame(station), origin = frame.local(curb);
  const obstacles = [...HACHIKO_OBSTACLES, SHIBUYA_WORKSITE, ...buildings.filter(b => b !== station).map(b => b.groundEnvelope ?? b.envelope)];
  const queues = waiting.filter(p => Math.hypot(p.x - curb.x, p.z - curb.z) > roadMetres(.1));
  const outside = (p: RoadPoint, polygon: RoadPolygon, margin: number) => {
    const b = polygon.bounds;
    return p.x < b.minX - margin || p.x > b.maxX + margin || p.z < b.minZ - margin || p.z > b.maxZ + margin
      || citySurfaceDistance(p.x, p.z, [polygon]) < -margin;
  };
  const clear = (p: RoadPoint) => {
    const local = frame.local(p);
    const inPassage = local.u > PASSAGE.center - PASSAGE.width / 2 + .5
      && local.u < PASSAGE.center + PASSAGE.width / 2 - .5 && local.depth > -1.3;
    return !cityOnCarriageway(p.x, p.z) && isCityStreetApproachClear(p.x, p.z)
      && isCitySubwayApproachClear(p.x, p.z, .3)
      && (inPassage || outside(p, station.envelope, roadMetres(.4)))
      && !(Math.abs(local.depth - 5) < .65 && [11.1, 15.6, 20.2, 22.45].some(u => Math.abs(u - local.u) < .5))
      && obstacles.every(o => outside(p, o, roadMetres(.55)))
      && queues.every(q => Math.hypot(q.x - p.x, q.z - p.z) > roadMetres(.60));
  };
  const pathTo = (lane: number, side: number) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const bend = (attempt ? (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 1.2 : 0);
      const path = curve([curb, frame.point(origin.u + (lane - origin.u) * .38 + side * 3 + bend, origin.depth * .64),
        frame.point(lane, -7), frame.point(lane, PASSAGE.hiddenDepth)]);
      if (path.every(clear)) return path;
    }
    return undefined;
  };
  // Separate parts of the real doorway also avoid its four internal columns.
  const entryPath = pathTo(12.8 + cityNoise(index + 810, seed) * 2.0, -1);
  const outwardPath = pathTo(16.5 + cityNoise(index + 811, seed) * 2.6, 1);
  if (!entryPath || !outwardPath) return;
  const exitLength = outwardPath.at(-1)!.distance;
  const exitPath = [...outwardPath].reverse().map(p => ({ ...p, distance: exitLength - p.distance }));
  const start = arrival + .35 + cityNoise(index + 812, seed) * .3;
  const duration = entryPath.at(-1)!.distance / (.022 + cityNoise(index + 813, seed) * .006) + .6;
  const exitStart = CITY_CYCLE_SECONDS * 2 + order * .62 + cityNoise(index + 814, seed) * .28;
  return { frame, clear, entry: { path: entryPath, start, duration },
    exit: { path: exitPath, start: exitStart, duration: CITY_CYCLE_SECONDS * 3 - 2.2 - exitStart } };
}

function samplePath(path: readonly PathPoint[], distance: number) {
  let low = 0, high = path.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (path[mid].distance < distance) low = mid; else high = mid;
  }
  const a = path[low], b = path[high], t = clamp((distance - a.distance) / (b.distance - a.distance));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** Smooth velocity ramps at the curb; doorway changes happen behind the rear wall. */
export function cityStationWalkMotion(walk: CityStationWalk, phase: number, restingHeading: number, withSurface = true) {
  const entering = phase < walk.exit.start, leg = entering ? walk.entry : walk.exit;
  const elapsed = Math.max(0, phase - leg.start), ramp = .6;
  const length = leg.path.at(-1)!.distance, speed = length / (leg.duration - ramp);
  const remaining = Math.max(0, leg.duration - elapsed);
  const rampDistance = (t: number) => t < ramp ? t ** 3 / ramp ** 2 - t ** 4 / (2 * ramp ** 3) : t - ramp / 2;
  const distance = elapsed < leg.duration / 2 ? speed * rampDistance(elapsed) : length - speed * rampDistance(remaining);
  const point = samplePath(leg.path, distance);
  let pace = speed * ease(elapsed / ramp) * ease(remaining / ramp);
  let heading = point.heading;
  if (entering) heading = restingHeading + Math.atan2(Math.sin(heading - restingHeading), Math.cos(heading - restingHeading)) * ease(elapsed / ramp);
  else heading += Math.atan2(Math.sin(restingHeading - heading), Math.cos(restingHeading - heading)) * (1 - ease(remaining / ramp));

  if (entering && elapsed > leg.duration) {
    // Walk sideways behind the concourse wall, then dwell before emerging.
    const from = walk.entry.path.at(-1)!, to = walk.exit.path[0];
    const t = ease((elapsed - leg.duration) / 2);
    point.x = from.x + (to.x - from.x) * t; point.z = from.z + (to.z - from.z) * t;
    heading = samplePath(walk.exit.path, 0).heading; pace = 0;
  }
  return { ...point, heading, distance, speed: pace,
    freedom: ease(Math.min(distance, length - distance) / roadMetres(1.2)),
    ...(withSurface ? cityStationWalkSurface(walk, point) : { groundHeight: 0, insideStation: false }) };
}

export function cityStationWalkSurface(walk: CityStationWalk, point: RoadPoint) {
  const local = walk.frame.local(point);
  const floor = CITY_PAVEMENT_HEIGHT + roadMetres(PASSAGE.floorHeight) * ease((local.depth - PASSAGE.front) / .35);
  const ground = cityGroundHeight(point.x, point.z);
  return { insideStation: local.depth > .1,
    groundHeight: ground + (floor - ground) * ease((local.depth + 1) / 1.4) };
}
