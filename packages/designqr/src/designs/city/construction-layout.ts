import { citySurfaceDistance, citySurveyPoint, roadMetres, type RoadPolygon } from './road-network.ts';

/** Interpreted reference-era enclosure, leaving the Hachiko photo approach and
 * JR entry routes open. This is not a survey of today's temporary fencing. */
export const SHIBUYA_WORKSITE_POINTS = [[16, 66], [28, 51], [46.6, 52], [47, 58.5], [47.2, 61.5],
  [27, 80], [.3, 82.2], [1.9, 73]] as const;
const ring = SHIBUYA_WORKSITE_POINTS.map(([e, s]) => citySurveyPoint(e, s));
export const SHIBUYA_WORKSITE: RoadPolygon = {
  rings: [ring], bounds: { minX: Math.min(...ring.map(p => p.x)), maxX: Math.max(...ring.map(p => p.x)),
    minZ: Math.min(...ring.map(p => p.z)), maxZ: Math.max(...ring.map(p => p.z)) },
};
export const isCityWorksiteApproachClear = (x: number, z: number) =>
  citySurfaceDistance(x, z, [SHIBUYA_WORKSITE]) < -roadMetres(.65);
