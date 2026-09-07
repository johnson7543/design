import { cityGroundHeight, cityNoise, isCityWaitingPositionClear, type CityBuilding } from './layout.ts';
import { SHIBUYA_CROSSWALKS, cityOnCarriageway, citySurfaceDistance, roadMetres, type RoadPoint } from './road-network.ts';
import { isCitySubwayApproachClear, isCitySubwaySpanClear } from './station-layout.ts';
import { HACHIKO_OBSTACLES } from './hachiko-layout.ts';
import { SHIBUYA_WORKSITE } from './construction-layout.ts';
import { SHIBUYA_CENTER_GAI_ENTRANCE, SHIBUYA_STREET_LANTERNS, SHIBUYA_STREET_SIGNALS } from './street-layout.ts';
import { CITY_CYCLE_SECONDS, CITY_DRIVE_START, cityCycleTime } from './traffic-cycle.ts';
import { createCityStationWalk, cityStationWalkMotion, cityStationWalkSurface, type CityStationWalk } from './station-pedestrians.ts';

const ROUTE_PAIRS = [12, 12, 12, 10, 30, 14];
export const CITY_PEDESTRIAN_COUNT = ROUTE_PAIRS.reduce((sum, pairs) => sum + pairs * 2, 0);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const PointRate = 30;
const ClipSteps = CITY_DRIVE_START * PointRate;
const ClipStride = 5; // X, Z, accumulated walking distance, heading, gait weight.
const StationHalfCycle = CITY_CYCLE_SECONDS * 2;
const StationCycle = StationHalfCycle * 2;
const PersonalSpace = roadMetres(.82);
type Point = RoadPoint;
const posts = [
  ...SHIBUYA_STREET_SIGNALS.map(s => ({ ...s.position, radius: roadMetres(.65) })),
  ...SHIBUYA_CENTER_GAI_ENTRANCE.posts.map(p => ({ ...p, radius: roadMetres(.78) })),
  ...SHIBUYA_STREET_LANTERNS.map(p => ({ ...p, radius: roadMetres(.55) })),
];

const diagonalStart = SHIBUYA_CROSSWALKS[1].end, diagonalEnd = SHIBUYA_CROSSWALKS[3].start;
/** The unmarked counter-diagonal joins opposite corners during the scramble. */
export const CITY_PEDESTRIAN_ROUTES = Object.freeze([...SHIBUYA_CROSSWALKS, {
  id: 'counter-scramble', start: diagonalStart, end: diagonalEnd,
  x: (diagonalStart.x + diagonalEnd.x) / 2, z: (diagonalStart.z + diagonalEnd.z) / 2,
  length: Math.hypot(diagonalEnd.x - diagonalStart.x, diagonalEnd.z - diagonalStart.z),
  width: roadMetres(5.8), angle: Math.atan2(-(diagonalEnd.z - diagonalStart.z), diagonalEnd.x - diagonalStart.x),
}]);

interface CityWalkTrip {
  departure: number; duration: number; startLane: number; endLane: number; bend: number;
  tempo: number; tempoPhase: number;
  path: readonly (Point & { distance: number })[];
}
export interface CityPedestrian {
  index: number; seed: number; route: number; direction: number;
  start: Point; end: Point; trips: readonly CityWalkTrip[];
  station?: { walk: CityStationWalk; crossing: CityPedestrian; offset: number };
}
const clips = new WeakMap<CityPedestrian, readonly Float32Array[]>();
const stationClips = new WeakMap<CityPedestrian, readonly Float32Array[]>();
const crowdCache = new Map<string, readonly CityPedestrian[]>();

