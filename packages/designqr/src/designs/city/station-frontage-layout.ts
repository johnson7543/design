import type { CityBuilding } from './layout.ts';
import { roadMetres, type RoadPoint } from './road-network.ts';

/** Reference proportions within the existing, clipped station compound. */
export const SHIBUYA_POLICE_BOX = Object.freeze({ width: 9.2, height: 8.2, roofHeight: 7.35 });

/** The open concourse beside the police box, in the frontage's metre frame. */
export const SHIBUYA_STATION_PASSAGE = Object.freeze({
  center: 16.55, width: 12.7, front: .4, back: 6.8, floorHeight: .105,
  rearWall: 6.75, rearThickness: .18, hiddenDepth: 7.5,
});

/** Metres along the west frontage (north → south), then inward toward the tracks. */
export function cityStationFrontageFrame(building: CityBuilding) {
  const edges = building.footprint.rings[0].map((a, i, ring) => {
    const b = ring[(i + 1) % ring.length], length = Math.hypot(b.x - a.x, b.z - a.z);
    return { a, b, length, dx: (b.x - a.x) / length, dz: (b.z - a.z) / length };
  }).filter(f => f.dx - f.dz > .6).sort((a, b) => b.length - a.length);
  const front = edges[0], origin = front.b;
  const ux = -front.dx, uz = -front.dz, vx = -front.dz, vz = front.dx;
  return {
    point(u: number, depth: number): RoadPoint {
      return { x: origin.x + roadMetres(u * ux + depth * vx), z: origin.z + roadMetres(u * uz + depth * vz) };
    },
    local(p: RoadPoint) {
      const x = (p.x - origin.x) / roadMetres(1), z = (p.z - origin.z) / roadMetres(1);
      return { u: x * ux + z * uz, depth: x * vx + z * vz };
    },
  };
}

/** The two-storey police box must not turn into a station-height block. */
export function cityStationMassingHeight(building: CityBuilding, point: RoadPoint) {
  return cityStationFrontageFrame(building).local(point).u < SHIBUYA_POLICE_BOX.width
    ? roadMetres(SHIBUYA_POLICE_BOX.height) : building.height;
}
