import { BoxGeometry, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedMesh, Matrix4,
  Mesh, MeshBasicMaterial, Object3D, Plane, Vector3 } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { dotonboriBridgePoint, dotonboriChannel, dotonboriContains, dotonboriPoint, type DotonboriWaterfrontData } from './dotonbori-detail-layout.ts';
import type { DotonboriLayout } from './dotonbori-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { cityMorphActor } from './morph-sources.ts';
import type { CityMorphVoxel } from './morph.ts';
import { createDotonboriCloth, DOTONBORI_PENNANT } from './dotonbori-cloth.ts';
import { createDotonboriReactions, dotonboriVisitorReaction, DOTONBORI_REACTION_VISITORS } from './dotonbori-reactions.ts';
import { dotonboriActionBox } from './dotonbori-action-batch.ts';

const CLOTHES = [S.navy, S.ivory, S.blue, S.coral, S.highRise, S.charcoal, S.gold];
const wrap = (n: number, period: number) => ((n % period) + period) % period;
const random = (index: number, salt: number) => {
  let n = Math.imul(index + 113, 374761393) + Math.imul(salt, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
};

/** Independent stops with the same long-term travel rate on each shared path.
 * A fast walker cannot accumulate an extra lap through the people ahead. */
function visitorClock(index: number, time: number, meanSpeed: number) {
  const period = 25 + random(index, 1) * 19, duration = period - 4 - random(index, 2) * 7;
  const t = time + random(index, 3) * period, local = wrap(t, period), ramp = 1.4;
  const speed = meanSpeed * period / (duration - ramp);
  const travel = local < ramp ? local * local / (2 * ramp) : local < duration - ramp ? local - ramp / 2
    : local < duration ? duration - ramp - (duration - local) ** 2 / (2 * ramp) : duration - ramp;
  return { distance: speed * (Math.floor(t / period) * (duration - ramp) + travel),
    speed: speed * Math.max(0, Math.min(1, local / ramp, (duration - local) / ramp)) };
}

type VisitorTravel = { distance: number; pace: number };
// A two-way path on each narrow riverwalk; bridge visitors have destinations.
// Irregular gaps and separate stop clocks keep the crowd from marching in rows.
const walkingLoops = [
  { indices: Array.from({ length: 14 }, (_, i) => i + 16), half: 51, radius: .58, meanSpeed: .62, headway: 1.45 },
  { indices: Array.from({ length: 14 }, (_, i) => i + 30), half: 51, radius: .58, meanSpeed: .64, headway: 1.45 },
].map((loop, group) => {
  const length = loop.half * 4 + Math.PI * 2 * loop.radius;
  const weights = loop.indices.map(i => .25 + random(i, 7) ** 2 * 2.5), total = weights.reduce((a, b) => a + b, 0);
  let phase = random(group + 3, 9) * length;
  const phases = weights.map((w, i) => {
    const result = phase - visitorClock(loop.indices[i], 0, loop.meanSpeed).distance;
    phase += w / total * length; return result;
  });
  return { ...loop, length, phases };
});
const walkingRoutes = Array.from({ length: 44 }, (_, i) => {
  const loop = walkingLoops.find(loop => loop.indices.includes(i));
  return loop && { loop, slot: loop.indices.indexOf(i) };
});

/** Smooth circular following constraints, evaluated directly at scene time.
 * Each candidate is a leader's free position minus the intervening headways.
 * A soft minimum stays behind every leader and blends their speeds before
 * contact. It is continuous at loop seams and needs no frame-dependent history. */
function loopTravel(loop: typeof walkingLoops[number], time: number): VisitorTravel[] {
  const desired = loop.indices.map((index, i) => {
    const clock = visitorClock(index, time, loop.meanSpeed);
    return { distance: loop.phases[i] + clock.distance, speed: clock.speed };
  });
  return desired.map((_, slot) => {
    const limits = desired.map((p, leader) => p.distance + (leader < slot ? loop.length : 0)
      - ((leader - slot + desired.length) % desired.length) * loop.headway);
    const minimum = Math.min(...limits), weights = limits.map(limit => Math.exp((minimum - limit) / .28));
    const total = weights.reduce((a, b) => a + b, 0);
    const speed = weights.reduce((sum, weight, i) => sum + weight * desired[i].speed, 0) / total;
    return { distance: minimum - .28 * Math.log(total), pace: Math.min(1, speed / .95) };
  });
}

/** A continuous capsule loop: people turn at its ends without a visible reset. */
function capsule(distance: number, halfLength: number, radius: number) {
  const straight = halfLength * 2, arc = Math.PI * radius, cycle = 2 * (straight + arc);
  const t = wrap(distance, cycle);
  if (t < straight) return { along: t - halfLength, across: radius, tangentA: 1, tangentB: 0 };
  if (t < straight + arc) {
    const a = (t - straight) / radius;
    return { along: halfLength + Math.sin(a) * radius, across: Math.cos(a) * radius, tangentA: Math.cos(a), tangentB: -Math.sin(a) };
  }
  if (t < 2 * straight + arc) return { along: halfLength - (t - straight - arc), across: -radius, tangentA: -1, tangentB: 0 };
  const a = (t - 2 * straight - arc) / radius;
  return { along: -halfLength - Math.sin(a) * radius, across: -Math.cos(a) * radius, tangentA: -Math.cos(a), tangentB: Math.sin(a) };
}

type BridgeDestination = [across: number, along: number];
// Open journeys, not laps around the paving: eight crossers, four river viewers
// and four visitors making short moves near the approaches. Their swept paths
// reserve passing space and avoid the existing stationary viewing groups.
const bridgeJourneys = Array.from({ length: 16 }, (_, index) => {
  const x = (index - 3.5) * 1.2;
  const [start, end]: [BridgeDestination, BridgeDestination] = index < 8
    ? [[x + (random(index, 31) - .5) * .1, -11.5 - random(index, 32) * .5],
      [x + (random(index, 33) - .5) * .1, 11.4 + random(index, 34) * .6]]
    : ([
      [[-5.4, 9], [-5.6, 6.2]], [[-5.5, .8], [-7.9, 1.1]],
      [[5.5, -2], [7.7, -2.1]], [[5.4, 8.7], [5.6, 5.85]],
      [[-5.42, -8.8], [-5.5, -11.8]], [[-5.43, 10.6], [-5.38, 11.85]],
      [[5.44, -10.9], [5.41, -8]], [[5.4, 10.6], [5.44, 11.8]],
    ] satisfies [BridgeDestination, BridgeDestination][])[index - 8];
  const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
  const ramp = Math.min(1.5, length * .5), speed = .64 + random(index, 35) * .23;
  const outward = length / speed + ramp, returning = length / (speed * .88) + ramp;
  const holdStart = (index < 8 ? 8 : 19) + random(index, 36) * 19;
  const holdEnd = (index < 8 ? 10 : 22) + random(index, 37) * 22;
  return { start, end, dx, dy, length, ramp, outward, returning, holdStart, holdEnd,
    period: outward + returning + holdStart + holdEnd,
    bend: (random(index, 38) - .5) * .08, phase: random(index, 39) };
});
const ease = (t: number) => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); };
const turn = (from: number, to: number, amount: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * ease(amount);

/** Independent trips and destination holds, sampled from retained scene time.
 * People brake before looking around and turn in place before departing; there
 * is no semicircle, spawn/reset or frame-dependent steering at either end. */
function bridgeVisitor(index: number, time: number) {
  const trip = bridgeJourneys[index], { start, dx, dy, length, ramp, outward, returning, holdStart, holdEnd } = trip;
  const clock = time + trip.phase * trip.period, cycle = Math.floor(clock / trip.period), t = wrap(clock, trip.period);
  const back = t >= outward + holdEnd, movingTime = back ? t - outward - holdEnd : t;
  const duration = back ? returning : outward, hold = back ? holdStart : holdEnd;
  const local = Math.min(movingTime, duration), cruise = length / (duration - ramp);
  const traveled = cruise * (local < ramp ? local * local / (2 * ramp) : local < duration - ramp ? local - ramp / 2
    : duration - ramp - (duration - local) ** 2 / (2 * ramp));
  const speed = cruise * Math.max(0, Math.min(1, local / ramp, (duration - local) / ramp));
  const u = back ? 1 - traveled / length : traveled / length, curve = trip.bend * Math.sin(Math.PI * u);
  const tangent = trip.bend * Math.PI * Math.cos(Math.PI * u);
  const across = start[0] + dx * u + dy / length * curve, along = start[1] + dy * u - dx / length * curve;
  const forward = Math.atan2(dx + dy / length * tangent, dy - dx / length * tangent);
  let heading = forward + (back ? Math.PI : 0), headTurn = 0;
  if (movingTime >= duration) {
    const waited = movingTime - duration, look = Math.sign(across) * Math.PI / 2;
    heading = waited < 3 ? turn(heading, look, waited / 3)
      : turn(look, forward + (back ? 0 : Math.PI), (waited - hold + 3) / 3);
    headTurn = ease(Math.min(waited, hold - waited) / 3)
      * (.18 * Math.sin(time * .43 + index) + .10 * Math.sin(time * .17 + index * 2));
  }
  return { across, along, heading, headTurn, distance: cycle * length * 2 + (back ? length : 0) + traveled,
    pace: Math.min(1, speed / .95) };
}

export const DOTONBORI_PEDESTRIAN_COUNT = 64;
export function dotonboriPedestrianPose(data: DotonboriWaterfrontData, layout: DotonboriLayout, index: number, time: number) {
  const route = walkingRoutes[index];
  return pedestrianPose(data, layout, index, time, route && loopTravel(route.loop, time)[route.slot]);
}

/** Evaluate each traffic path once for a rendered frame. */
export function dotonboriPedestrianPoses(data: DotonboriWaterfrontData, layout: DotonboriLayout, time: number) {
  const clocks: VisitorTravel[] = [];
  for (const loop of walkingLoops) loopTravel(loop, time).forEach((clock, slot) => { clocks[loop.indices[slot]] = clock; });
  return Array.from({ length: DOTONBORI_PEDESTRIAN_COUNT }, (_, i) => pedestrianPose(data, layout, i, time, clocks[i]));
}

function pedestrianPose(data: DotonboriWaterfrontData, layout: DotonboriLayout, index: number, time: number, clock?: VisitorTravel) {
  let position: Vector3, ahead: Vector3, distance = 0, walking = true, pace = 0, headTurn = 0;
  let east: number | undefined, north: number | undefined;
  if (index < 16) {
    const p = bridgeVisitor(index, time);
    position = dotonboriBridgePoint(data, layout, p.across, p.along);
    ahead = dotonboriBridgePoint(data, layout, p.across + Math.sin(p.heading) * .1, p.along + Math.cos(p.heading) * .1);
    distance = p.distance; pace = p.pace; headTurn = p.headTurn; walking = pace > .04;
  } else if (index < 44) {
    const side = index < 30 ? -1 : 1;
    const { radius, half } = walkingRoutes[index]!.loop;
    distance = clock!.distance;
    const p = capsule(distance, half, radius);
    const offset = .03 * Math.sin(p.along * .19);
    // Turn before the sharply narrowing east bank bend; leave room for the
    // entire walking stride on the source-clipped promenade, not just its center.
    east = -2 + p.along;
    const section = dotonboriChannel(data, east);
    north = (side > 0 ? section.north : section.south) + side * 1.15 + p.across + offset;
    const next = dotonboriChannel(data, east + p.tangentA * .1);
    position = dotonboriPoint(east, north, data.levelsM.lowerWalk + .02, layout);
    ahead = dotonboriPoint(east + p.tangentA * .1, (side > 0 ? next.north : next.south) + side * 1.15 + p.across + offset
      + (p.tangentB + .03 * .19 * Math.cos(p.along * .19) * p.tangentA) * .1, data.levelsM.lowerWalk, layout);
    pace = clock!.pace; walking = pace > .04;
  } else if (index < 52) {
    walking = false;
    // Unequal pairs and solo visitors at the viewing edges, clear of through traffic.
    const [across, along, lookAcross, lookAlong] = [
      [-6.9, -1.8, -9, -2], [-6.2, -2.3, -7, -1.7], [-5.7, 4.7, -8, 5], [-6.5, 4.3, -8, 5],
      [7.1, .7, 9, .5], [6.6, 1.6, 7.1, .7], [5.6, -5.1, 8, -6], [6.5, -4.7, 8, -6],
    ][index - 44];
    position = dotonboriBridgePoint(data, layout, across, along);
    ahead = dotonboriBridgePoint(data, layout, lookAcross, lookAlong);
  } else {
    walking = false;
    const side = index < 58 ? -1 : 1, slot = (index - 52) % 6;
    east = (side < 0 ? [-41.7, -40.8, -19.4, -18.6, 32.2, 46.9] : [-32.8, -31.9, -12.4, 26.1, 27.0, 50.3])[slot];
    const section = dotonboriChannel(data, east);
    north = (side > 0 ? section.north : section.south) + side * (2.8 + random(index, 11) * 1.45);
    position = dotonboriPoint(east, north, data.levelsM.upperWalk + .02, layout);
    ahead = dotonboriPoint(east + .2, north - side, data.levelsM.upperWalk, layout);
  }
  const visible = east === undefined || dotonboriContains(index < 44 ? data.lowerWalk : data.upperWalk, east, north!);
  return { position, heading: Math.atan2(ahead.x - position.x, ahead.z - position.z), headTurn, distance, walking, pace,
    photographing: index >= 44 && index % 3 === 0, visible, east, north };
}

export function dotonboriBoatPose(data: DotonboriWaterfrontData, layout: DotonboriLayout, time: number) {
  const start = data.channelSectionsM[0][0] - data.boat.lengthOverallM;
  const end = data.channelSectionsM.at(-1)![0] + data.boat.lengthOverallM;
  const east = start + wrap(-26 - start + time * 1.35, end - start), section = dotonboriChannel(data, east);
  const north = (section.north + section.south) / 2, next = dotonboriChannel(data, east + .1);
  const slope = ((next.north + next.south) / 2 - north) / .1;
  return { east, north, position: dotonboriPoint(east, north, data.levelsM.water, layout),
    angle: layout.rotationYRadians + Math.atan(slope) };
}

function createBoat(data: DotonboriWaterfrontData, size: number) {
  const b = new DotonboriGeometry(size, 'dotonbori-doton-boat');
  const point = (x: number, y: number, z: number) => new Vector3(x / size, y / size, z / size);
  const half = data.boat.lengthOverallM / 2, beam = data.boat.beamM / 2;
  const stations = [[-half, 1.35], [-half + .35, beam], [4.8, beam], [6.4, 1.48], [7.5, .90], [half, 0]];
  const outline = [...stations, ...stations.slice(0, -1).reverse().map(([x, z]) => [x, -z])];
  const vertices: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], c = outline[(i + 1) % outline.length];
    const corners = [point(a[0] * .97, -.5, a[1] * .78), point(c[0] * .97, -.5, c[1] * .78), point(c[0], .4, c[1]), point(a[0], .4, a[1])];
    vertices.push(...[0, 1, 2, 0, 2, 3].flatMap(j => corners[j].toArray()));
    const top = new BufferGeometry();
    top.setAttribute('position', new Float32BufferAttribute([point(0, .4, 0), corners[3], corners[2]].flatMap(p => p.toArray()), 3));
    b.add(top, P.boat);
    b.beam(point(a[0], .30, a[1]), point(c[0], .30, c[1]), .09, P.dark);
  }
  const hull = new BufferGeometry(); hull.setAttribute('position', new Float32BufferAttribute(vertices, 3)); b.add(hull, P.boat);
  b.box(point(-.6, .43, 0), 11, .06, 3.22, P.light);
  for (const side of [-1, 1]) {
    b.box(point(-1.7, .82, side * 1.71), 11.2, .66, .10, P.boat);
    b.box(point(-1.6, .88, side * 1.775), 3, .90, .024, P.light);
    for (const y of [1.13, 1.43]) b.beam(point(-7.8, y, side * 1.73), point(4.7, y, side * 1.73), .045, P.boat);
    for (let x = -7.7; x <= 4.5; x += 1.15) b.beam(point(x, .5, side * 1.73), point(x, 1.45, side * 1.73), .045, P.boat);
    b.box(point(-6.8, .91, side * .94), 1.1, .96, 1.22, P.boat);
    b.box(point(-7.28, .91, side * .94), .10, .7, 1.05, S.coral);
  }
  b.box(point(-8.08, .86, 0), .12, .85, 2.7, P.boat);
  const letters: Record<string, number[][][]> = {
    D: [[[0, 0], [0, 1], [.65, 1], [1, .75], [1, .25], [.65, 0], [0, 0]]],
    O: [[[.2, 0], [0, .2], [0, .8], [.2, 1], [.8, 1], [1, .8], [1, .2], [.8, 0], [.2, 0]]],
    T: [[[0, 1], [1, 1]], [[.5, 1], [.5, 0]]],
    N: [[[0, 0], [0, 1], [1, 0], [1, 1]]],
  };
  for (const [i, letter] of [...'DOTON'].entries()) for (const stroke of letters[letter]) for (let j = 1; j < stroke.length; j++) {
    const a = stroke[j - 1], c = stroke[j];
    b.beam(point(-8.15, .77 + a[1] * .34, 1.02 - (i * .43 + a[0] * .29)),
      point(-8.15, .77 + c[1] * .34, 1.02 - (i * .43 + c[0] * .29)), .036, P.dark);
  }
  // Ten paired benches with a center aisle; original low-poly seats, fittings
  // and passenger poses interpreted from the operator's plan and photographs.
  for (let row = 0; row < 10; row++) for (const side of [-1, 1]) {
    const x = -5.4 + row * .86;
    b.box(point(x, .84, side * .95), .43, .12, 1.25, P.stone);
    b.box(point(x - .22, 1.10, side * .95), .09, .52, 1.25, P.stone);
    b.box(point(x, .63, side * .95), .08, .4, .9, P.metal, 0, false);
    if ((row + (side > 0 ? 1 : 0)) % 3 === 0) continue;
    for (const offset of [-.32, .30]) {
      // This same passenger is rebuilt once as an articulated, seated visitor.
      if (row === 4 && side === 1 && offset > 0) continue;
      const z = side * .95 + offset;
      const color = CLOTHES[(row * 3 + (side > 0 ? 1 : 0) + (offset > 0 ? 2 : 0)) % CLOTHES.length];
      b.box(point(x, 1.19, z), .30, .53, .34, color, 0, false);
      b.box(point(x + .04, 1.61, z), .23, .27, .24, S.ivory, 0, false);
      b.box(point(x + .015, 1.735, z), .245, .09, .25, S.charcoal, 0, false);
      b.box(point(x + .29, .69, z), .14, .42, .28, P.dark, 0, false);
    }
  }
  b.box(point(4.5, .93, -.45), 1.7, 1.03, 2.1, P.boat);
  b.box(point(5.42, 1.3, -.45), .13, .55, 2.1, P.glass);
  b.box(point(3.42, 1.03, -1.14), .40, .65, .5, P.dark);
  b.box(point(3.42, 1.52, -1.14), .25, .28, .26, P.light);
  b.beam(point(6.45, .42, 0), point(6.45, 2.45, 0), .045, P.metal);
  // Morph the live boat as longitudinal pieces, including its open passenger deck.
  for (let i = 0; i < 12; i++) {
    const x = -7.5 + i * 1.28;
    b.fragments.push({ x: x / size, y: .4 / size, z: 0, width: 1.28 / size, height: .8 / size,
      depth: (x > 6 ? 1.8 : 3.4) / size, color: P.boat, kind: 'vehicle', group: 'dotonbori-doton-boat' });
    if (x < 4 && x > -6) for (const side of [-1, 1]) b.fragments.push({ x: x / size, y: 1.1 / size, z: side / size,
      width: .6 / size, height: 1.1 / size, depth: 1 / size, color: P.stone, kind: 'vehicle', group: 'dotonbori-doton-boat' });
  }
  return { geometry: b.finish(), fragments: b.fragments };
}