/** Spaced, seeded curb positions. Opposite commuters share a spot on alternate trips. */
export function createCityPedestrians(seed: number, buildings: readonly CityBuilding[]): readonly CityPedestrian[] {
  // Contextual facade changes do not require planning the same footpaths again.
  // Bound CPU-only storage to two footprints/seeds; scenes own all GPU resources.
  const key = JSON.stringify([seed, buildings.map(b => (b.groundEnvelope ?? b.envelope).rings)]);
  const cached = crowdCache.get(key);
  if (cached) return cached;
  const occupied: Point[] = [];
  const slots: { start: Point; end: Point; route: number }[] = [];
  const place = (routeIndex: number, end: boolean, salt: number): Point => {
    const route = CITY_PEDESTRIAN_ROUTES[routeIndex], direction = end ? 1 : -1;
    const curb = end ? route.end : route.start;
    const dx = Math.cos(route.angle) * direction, dz = -Math.sin(route.angle) * direction;
    let best: Point | undefined, bestDistance = -1;
    for (let attempt = 0; attempt < 2400; attempt++) {
      // A pavilion occupies some former queue space. Try the original near-curb
      // area first, then fan deeper into the same sidewalk to retain spacing.
      const expanded = attempt >= 400;
      const outward = roadMetres(1.2 + cityNoise(salt + attempt * 2, seed) * (expanded ? 10 : 6));
      const lateral = (cityNoise(salt + attempt * 2 + 1, seed) - .5) * route.width * (expanded ? 1.15 : .85);
      const point = {
        x: curb.x + dx * outward - dz * lateral,
        z: curb.z + dz * outward + dx * lateral,
      };
      if (attempt >= 1800 && best) {
        // Refine a crowded pocket locally when broad samples miss the narrow
        // remaining space beside a pavilion.
        const radius = roadMetres(.8 * (2400 - attempt) / 600 + .03);
        point.x = best.x + (cityNoise(salt + attempt * 2, seed) - .5) * radius;
        point.z = best.z + (cityNoise(salt + attempt * 2 + 1, seed) - .5) * radius;
      }
      if (!isCityWaitingPositionClear(point.x, point.z, buildings)) continue;
      if (posts.some(post => Math.hypot(point.x - post.x, point.z - post.z) < post.radius + roadMetres(.05))) continue;
      // A legal waiting point must also have a clear approach to its own curb.
      if ([.2, .4, .6, .8].some(t => cityOnCarriageway(curb.x + (point.x - curb.x) * t, curb.z + (point.z - curb.z) * t))) continue;
      // Check the curved approach, not just its waiting endpoint. The lane
      // extremes cover both directions and every commuter's seeded lane offset.
      let blocked = false;
      for (let step = 0; step <= 20; step++) {
        const t = step / 20, f = end ? 1 - t * .25 : t * .25, weight = 1 - t * t * (3 - 2 * t);
        const span = [-.40, .40].map(lane => {
          const rx = Math.cos(route.angle), rz = -Math.sin(route.angle);
          const a = { x: route.start.x - rz * route.width * lane, z: route.start.z + rx * route.width * lane };
          const b = { x: route.end.x - rz * route.width * lane, z: route.end.z + rx * route.width * lane };
          const anchor = end ? b : a;
          return { x: a.x + (b.x - a.x) * f + (point.x - anchor.x) * weight,
            z: a.z + (b.z - a.z) * f + (point.z - anchor.z) * weight };
        });
        if (span.some(p => cityOnCarriageway(p.x, p.z)
          && Math.abs((p.x - route.x) * Math.sin(route.angle) + (p.z - route.z) * Math.cos(route.angle)) > route.width * .46)) {
          blocked = true; break;
        }
        if (!isCitySubwaySpanClear(span[0], span[1], .45)) { blocked = true; break; }
      }
      if (blocked) continue;
      const clearance = occupied.reduce((distance, other) => Math.min(distance,
        Math.hypot(point.x - other.x, point.z - other.z)), Infinity);
      if (clearance > bestDistance) { best = point; bestDistance = clearance; }
      if (clearance >= roadMetres(.98)) break;
    }
    if (!best) throw new Error('Shibuya has no clear pavement position for a commuter.');
    occupied.push(best);
    return best;
  };
  for (let wave = 0; wave < Math.max(...ROUTE_PAIRS); wave++) for (let route = 0; route < ROUTE_PAIRS.length; route++) {
    if (wave >= ROUTE_PAIRS[route]) continue;
    const pair = slots.length;
    slots.push({ route, start: place(route, false, pair * 1703), end: place(route, true, pair * 1907 + 30001) });
  }
  const people = slots.flatMap((slot, pair) => [-1, 1].map((direction, side) => {
    const index = pair * 2 + side, { route } = slot;
    const person: CityPedestrian = { index, seed, direction, ...slot, trips: [] };
    person.trips = [0, 1].map(trip => {
      const noise = (salt: number) => cityNoise(index * 19 + trip * 701 + salt, seed);
      const width = CITY_PEDESTRIAN_ROUTES[route].width;
      const plan: CityWalkTrip = {
        departure: .12 + noise(31) ** 1.5 * 2.8, duration: 1,
        startLane: (noise(250) - .5) * width * .60,
        endLane: (noise(251) - .5) * width * .60,
        bend: (noise(252) - .5) * width * .14,
        tempo: .12 + noise(253) * .32, tempoPhase: noise(254) * Math.PI * 2, path: [],
      };
      let length = 0, last = pedestrianPath(person, plan, 0);
      const path = [{ ...last, distance: 0 }];
      for (let step = 1; step <= 48; step++) {
        const next = pedestrianPath(person, plan, step / 48);
        length += Math.hypot(next.x - last.x, next.z - last.z); last = next;
        path.push({ ...next, distance: length });
      }
      plan.path = path;
      plan.duration = Math.min(CITY_DRIVE_START - .8 - plan.departure, length / (.026 + noise(79) * .018) + .35);
      return plan;
    });
    return person;
  }));
  bakeCrowd(people, buildings);
  // A pair shares a curb slot at different times. One arrives from the crossing
  // while the other returns from the station for the following walk signal.
  const waiting = slots.flatMap(slot => [slot.start, slot.end]);
  let stationPairs = 0;
  for (const route of [2, 3, 4]) {
    const candidates = people.filter(p => p.route === route && p.direction > 0)
      .sort((a, b) => b.end.z - a.end.z);
    let selected = 0;
    for (const source of candidates) {
      const clip = clips.get(source)![0];
      let settled = ClipSteps;
      while (settled > 0 && Math.abs(clip[settled * ClipStride + 2] - clip[(settled - 1) * ClipStride + 2]) < 1e-8) settled--;
      const walk = createCityStationWalk(source.end, waiting, buildings, seed, source.index, settled / PointRate, stationPairs);
      if (!walk) continue;
      source.station = { walk, crossing: source, offset: 0 };
      people[source.index - 1].station = { walk, crossing: source, offset: StationHalfCycle };
      stationPairs++;
      if (++selected === 3) break;
    }
  }
  bakeStationWalks(people);
  if (crowdCache.size >= 2) crowdCache.delete(crowdCache.keys().next().value!);
  crowdCache.set(key, people);
  return people;
}

