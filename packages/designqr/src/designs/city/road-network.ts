import { SHIBUYA_ROAD_DATA as DATA } from './road-data.ts';

export interface RoadPoint { x: number; z: number }
export interface RoadBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface RoadPolygon { rings: readonly (readonly RoadPoint[])[]; bounds: RoadBounds }

/** One metric conversion for every theme, QR size, and importing player. */
export const SHIBUYA_ROAD_METRES = DATA.provenance.tileMetres;
export const SHIBUYA_ROAD_PROVENANCE = DATA.provenance;
export const CITY_ROAD_HEIGHT = .006;
export const CITY_PAVEMENT_HEIGHT = CITY_ROAD_HEIGHT + .15 / SHIBUYA_ROAD_METRES;
export const CITY_VEHICLE_SCALE = 2.5 / (.023 * SHIBUYA_ROAD_METRES);
export const CITY_PERSON_SCALE = 1.75 / (.019 * SHIBUYA_ROAD_METRES);
export const roadMetres = (value: number) => value / SHIBUYA_ROAD_METRES;
const point = (p: readonly number[]): RoadPoint => ({ x: roadMetres(p[0]), z: roadMetres(p[1]) });
export function citySurveyPoint(east: number, south: number): RoadPoint {
  const angle = DATA.provenance.rotationDegrees * Math.PI / 180;
  return { x: roadMetres(east * Math.cos(angle) - south * Math.sin(angle)),
    z: roadMetres(east * Math.sin(angle) + south * Math.cos(angle)) };
}
function prepare(polygons: readonly (readonly (readonly (readonly number[])[])[])[]): readonly RoadPolygon[] {
  return Object.freeze(polygons.map(p => {
    const rings = p.map(r => r.map(point));
    return { rings, bounds: { minX: Math.min(...rings[0].map(p => p.x)), maxX: Math.max(...rings[0].map(p => p.x)),
      minZ: Math.min(...rings[0].map(p => p.z)), maxZ: Math.max(...rings[0].map(p => p.z)) } };
  }));
}
export const SHIBUYA_CARRIAGEWAYS = prepare(DATA.surfaceLayout.carriageways);
export const SHIBUYA_PAVEMENTS = prepare(DATA.surfaceLayout.sidewalks);
export const SHIBUYA_LAND = prepare(DATA.surfaceLayout.land);
export const SHIBUYA_ISLANDS = prepare(DATA.islands);
export const SHIBUYA_BUILDABLE_LAND = prepare(DATA.buildable);
export const SHIBUYA_ROAD_MARKINGS = Object.freeze(Object.entries(DATA.markings).map(([role, polygons]) => ({
  role: role as 'paper' | 'warmLight' | 'coral', polygons: prepare(polygons),
})));
export const SHIBUYA_PLOTS: readonly RoadBounds[] = Object.freeze(DATA.plots.map(p => ({
  minX: roadMetres(p[0]), minZ: roadMetres(p[1]), maxX: roadMetres(p[2]), maxZ: roadMetres(p[3]),
})));
export const SHIBUYA_CROSSWALKS = Object.freeze(DATA.surfaceLayout.crossings.map(c => {
  const start = point(c.start), end = point(c.end);
  return { id: c.id, start, end, x: (start.x + end.x) / 2, z: (start.z + end.z) / 2,
    length: Math.hypot(end.x - start.x, end.z - start.z), width: roadMetres(c.width),
    angle: -Math.atan2(end.z - start.z, end.x - start.x), paint: c.paint.map(point) };
}));