/** A private clock and private GPU batches for each player. Pauses and a QR
 * turn never advance this clock. The same evaluated poses supply morph tiles. */
export class DotonboriActivity {
  readonly root = new Group();
  readonly material: MeshBasicMaterial;
  readonly people: InstancedMesh;
  readonly boat: Mesh;
  readonly pennant: ReturnType<typeof createDotonboriCloth>;
  readonly reactions: ReturnType<typeof createDotonboriReactions>;
  private readonly boatFragments: CityMorphVoxel[];
  private readonly localPlanes = [new Plane(new Vector3(1, 0, 0), .5), new Plane(new Vector3(-1, 0, 0), .5),
    new Plane(new Vector3(0, 0, 1), .5), new Plane(new Vector3(0, 0, -1), .5)];
  private readonly planes = this.localPlanes.map(p => p.clone());
  private readonly dummy = new Object3D();
  private readonly parent = new Matrix4();
  private readonly colors: string[] = [];
  private readonly headings: number[] = [];
  private time = NaN;
  private readonly library: DotonboriLibrary;

  constructor(library: DotonboriLibrary) {
    this.library = library;
    this.root.name = 'dotonbori-activity';
    this.material = new MeshBasicMaterial({ vertexColors: true, transparent: true, clippingPlanes: this.planes });
    const boat = createBoat(library.waterfront, library.layout.tileSizeM);
    this.boat = new Mesh(boat.geometry, this.material); this.boat.name = 'dotonbori-doton-tour-boat';
    this.boatFragments = boat.fragments.filter(f => f.kind === 'vehicle');
    const size = library.layout.tileSizeM;
    this.pennant = createDotonboriCloth([{ id: DOTONBORI_PENNANT, kind: 'pennant',
      anchor: new Vector3(6.45, 2.36, .0225).divideScalar(size), yaw: -Math.PI / 2,
      widthM: .38, heightM: .24, color: P.light }], size);
    this.pennant.mesh.name = DOTONBORI_PENNANT;
    this.pennant.material.clippingPlanes = this.planes;
    this.boat.add(this.pennant.mesh);
    this.reactions = createDotonboriReactions(this.material, size);
    this.boat.add(this.reactions.boatMesh); this.root.add(this.reactions.mesh);
    this.root.add(this.boat);
    const geometry = new BoxGeometry(1, 1, 1), normal = geometry.getAttribute('normal');
    const colors = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const shade = normal.getY(i) > .5 ? 1 : normal.getX(i) > .5 ? .76 : .66;
      colors.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.people = new InstancedMesh(geometry, this.material, DOTONBORI_PEDESTRIAN_COUNT * 8);
    this.people.name = 'dotonbori-pedestrians'; this.people.frustumCulled = false;
    this.people.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < DOTONBORI_PEDESTRIAN_COUNT; i++) {
      const shirt = CLOTHES[i % CLOTHES.length];
      const parts = [shirt, S.ivory, S.charcoal, S.navy, S.navy, shirt, shirt, i % 3 ? S.charcoal : S.coral];
      parts.forEach((color, part) => { this.people.setColorAt(i * 8 + part, new Color(color)); this.colors.push(color); });
    }
    this.root.add(this.people); this.update(0);
  }

  update(time: number) {
    if (time === this.time) return;
    this.time = time;
    const { layout, waterfront } = this.library, size = layout.tileSizeM;
    const boat = dotonboriBoatPose(waterfront, layout, time);
    this.boat.position.copy(boat.position); this.boat.rotation.y = boat.angle; this.boat.updateMatrix();
    this.pennant.update(time);
    const poses = dotonboriPedestrianPoses(waterfront, layout, time);
    for (let i = 0; i < DOTONBORI_PEDESTRIAN_COUNT; i++) {
      const pose = poses[i];
      const personScale = (.91 + random(i, 21) * .20) / size;
      const reactive = (DOTONBORI_REACTION_VISITORS as readonly number[]).includes(i);
      const boatDistance = Math.hypot(pose.position.x - boat.position.x, pose.position.z - boat.position.z) * size;
      const reaction = dotonboriVisitorReaction(i, time, boatDistance);
      const boatHeading = Math.atan2(boat.position.x - pose.position.x, boat.position.z - pose.position.z);
      const turn = Math.atan2(Math.sin(boatHeading - pose.heading), Math.cos(boatHeading - pose.heading));
      const heading = pose.heading + Math.max(-.95, Math.min(.95, turn)) * reaction.look;
      this.headings[i] = heading; this.parent.makeRotationY(heading).setPosition(pose.position);
      const swing = Math.sin(pose.distance * Math.PI * 2 / 1.30 + random(i, 22)) * .40 * pose.pace;
      const hip = .77 * Math.cos(swing) + .035;
      const part = (slot: number, x: number, y: number, z: number, w: number, h: number, d: number, tilt = 0) => {
        this.dummy.position.set(x * personScale, y * personScale, z * personScale);
        this.dummy.rotation.set(tilt, slot === 1 || slot === 2 ? pose.headTurn : 0, 0);
        this.dummy.scale.set(w, h, d).multiplyScalar(pose.visible ? personScale : 0);
        this.dummy.updateMatrix(); this.dummy.matrix.premultiply(this.parent);
        this.people.setMatrixAt(i * 8 + slot, this.dummy.matrix);
      };
      part(0, 0, hip + .29, 0, .42, .56, .25);
      part(1, 0, hip + .74, 0, .25, .29, .25);
      part(2, 0, hip + .88, -.025, .27, .095, .26);
      for (const [side, slot] of [[-1, 3], [1, 4]]) {
        const angle = side * swing;
        part(slot, side * .125, hip - .38 * Math.cos(angle), -.38 * Math.sin(angle), .15, .77, .17, angle);
        part(slot + 2, side * .265, hip + (pose.photographing ? .58 : .27), pose.photographing ? .19 : .22 * Math.sin(angle), .12, .53, .14, pose.photographing ? -1.2 : -angle);
      }
      part(7, .03, hip + .30, -.18, .30, .36, .12);
      if (reactive) {
        part(5, 0, 0, 0, 0, 0, 0); part(6, 0, 0, 0, 0, 0, 0);
        this.parent.scale(new Vector3(personScale, personScale, personScale));
        this.reactions.updateVisitor(i, this.parent, hip, time, reaction);
      }
    }
    const bridge = dotonboriBridgePoint(waterfront, layout, 0, 0);
    this.reactions.updateBoat(time, Math.hypot(bridge.x - boat.position.x, bridge.z - boat.position.z) * size);
    this.people.instanceMatrix.needsUpdate = true;
  }

  setPresentation(opacity: number, cityMatrix: Matrix4) {
    this.material.opacity = opacity;
    this.pennant.material.opacity = opacity;
    this.planes.forEach((plane, i) => plane.copy(this.localPlanes[i]).applyMatrix4(cityMatrix));
  }

  snapshot(): CityMorphVoxel[] {
    const result: CityMorphVoxel[] = [], matrix = new Matrix4();
    // Include only portions visible inside the tile, matching the material clip.
    const retain = (f: CityMorphVoxel) => {
      if (Math.abs(f.x) + Math.hypot(f.width, f.depth) / 2 <= .5 && Math.abs(f.z) + Math.hypot(f.width, f.depth) / 2 <= .5) result.push(f);
    };
    for (let i = 0; i < DOTONBORI_PEDESTRIAN_COUNT; i++) for (const slot of (DOTONBORI_REACTION_VISITORS as readonly number[]).includes(i) ? [0, 1, 2, 3, 4, 7] : [0, 1]) {
      this.people.getMatrixAt(i * 8 + slot, matrix);
      const yaw = slot === 1 ? Math.atan2(matrix.elements[8], matrix.elements[10]) : this.headings[i];
      const f = dotonboriActionBox(matrix, this.colors[i * 8 + slot], `dotonbori-person-${i}-${slot}`, `dotonbori-person-${i}`, yaw);
      f.kind = 'people';
      f.group = `dotonbori-person-${i}`; if (f.height > 0) retain(f);
    }
    for (const fragment of this.boatFragments) {
      const f = cityMorphActor(this.boat.matrix, fragment.color, 'vehicle', `dotonbori-doton-${result.length}`,
        new Vector3(fragment.x, fragment.y, fragment.z), new Vector3(fragment.width, fragment.height, fragment.depth));
      f.group = 'dotonbori-doton-boat'; retain(f);
    }
    this.pennant.snapshot(this.boat.matrix).forEach(retain);
    this.reactions.snapshot(this.boat.matrix).forEach(retain);
    return result;
  }
}