function pedestrianPath(person: CityPedestrian, trip: CityWalkTrip, fraction: number): Point {
  const route = CITY_PEDESTRIAN_ROUTES[person.route];
  const dx = Math.cos(route.angle), dz = -Math.sin(route.angle);
  const lane = trip.startLane + (trip.endLane - trip.startLane) * ease(fraction)
    + trip.bend * Math.sin(Math.PI * fraction);
  const start = { x: route.start.x - dz * trip.startLane, z: route.start.z + dx * trip.startLane };
  const end = { x: route.end.x - dz * trip.endLane, z: route.end.z + dx * trip.endLane };
  const leave = 1 - ease(fraction / .25), arrive = ease((fraction - .75) / .25);
  return {
    x: route.start.x + dx * route.length * fraction - dz * lane + (person.start.x - start.x) * leave + (person.end.x - end.x) * arrive,
    z: route.start.z + dz * route.length * fraction + dx * lane + (person.start.z - start.z) * leave + (person.end.z - end.z) * arrive,
  };
}

function intendedPose(person: CityPedestrian, tripIndex: number, phase: number) {
  const trip = person.trips[tripIndex], fraction = clamp((phase - trip.departure) / trip.duration);
  const tempo = fraction + trip.tempo * (Math.sin(fraction * Math.PI * 2 + trip.tempoPhase) - Math.sin(trip.tempoPhase)) / (Math.PI * 2);
  const ramp = .10;
  const distance = tempo < ramp ? tempo * tempo / (2 * ramp)
    : tempo > 1 - ramp ? 1 - ramp - (1 - tempo) ** 2 / (2 * ramp) : tempo - ramp / 2;
  const travel = distance / (1 - ramp);
  const forward = person.direction * (tripIndex ? -1 : 1), pathProgress = forward > 0 ? travel : 1 - travel;
  // Arc length keeps the curved curb approaches at the same walking pace as
  // the middle of the crossing, even for someone waiting deep in the crowd.
  const pathLength = trip.path.at(-1)!.distance, along = pathProgress * pathLength;
  let low = 0, high = trip.path.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (trip.path[mid].distance < along) low = mid; else high = mid;
  }
  const a = trip.path[low], b = trip.path[high], t = (along - a.distance) / (b.distance - a.distance);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, pathProgress,
    freedom: ease(Math.min(along, pathLength - along) / roadMetres(1.2)) };
}

