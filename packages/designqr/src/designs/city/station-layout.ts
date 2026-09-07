import { citySurveyPoint, roadMetres, type RoadPoint, type RoadPolygon } from './road-network.ts';

/** Photo/map interpretation in survey east/south metres. These are not surveyed
 * entrance footprints: the supplied aerial was registered against four zebras
 * (about 0.5 m fit residual), then checked against the immutable road polygons. */
export const SHIBUYA_SUBWAY_ENTRANCES = Object.freeze([
  { id: 'A6a', east: -31.8, south: -18.3, bearing: 270, width: 3.8, length: 7.6, height: 2.85 },
  { id: 'A6b', east: -7.75, south: -22.25, bearing: 90, width: 3.8, length: 7.6, height: 2.85 },
  // A 0.57 m setback from the registered image centre keeps the existing signal
  // outside the entry's tactile landing; within the reference's map uncertainty.
  { id: 'A7a', east: 19.7, south: -9.9, bearing: 225, width: 3.6, length: 7.2, height: 2.85 },
].map(spec => {
  const angle = spec.bearing * Math.PI / 180;
  const direction = citySurveyPoint(Math.sin(angle), Math.cos(angle));
  return Object.freeze({ ...spec, position: citySurveyPoint(spec.east, spec.south),
    facing: { x: direction.x / roadMetres(1), z: direction.z / roadMetres(1) } });
}));
export type ShibuyaSubwayEntrance = typeof SHIBUYA_SUBWAY_ENTRANCES[number];

/** Local X spans the doorway; positive depth points out of the stair mouth. */
export function citySubwayPoint(e: ShibuyaSubwayEntrance, x: number, depth: number): RoadPoint {
  return { x: e.position.x + roadMetres(e.facing.z * x + e.facing.x * depth),
    z: e.position.z + roadMetres(-e.facing.x * x + e.facing.z * depth) };
}

export function citySubwayFootprint(e: ShibuyaSubwayEntrance, margin = 0): RoadPolygon {
  const w = e.width / 2 + margin, d = e.length / 2 + margin;
  const ring = [[-w, -d], [w, -d], [w, d], [-w, d]].map(([x, z]) => citySubwayPoint(e, x, z));
  return { rings: [ring], bounds: { minX: Math.min(...ring.map(p => p.x)), maxX: Math.max(...ring.map(p => p.x)),
    minZ: Math.min(...ring.map(p => p.z)), maxZ: Math.max(...ring.map(p => p.z)) } };
}

/** Actual openings are cut through pavement AND the miniature's plinth top. */
export const SHIBUYA_STAIR_WELLS = Object.freeze(SHIBUYA_SUBWAY_ENTRANCES.map(e => {
  const w = e.width / 2 - .32;
  return [[-w, -e.length / 2 + .55], [w, -e.length / 2 + .55],
    [w, e.length / 2 - .18], [-w, e.length / 2 - .18]].map(([x, z]) => citySubwayPoint(e, x, z));
}));

export function isCitySubwayApproachClear(x: number, z: number, margin = .95) {
  return SHIBUYA_SUBWAY_ENTRANCES.every(e => {
    const dx = (x - e.position.x) / roadMetres(1), dz = (z - e.position.z) / roadMetres(1);
    const lateral = dx * e.facing.z - dz * e.facing.x, depth = dx * e.facing.x + dz * e.facing.z;
    return Math.abs(lateral) > e.width / 2 + margin
      || depth < -e.length / 2 - margin || depth > e.length / 2 + 1.2 + margin;
  });
}

/** A fan of walking lanes can straddle a stair corner even when its two ends
 * are clear. Clip the complete span against each expanded, rotated pavilion. */
export function isCitySubwaySpanClear(a: RoadPoint, b: RoadPoint, margin: number) {
  return SHIBUYA_SUBWAY_ENTRANCES.every(e => {
    const local = (p: RoadPoint) => {
      const dx = (p.x - e.position.x) / roadMetres(1), dz = (p.z - e.position.z) / roadMetres(1);
      return [dx * e.facing.z - dz * e.facing.x, dx * e.facing.x + dz * e.facing.z];
    };
    const start = local(a), end = local(b);
    const bounds = [[-e.width / 2 - margin, e.width / 2 + margin],
      [-e.length / 2 - margin, e.length / 2 + 1.2 + margin]];
    let near = 0, far = 1;
    for (let axis = 0; axis < 2; axis++) {
      const delta = end[axis] - start[axis], [min, max] = bounds[axis];
      if (Math.abs(delta) < 1e-10) { if (start[axis] < min || start[axis] > max) return true; }
      else {
        const t0 = (min - start[axis]) / delta, t1 = (max - start[axis]) / delta;
        near = Math.max(near, Math.min(t0, t1)); far = Math.min(far, Math.max(t0, t1));
        if (near > far) return true;
      }
    }
    return false;
  });
}

/** Local railway coordinates, measured from the existing rail centre. The road
 * underpass is the station-east arm, south of MAGNET. Keep piers off that road. */
export const SHIBUYA_RAIL_BRIDGE = Object.freeze({ startMetres: -16.5, endMetres: 1.5,
  fasciaHeightMetres: 1.65, soffitHeightMetres: 5.55 });
