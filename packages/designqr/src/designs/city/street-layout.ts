import { SHIBUYA_CROSSWALKS, SHIBUYA_PAVEMENTS, SHIBUYA_ROAD_ARMS, SHIBUYA_SIGNAL_POSITIONS,
  citySurfaceContainsBounds, citySurveyPoint, roadMetres, type RoadPoint } from './road-network.ts';

/** Fixtures are photo-interpreted, in metres; the underlying survey is unchanged. */
export function cityStreetFrame(armId: string, distance: number) {
  const arm = SHIBUYA_ROAD_ARMS.find(a => a.id === armId)!;
  let remaining = distance, i = 1;
  for (; i < arm.points.length - 1; i++) {
    const length = Math.hypot(arm.points[i][0] - arm.points[i - 1][0], arm.points[i][1] - arm.points[i - 1][1]);
    if (remaining <= length) break;
    remaining -= length;
  }
  const a = arm.points[i - 1], b = arm.points[i];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const position = citySurveyPoint(a[0] + (b[0] - a[0]) * remaining / length, a[1] + (b[1] - a[1]) * remaining / length);
  const direction = citySurveyPoint((b[0] - a[0]) / length, (b[1] - a[1]) / length);
  const norm = Math.hypot(direction.x, direction.z);
  const forward = { x: direction.x / norm, z: direction.z / norm };
  return { position, forward, lateral: { x: -forward.z, z: forward.x } };
}

export function cityPavementFixtureFits(p: RoadPoint, radiusMetres: number) {
  const r = roadMetres(radiusMetres);
  return citySurfaceContainsBounds(SHIBUYA_PAVEMENTS, { minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r });
}

/** Follow the source curb; never put an upright or guardrail in the carriageway. */
function besideArm(armId: string, distance: number, side: number, radius = .25) {
  const frame = cityStreetFrame(armId, distance);
  for (let offset = 2; offset < 32; offset += .15) {
    const position = { x: frame.position.x + frame.lateral.x * roadMetres(offset * side),
      z: frame.position.z + frame.lateral.z * roadMetres(offset * side) };
    if (cityPavementFixtureFits(position, radius)) return { ...frame, position };
  }
  return undefined;
}

export const SHIBUYA_STREET_SIGNALS = Object.freeze(SHIBUYA_SIGNAL_POSITIONS.map((position, index) => {
  const crossing = SHIBUYA_CROSSWALKS[Math.floor(index / 2)], end = index % 2 === 1;
  const target = end ? crossing.start : crossing.end;
  const dx = target.x - position.x, dz = target.z - position.z, length = Math.hypot(dx, dz);
  const frame = crossing.id === 'scramble' ? undefined : cityStreetFrame(crossing.id, 0);
  // Each vehicle approach has a mast on BOTH curbs. Mirror the cantilever into
  // its own lane and face the opposing traffic directions, not the same sidewalk.
  // The diagonal scramble keeps pedestrian-only posts.
  const positions = SHIBUYA_SIGNAL_POSITIONS.slice(index - index % 2, index - index % 2 + 2);
  const lateralOffsets = frame && positions.map(p => (p.x - frame.position.x) * frame.lateral.x
    + (p.z - frame.position.z) * frame.lateral.z);
  const incomingCurb = lateralOffsets && (end ? lateralOffsets[1] > lateralOffsets[0] : lateralOffsets[0] >= lateralOffsets[1]);
  const side = incomingCurb ? 1 : -1;
  return { id: `${crossing.id}-${end ? 'end' : 'start'}`, crossing: crossing.id, position,
    pedestrianFacing: { x: dx / length, z: dz / length },
    vehicle: frame ? { curbSide: incomingCurb ? 'incoming' as const : 'outgoing' as const,
      facing: { x: frame.forward.x * side, z: frame.forward.z * side },
      armDirection: { x: -frame.lateral.x * side, z: -frame.lateral.z * side },
      movingApproach: crossing.id === 'jingu' || crossing.id === 'hachiko' } : undefined };
}));

const entranceLeft = besideArm('center-gai', 4.5, -1, .36);
const entranceRight = besideArm('center-gai', 4.5, 1, .36);
if (!entranceLeft || !entranceRight) throw new Error('Center-Gai entrance requires two clear surveyed pavement anchors.');
export const SHIBUYA_CENTER_GAI_ENTRANCE = Object.freeze({
  id: 'center-gai', heightMetres: 6.4, postRadiusMetres: .24, curlMetres: 1.55,
  // Paired curved main poles, not a torii or a permanent cross-street canopy.
  posts: [entranceLeft.position, entranceRight.position] as readonly RoadPoint[],
  facing: { x: -entranceLeft.forward.x, z: -entranceLeft.forward.z },
  clearWidthMetres: Math.hypot(entranceRight.position.x - entranceLeft.position.x,
    entranceRight.position.z - entranceLeft.position.z) / roadMetres(1) - .48,
});

export const SHIBUYA_STREET_LANTERNS = Object.freeze(SHIBUYA_ROAD_ARMS.filter(a => a.id !== 'center-gai').flatMap(arm =>
  [-1, 1].flatMap(side => { const p = besideArm(arm.id, 20, side); return p ? [p.position] : []; })));

export const SHIBUYA_GUARDRAILS = Object.freeze(SHIBUYA_ROAD_ARMS.filter(a => a.id !== 'center-gai').flatMap(arm =>
  [-1, 1].flatMap(side => [12, 15, 18, 21, 24, 27].flatMap(distance => {
    const a = besideArm(arm.id, distance, side, .16), b = besideArm(arm.id, distance + 2.7, side, .16);
    if (!a || !b || Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) > roadMetres(3.5)) return [];
    // Concave sidewalk corners must fit along the whole span, not only its posts.
    for (let t = 0; t <= 1; t += .1) {
      const p = { x: a.position.x + (b.position.x - a.position.x) * t, z: a.position.z + (b.position.z - a.position.z) * t };
      if (!cityPavementFixtureFits(p, .12) || SHIBUYA_CROSSWALKS.some(c => [c.start, c.end].some(q =>
        Math.hypot(p.x - q.x, p.z - q.z) < c.width * .62))) return [];
    }
    return [{ start: a.position, end: b.position }];
  }))));

const railClearance = roadMetres(.35);
const railBounds = SHIBUYA_GUARDRAILS.map(rail => ({ ...rail,
  minX: Math.min(rail.start.x, rail.end.x) - railClearance, maxX: Math.max(rail.start.x, rail.end.x) + railClearance,
  minZ: Math.min(rail.start.z, rail.end.z) - railClearance, maxZ: Math.max(rail.start.z, rail.end.z) + railClearance }));

export function isCityStreetApproachClear(x: number, z: number) {
  if (SHIBUYA_STREET_SIGNALS.some(s => Math.hypot(s.position.x - x, s.position.z - z) < roadMetres(.55))
    || SHIBUYA_CENTER_GAI_ENTRANCE.posts.some(p => Math.hypot(p.x - x, p.z - z) < roadMetres(.68))
    || SHIBUYA_STREET_LANTERNS.some(p => Math.hypot(p.x - x, p.z - z) < roadMetres(.45))) return false;
  return railBounds.every(({ start, end, minX, maxX, minZ, maxZ }) => {
    if (x < minX || x > maxX || z < minZ || z > maxZ) return true;
    const dx = end.x - start.x, dz = end.z - start.z;
    const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - start.x - t * dx, z - start.z - t * dz) >= railClearance;
  });
}