function restingHeading(person: CityPedestrian, point: Point) {
  return Math.atan2(-point.x, -point.z) + (cityNoise(person.index + 600, person.seed) - .5) * .85;
}
function angleBetween(a: number, b: number) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }

/** Solve the two trips once. Playback is seekable and independent of frame rate. */
function bakeCrowd(people: readonly CityPedestrian[], buildings: readonly CityBuilding[]) {
  const count = people.length, trips = people.map(() => [] as Float32Array[]);
  const obstacles = [...HACHIKO_OBSTACLES, SHIBUYA_WORKSITE, ...buildings.map(b => b.groundEnvelope ?? b.envelope)];
  const clear = (person: CityPedestrian, x: number, z: number) => {
    const route = CITY_PEDESTRIAN_ROUTES[person.route];
    if (cityOnCarriageway(x, z)) {
      const lateral = -(x - route.x) * -Math.sin(route.angle) + (z - route.z) * Math.cos(route.angle);
      return Math.abs(lateral) < route.width * .46;
    }
    return isCitySubwayApproachClear(x, z, .25) && obstacles.every(p => {
      const b = p.bounds;
      return x < b.minX - .002 || x > b.maxX + .002 || z < b.minZ - .002 || z > b.maxZ + .002
        || citySurfaceDistance(x, z, [p]) < -.002;
    });
  };
  for (let tripIndex = 0; tripIndex < 2; tripIndex++) {
    const postSides = people.map(() => new Map<(typeof posts)[number], number>());
    const positions = people.map(person => intendedPose(person, tripIndex, 0));
    const offsets = people.map(() => ({ x: 0, z: 0 }));
    const heading = people.map((person, i) => restingHeading(person, positions[i]));
    const travelled = new Float64Array(count), gait = new Float64Array(count);
    const output = people.map(() => new Float32Array((ClipSteps + 1) * ClipStride));
    let lastBase = positions;
    for (let step = 0; step <= ClipSteps; step++) {
      const phase = step / PointRate, base = people.map(person => intendedPose(person, tripIndex, phase));
      const next = base.map((point, i) => ({ x: point.x + offsets[i].x * .88 * point.freedom,
        z: point.z + offsets[i].z * .88 * point.freedom }));
      // A broad phase includes the complete sidestep allowance, then nearby
      // pairs alone take part in anticipation and separation.
      const order = people.map((_, i) => i).sort((a, b) => next[a].x - next[b].x);
      const neighbors: [number, number][] = [];
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
        const a = order[i], b = order[j];
        if (next[b].x - next[a].x > .04) break;
        if (Math.abs(next[a].z - next[b].z) <= .04 && base[a].freedom + base[b].freedom >= .001) neighbors.push([a, b]);
      }
      // Look ahead along both walkers' intended velocities and step to the side
      // before a head-on encounter. The sign of the pass stays stable per pair.
      for (const [a, b] of neighbors) {
        const mobility = base[a].freedom + base[b].freedom;
        if (mobility < .001) continue;
        const dx = positions[a].x - positions[b].x, dz = positions[a].z - positions[b].z;
        if (Math.abs(dx) > .025 || Math.abs(dz) > .025) continue;
        const vx = (base[a].x - lastBase[a].x - base[b].x + lastBase[b].x) * PointRate;
        const vz = (base[a].z - lastBase[a].z - base[b].z + lastBase[b].z) * PointRate;
        const speed2 = vx * vx + vz * vz;
        if (speed2 < .00001) continue;
        const encounter = -(dx * vx + dz * vz) / speed2;
        if (encounter < 0 || encounter > .22) continue;
        const gap = Math.hypot(dx + vx * encounter, dz + vz * encounter);
        if (gap > PersonalSpace * 1.15) continue;
        const side = Math.sign(dx * -vz + dz * vx) || ((a + b) % 2 ? -1 : 1);
        const shift = side * (PersonalSpace * 1.15 - gap) * .18 / (Math.sqrt(speed2) * mobility);
        next[a].x -= vz * shift * base[a].freedom; next[a].z += vx * shift * base[a].freedom;
        next[b].x += vz * shift * base[b].freedom; next[b].z -= vx * shift * base[b].freedom;
      }
      for (let i = 0; i < count; i++) {
        const vx = (base[i].x - lastBase[i].x) * PointRate, vz = (base[i].z - lastBase[i].z) * PointRate;
        const speed2 = vx * vx + vz * vz;
        if (speed2 < .00001) continue;
        for (const post of posts) {
          const dx = positions[i].x - post.x, dz = positions[i].z - post.z;
          if (Math.abs(dx) > .025 || Math.abs(dz) > .025) continue;
          const encounter = -(dx * vx + dz * vz) / speed2;
          if (encounter < 0 || encounter > .30) continue;
          const gap = Math.hypot(dx + vx * encounter, dz + vz * encounter), radius = post.radius + roadMetres(.2);
          if (gap >= radius) continue;
          const side = postSides[i].get(post) ?? (Math.sign(dx * vz - dz * vx) || (i % 2 ? 1 : -1));
          postSides[i].set(post, side);
          const shift = -side * (radius - gap) * .30 * base[i].freedom / Math.sqrt(speed2);
          next[i].x -= vz * shift; next[i].z += vx * shift;
        }
      }
      // Symmetric separation lets opposing streams weave and overtake locally.
      // People waiting at the curb anchor the flow instead of being pushed aside.
      for (let iteration = 0; iteration < 4; iteration++) {
        for (const [a, b] of neighbors) {
          const mobility = base[a].freedom + base[b].freedom;
          if (mobility < .001) continue;
          let dx = next[a].x - next[b].x, dz = next[a].z - next[b].z;
          if (Math.abs(dx) >= PersonalSpace || Math.abs(dz) >= PersonalSpace) continue;
          const length = Math.hypot(dx, dz);
          if (length >= PersonalSpace) continue;
          if (length < 1e-8) { dx = PersonalSpace; dz = 0; }
          const push = (PersonalSpace - length) / (Math.hypot(dx, dz) * mobility);
          next[a].x += dx * push * base[a].freedom; next[a].z += dz * push * base[a].freedom;
          next[b].x -= dx * push * base[b].freedom; next[b].z -= dz * push * base[b].freedom;
        }
        for (let i = 0; i < count; i++) {
          if (base[i].freedom > 0) for (const post of posts) {
            const dx = next[i].x - post.x, dz = next[i].z - post.z;
            if (Math.abs(dx) >= post.radius || Math.abs(dz) >= post.radius) continue;
            const length = Math.hypot(dx, dz);
            if (length > 1e-8 && length < post.radius) {
              next[i].x += dx * (post.radius / length - 1);
              next[i].z += dz * (post.radius / length - 1);
            }
          }
          const dx = next[i].x - base[i].x, dz = next[i].z - base[i].z;
          if (Math.abs(dx) + Math.abs(dz) < 1e-10) continue;
          const limit = roadMetres(1.25) * base[i].freedom, length = Math.hypot(dx, dz);
          const amount = length > limit ? limit / length : 1;
          next[i].x = base[i].x + dx * amount; next[i].z = base[i].z + dz * amount;
          if (!clear(people[i], next[i].x, next[i].z)) {
            // Keep the reachable part of a sidestep when a pavilion or curb
            // constrains it, so encountering an edge does not reset the offset.
            let low = 0, high = amount;
            for (let pass = 0; pass < 7; pass++) {
              const mid = (low + high) / 2;
              if (clear(people[i], base[i].x + dx * mid, base[i].z + dz * mid)) low = mid;
              else high = mid;
            }
            next[i].x = base[i].x + dx * low; next[i].z = base[i].z + dz * low;
          }
        }
      }
      lastBase = base;
      for (let i = 0; i < count; i++) {
        let dx = next[i].x - positions[i].x, dz = next[i].z - positions[i].z;
        // Bound a last-moment sidestep as well as forward progress. Remaining
        // curb corrections settle during the reserved pedestrian clearance.
        const stride = Math.hypot(dx, dz), maxStride = .12 / PointRate;
        if (stride > maxStride) {
          dx *= maxStride / stride; dz *= maxStride / stride;
          next[i].x = positions[i].x + dx; next[i].z = positions[i].z + dz;
        }
        if (Math.hypot(dx, dz) > 1e-10) for (const post of posts) {
          if (Math.hypot(next[i].x - post.x, next[i].z - post.z) >= post.radius) continue;
          // Slide around a post when the forward step reaches it. A bounded
          // arc also keeps interpolated frames out of the upright itself.
          const px = positions[i].x - post.x, pz = positions[i].z - post.z;
          const side = postSides[i].get(post)
            ?? (Math.sign(px * (base[i].z - positions[i].z) - pz * (base[i].x - positions[i].x)) || (i % 2 ? 1 : -1));
          const angle = Math.atan2(pz, px);
          let found = false;
          const previousRadius = Math.hypot(px, pz);
          for (const radius of [post.radius, post.radius - roadMetres(.075),
            Math.max(post.radius, previousRadius), Math.max(post.radius, previousRadius) + roadMetres(.25)]) {
            const budget = Math.max(0, Math.hypot(dx, dz) - Math.abs(Math.hypot(px, pz) - radius));
            const turn = Math.min(.4, budget / radius);
            for (let attempt = 0; attempt < 12 && !found; attempt++) {
              const delta = side * (attempt % 2 ? -1 : 1) * turn * .5 ** Math.floor(attempt / 2);
              const x = post.x + Math.cos(angle + delta) * radius;
              const z = post.z + Math.sin(angle + delta) * radius;
              if (clear(people[i], x, z)) {
                next[i].x = x; next[i].z = z; found = true;
                postSides[i].set(post, side * (attempt % 2 ? -1 : 1));
              }
            }
            if (found) break;
          }
          if (!found) { next[i].x = positions[i].x; next[i].z = positions[i].z; }
          dx = next[i].x - positions[i].x; dz = next[i].z - positions[i].z;
        }
        const distance = Math.hypot(dx, dz), speed = distance * PointRate;
        travelled[i] += distance;
        offsets[i] = { x: next[i].x - base[i].x, z: next[i].z - base[i].z };
        const rest = restingHeading(people[i], next[i]), moving = ease(speed / .025);
        const goal = distance > 1e-8 ? rest + angleBetween(rest, Math.atan2(dx, dz)) * moving : rest;
        heading[i] += angleBetween(heading[i], goal) * .28;
        gait[i] += (Math.min(1.15, speed / .04) - gait[i]) * .4;
        output[i].set([next[i].x, next[i].z, travelled[i], heading[i], gait[i]], step * ClipStride);
        positions[i] = { ...base[i], ...next[i] };
      }
    }
    for (let i = 0; i < count; i++) trips[i].push(output[i]);
  }
  for (let i = 0; i < count; i++) clips.set(people[i], trips[i]);
}