function segmentDistance(p: RoadPoint, a: RoadPoint, b: RoadPoint) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
function inRing(p: RoadPoint, ring: readonly RoadPoint[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export function cityPointInPolygon(p: RoadPoint, polygon: RoadPolygon) {
  const b = polygon.bounds;
  return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ
    && inRing(p, polygon.rings[0]) && !polygon.rings.slice(1).some(r => inRing(p, r));
}
export function citySurfaceDistance(x: number, z: number, polygons: readonly RoadPolygon[]) {
  const p = { x, z };
  let distance = Infinity, inside = false;
  for (const polygon of polygons) {
    inside ||= cityPointInPolygon(p, polygon);
    for (const ring of polygon.rings) for (let i = 0; i < ring.length; i++) {
      distance = Math.min(distance, segmentDistance(p, ring[i], ring[(i + 1) % ring.length]));
    }
  }
  return inside ? distance : -distance;
}
export const cityOnCarriageway = (x: number, z: number, clearance = 0) =>
  clearance > 0 ? citySurfaceDistance(x, z, SHIBUYA_CARRIAGEWAYS) >= clearance
    : SHIBUYA_CARRIAGEWAYS.some(p => cityPointInPolygon({ x, z }, p));

/** Test the entire rectangle, including a curved edge entering between corners. */
export function citySurfaceContainsBounds(polygons: readonly RoadPolygon[], bounds: RoadBounds) {
  const corners = [{ x: bounds.minX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.minZ },
    { x: bounds.maxX, z: bounds.maxZ }, { x: bounds.minX, z: bounds.maxZ }];
  const crosses = (a: RoadPoint, b: RoadPoint, c: RoadPoint, d: RoadPoint) => {
    const side = (p: RoadPoint, q: RoadPoint, r: RoadPoint) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  };
  return polygons.some(p => corners.every(c => cityPointInPolygon(c, p)) && p.rings.every(r => r.every((a, i) => {
    if (a.x > bounds.minX && a.x < bounds.maxX && a.z > bounds.minZ && a.z < bounds.maxZ) return false;
    return corners.every((c, j) => !crosses(a, r[(i + 1) % r.length], c, corners[(j + 1) % corners.length]));
  })));
}

export const SHIBUYA_SIGNAL_POSITIONS = Object.freeze(SHIBUYA_CROSSWALKS.flatMap(route =>
  ([false, true] as const).map(end => {
    const curb = end ? route.end : route.start, direction = end ? 1 : -1;
    const dx = Math.cos(route.angle), dz = -Math.sin(route.angle);
    for (const out of [1.5, 2.5, 3.5, 4.5]) for (const side of [.60, -.60, .45, -.45]) {
      const p = { x: curb.x + dx * direction * roadMetres(out) - dz * route.width * side,
        z: curb.z + dz * direction * roadMetres(out) + dx * route.width * side };
      if (citySurfaceContainsBounds(SHIBUYA_PAVEMENTS, { minX: p.x - .002, maxX: p.x + .002, minZ: p.z - .002, maxZ: p.z + .002 })) return p;
    }
    throw new Error(`No surveyed pavement for the ${route.id} signal.`);
  })));

/** Polygon overlap, including concave edges and holes. Bounds are a broad phase. */
export function cityPolygonsOverlap(a: RoadPolygon, b: RoadPolygon) {
  if (a.bounds.maxX <= b.bounds.minX || a.bounds.minX >= b.bounds.maxX
    || a.bounds.maxZ <= b.bounds.minZ || a.bounds.minZ >= b.bounds.maxZ) return false;
  if (a.rings.flat().some(p => cityPointInPolygon(p, b)) || b.rings.flat().some(p => cityPointInPolygon(p, a))) return true;
  const side = (p: RoadPoint, q: RoadPoint, r: RoadPoint) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return a.rings.some(ar => ar.some((p, i) => b.rings.some(br => br.some((r, j) => {
    const q = ar[(i + 1) % ar.length], s = br[(j + 1) % br.length];
    return side(p, q, r) * side(p, q, s) < -1e-18 && side(r, s, p) * side(r, s, q) < -1e-18;
  }))));
}

/** Reconstructed lane centre-lines in survey east/south metres (not lane-level survey). */
export const SHIBUYA_ROAD_ARMS = Object.freeze(DATA.arms);
export const SHIBUYA_VEHICLE_ROUTES = Object.freeze(DATA.surfaceLayout.vehicleRoutes.map(route => {
  const points = route.points.map(point), distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  return { points, distances, stopDistance: roadMetres(route.stopDistance) };
}));

/** Arc length controls queue spacing and wheel travel, independent of road heading. */
export function cityRoadPathPose(routeIndex: number, distance: number) {
  const { points, distances } = SHIBUYA_VEHICLE_ROUTES[routeIndex];
  let i = 1;
  while (i < distances.length - 1 && distances[i] < distance) i++;
  const a = points[i - 1], b = points[i], length = distances[i] - distances[i - 1];
  const t = (distance - distances[i - 1]) / length;
  const headingAt = (index: number) => {
    const before = points[Math.max(0, index - 1)], after = points[Math.min(points.length - 1, index + 1)];
    return Math.atan2(after.x - before.x, after.z - before.z);
  };
  const angle = headingAt(i - 1), nextAngle = headingAt(i);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
    heading: angle + Math.atan2(Math.sin(nextAngle - angle), Math.cos(nextAngle - angle)) * Math.max(0, Math.min(1, t)), distance };
}

export function cityVehiclePoint(pose: RoadPoint & { heading: number }, x: number, z: number) {
  const sin = Math.sin(pose.heading), cos = Math.cos(pose.heading);
  return { x: pose.x + (x * cos + z * sin) * CITY_VEHICLE_SCALE,
    z: pose.z + (-x * sin + z * cos) * CITY_VEHICLE_SCALE };
}

/** Station is on the geographic east side, not an unrelated foreground road. */
export const SHIBUYA_STATION = Object.freeze({ center: citySurveyPoint(67, 0), angle: Math.PI / 4,
  halfLength: (.49 - citySurveyPoint(67, 0).x) * Math.SQRT2, width: roadMetres(8),
  // Interpreted rail elevation, not a published survey height. Keep the entrance
  // low and the train behind it, rather than a 17 m-high floating viaduct.
  trackHeight: CITY_PAVEMENT_HEIGHT + roadMetres(7), carSpacing: roadMetres(20.8),
  trainScale: Object.freeze({ x: roadMetres(2.95) / .026, y: roadMetres(4.1) / .041, z: roadMetres(20) / .076 }) });
export function cityStationPoint(along: number, across = 0): RoadPoint {
  const { center, angle } = SHIBUYA_STATION;
  return { x: center.x + along * Math.cos(angle) + across * Math.sin(angle),
    z: center.z - along * Math.sin(angle) + across * Math.cos(angle) };
}