/** Distance-driven steps retain each commuter's own cadence while yielding. */
function crossingPose(person: CityPedestrian, time: number, withSurface = true) {
  const cycle = Math.floor(time / CITY_CYCLE_SECONDS), phase = cityCycleTime(time);
  const tripIndex = ((cycle % 2) + 2) % 2;
  const clip = clips.get(person)![tripIndex], frame = Math.min(ClipSteps, phase * PointRate);
  const a = Math.floor(frame) * ClipStride, b = Math.min(ClipSteps, Math.floor(frame) + 1) * ClipStride;
  const t = frame % 1, value = (offset: number) => clip[a + offset] + (clip[b + offset] - clip[a + offset]) * t;
  const x = value(0), z = value(1), weight = value(4);
  const stride = value(2) / (.017 + cityNoise(person.index + 540, person.seed) * .004) * Math.PI * 2
    + cityNoise(person.index + 541, person.seed) * Math.PI * 2;
  return { x, z, heading: value(3), walking: clip[b + 2] - clip[a + 2] > 1e-8, insideStation: false,
    freedom: 0, stationTrip: false,
    pathProgress: intendedPose(person, tripIndex, phase).pathProgress, groundHeight: withSurface ? cityGroundHeight(x, z) : 0,
    swing: Math.sin(stride) * .62 * weight,
    restingArm: (1 - Math.min(1, weight)) * (person.index % 7 === 0 ? .7 : .10),
    bob: Math.abs(Math.sin(stride)) * .00065 * weight };
}

/** Station commuters continue through the plaza and rejoin a later walk phase. */
function stationPose(person: CityPedestrian, time: number, withSurface = true) {
  const journey = person.station;
  if (!journey) return crossingPose(person, time, withSurface);
  const phase = ((time - journey.offset) % StationCycle + StationCycle) % StationCycle;
  if (phase <= journey.walk.entry.start) return crossingPose(journey.crossing, phase, withSurface);
  if (phase >= CITY_CYCLE_SECONDS * 3) return crossingPose(journey.crossing, phase - StationHalfCycle, withSurface);
  const resting = crossingPose(journey.crossing, phase < StationHalfCycle ? CITY_DRIVE_START : CITY_CYCLE_SECONDS, withSurface);
  const motion = cityStationWalkMotion(journey.walk, phase, resting.heading, withSurface);
  const weight = Math.min(1.15, motion.speed / .04);
  const stride = motion.distance / (.017 + cityNoise(person.index + 540, person.seed) * .004) * Math.PI * 2
    + cityNoise(person.index + 541, person.seed) * Math.PI * 2;
  return { ...resting, ...motion, stationTrip: true, pathProgress: 1, walking: motion.speed > 1e-7,
    swing: Math.sin(stride) * .62 * weight, bob: Math.abs(Math.sin(stride)) * .00065 * weight,
    restingArm: (1 - Math.min(1, weight)) * (person.index % 7 === 0 ? .7 : .10) };
}

/** The smaller plaza flow yields to curb queues and to oncoming commuters. */
function bakeStationWalks(people: readonly CityPedestrian[]) {
  const commuters = people.filter(p => p.station), steps = StationHalfCycle * PointRate;
  if (!commuters.length) return;
  const output = commuters.map(() => new Float32Array((steps + 1) * ClipStride));
  const offsets = commuters.map(() => ({ x: 0, z: 0 }));
  const travelled = new Float64Array(commuters.length), gait = new Float64Array(commuters.length);
  let previous = people.map(p => stationPose(p, 0, false));
  const headings = commuters.map(p => previous[p.index].heading);
  for (let step = 0; step <= steps; step++) {
    const time = step / PointRate;
    const base = people.map(p => {
      if (p.station) return stationPose(p, time, false);
      // Other walkers keep their saved crossing positions. Avoid recomputing
      // terrain heights and articulation for the stationary collision anchors.
      const clip = clips.get(p)![Math.floor(time / CITY_CYCLE_SECONDS) % 2];
      const frame = Math.min(ClipSteps, cityCycleTime(time) * PointRate);
      const a = Math.floor(frame) * ClipStride, b = Math.min(ClipSteps, Math.floor(frame) + 1) * ClipStride;
      return { ...previous[p.index], x: clip[a] + (clip[b] - clip[a]) * (frame % 1),
        z: clip[a + 1] + (clip[b + 1] - clip[a + 1]) * (frame % 1) };
    });
    const mobility = new Float64Array(people.length);
    const next = base.map(p => ({ x: p.x, z: p.z }));
    for (const [i, person] of commuters.entries()) {
      const freedom = base[person.index].freedom;
      mobility[person.index] = freedom;
      next[person.index].x += offsets[i].x * .94 * freedom;
      next[person.index].z += offsets[i].z * .94 * freedom;
    }
    const pairs: [number, number][] = [];
    for (const p of commuters) for (const q of people) {
      const a = p.index, b = q.index;
      if (a === b || (q.station && a > b) || mobility[a] + mobility[b] < .001) continue;
      if (Math.abs(next[a].x - next[b].x) < .02 && Math.abs(next[a].z - next[b].z) < .02) pairs.push([a, b]);
    }
    for (const [a, b] of pairs) {
      const dx = previous[a].x - previous[b].x, dz = previous[a].z - previous[b].z;
      const vx = (base[a].x - previous[a].x - base[b].x + previous[b].x) * PointRate;
      const vz = (base[a].z - previous[a].z - base[b].z + previous[b].z) * PointRate;
      const speed2 = vx * vx + vz * vz;
      if (speed2 < .00001) continue;
      const encounter = -(dx * vx + dz * vz) / speed2;
      if (encounter < 0 || encounter > .45) continue;
      const gap = Math.hypot(dx + vx * encounter, dz + vz * encounter), radius = roadMetres(.95);
      if (gap >= radius) continue;
      const side = Math.sign(-dx * vz + dz * vx) || ((a + b) % 2 ? -1 : 1);
      const shift = side * (radius - gap) * .22 / (Math.sqrt(speed2) * (mobility[a] + mobility[b]));
      next[a].x -= vz * shift * mobility[a]; next[a].z += vx * shift * mobility[a];
      next[b].x += vz * shift * mobility[b]; next[b].z -= vx * shift * mobility[b];
    }
    for (let iteration = 0; iteration < 4; iteration++) {
      for (const [a, b] of pairs) {
        const dx = next[a].x - next[b].x, dz = next[a].z - next[b].z, gap = Math.hypot(dx, dz);
        if (gap < 1e-9 || gap >= PersonalSpace) continue;
        const push = (PersonalSpace - gap) / (gap * (mobility[a] + mobility[b]));
        next[a].x += dx * push * mobility[a]; next[a].z += dz * push * mobility[a];
        next[b].x -= dx * push * mobility[b]; next[b].z -= dz * push * mobility[b];
      }
      for (const p of commuters) {
        const i = p.index, dx = next[i].x - base[i].x, dz = next[i].z - base[i].z;
        const length = Math.hypot(dx, dz);
        if (length < 1e-10) continue;
        let amount = Math.min(1, roadMetres(1.2) * mobility[i] / length);
        if (!p.station!.walk.clear({ x: base[i].x + dx * amount, z: base[i].z + dz * amount })) {
          let low = 0, high = amount;
          for (let pass = 0; pass < 8; pass++) {
            const mid = (low + high) / 2;
            if (p.station!.walk.clear({ x: base[i].x + dx * mid, z: base[i].z + dz * mid })) low = mid; else high = mid;
          }
          amount = low;
        }
        next[i].x = base[i].x + dx * amount; next[i].z = base[i].z + dz * amount;
      }
    }
    for (const [i, person] of commuters.entries()) {
      const p = person.index;
      let dx = next[p].x - previous[p].x, dz = next[p].z - previous[p].z;
      const stepLength = Math.hypot(dx, dz), maxStep = .065 / PointRate;
      if (base[p].stationTrip && stepLength > maxStep) {
        dx *= maxStep / stepLength; dz *= maxStep / stepLength;
        next[p].x = previous[p].x + dx; next[p].z = previous[p].z + dz;
      }
      const distance = Math.hypot(dx, dz), pace = distance * PointRate;
      travelled[i] += distance;
      offsets[i] = { x: next[p].x - base[p].x, z: next[p].z - base[p].z };
      const motion = ease(pace / .025), rest = base[p].heading;
      const goal = distance > 1e-8 ? rest + angleBetween(rest, Math.atan2(dx, dz)) * motion : rest;
      // Tight plaza turns must not snap the torso when the walking path
      // changes direction around a curb or another commuter.
      const turn = angleBetween(headings[i], goal) * .28;
      headings[i] += Math.max(-.1, Math.min(.1, turn));
      gait[i] += (Math.min(1.15, pace / .04) - gait[i]) * .4;
      output[i].set([next[p].x, next[p].z, travelled[i], headings[i], gait[i]], step * ClipStride);
    }
    previous = base.map((p, i) => ({ ...p, ...next[i] }));
  }
  for (const [i, person] of commuters.entries()) {
    const partner = commuters.findIndex(p => p !== person && p.station!.walk === person.station!.walk);
    stationClips.set(person, [output[i], output[partner]]);
  }
}

export function pedestrianPose(person: CityPedestrian, time: number) {
  const raw = stationPose(person, time), baked = stationClips.get(person);
  if (!baked || !raw.stationTrip) return raw;
  const phase = ((time % StationHalfCycle) + StationHalfCycle) % StationHalfCycle;
  const cycle = ((Math.floor(time / StationHalfCycle) % 2) + 2) % 2;
  const clip = baked[cycle], frame = phase * PointRate;
  const a = Math.floor(frame) * ClipStride, b = (Math.floor(frame) + 1) * ClipStride;
  const value = (offset: number) => clip[a + offset] + (clip[b + offset] - clip[a + offset]) * (frame % 1);
  const x = value(0), z = value(1), weight = value(4);
  const stride = value(2) / (.017 + cityNoise(person.index + 540, person.seed) * .004) * Math.PI * 2;
  return { ...raw, x, z, heading: value(3), ...cityStationWalkSurface(person.station!.walk, { x, z }),
    walking: clip[b + 2] - clip[a + 2] > 1e-8, swing: Math.sin(stride) * .62 * weight,
    bob: Math.abs(Math.sin(stride)) * .00065 * weight,
    restingArm: (1 - Math.min(1, weight)) * (person.index % 7 === 0 ? .7 : .10) };
}
