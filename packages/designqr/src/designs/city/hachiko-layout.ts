import { cityPointInPolygon, citySurfaceDistance, citySurveyPoint, roadMetres, type RoadPolygon } from './road-network.ts';

const referencePoint = Object.freeze({ latitude: 35.6590439, longitude: 139.7005917, eastMetres: 3.8, southMetres: 50.6 });

/** Preserve the reference's curbside garden relationship on the fitted road.
 * Move the whole setting west; its station-facing approach stays open.
 * See docs/designqr-package/cities/shibuya/hachiko-square.md for the map anchor and photo dates. */
export const HACHIKO_SQUARE_OFFSET = Object.freeze({ eastMetres: -5.5, southMetres: 0 });
export const hachikoSquarePoint = (east: number, south: number) =>
  citySurveyPoint(east + HACHIKO_SQUARE_OFFSET.eastMetres, south + HACHIKO_SQUARE_OFFSET.southMetres);

export const HACHIKO_MONUMENT = Object.freeze({
  referencePoint,
  eastMetres: referencePoint.eastMetres + HACHIKO_SQUARE_OFFSET.eastMetres,
  southMetres: referencePoint.southMetres + HACHIKO_SQUARE_OFFSET.southMetres, bearingDegrees: 90,
  position: hachikoSquarePoint(referencePoint.eastMetres, referencePoint.southMetres),
  yaw: Math.atan2(citySurveyPoint(1, 0).x, citySurveyPoint(1, 0).z),
  pedestal: Object.freeze({ width: 1.14, depth: 1.78, height: 1.35, bronzeBaseHeight: .16 }),
});

function polygon(points: readonly (readonly number[])[], project = hachikoSquarePoint): RoadPolygon {
  const ring = points.map(([e, s]) => project(e, s));
  return { rings: [ring], bounds: { minX: Math.min(...ring.map(p => p.x)), maxX: Math.max(...ring.map(p => p.x)),
    minZ: Math.min(...ring.map(p => p.z)), maxZ: Math.max(...ring.map(p => p.z)) } };
}

/** Two planted seating pockets leave the monument's eastern photo approach open. */
export const HACHIKO_GARDEN_BEDS = Object.freeze([
  polygon([[3.1, 35.8], [7.5, 36.2], [9, 38.6], [8.5, 43.4], [6.1, 47.6], [1.3, 48.3], [-1.3, 46.2], [.6, 40.7]]),
  polygon([[-2.7, 52.7], [1.9, 52.5], [5.2, 54], [5.7, 57.8], [3.9, 61], [-3.6, 61.8], [-4.8, 58.5]]),
]);

export const HACHIKO_FORECOURT = polygon([[9.6, 33], [19, 32], [27, 36], [28, 55], [14, 61], [6.8, 61.5],
  [6.6, 55.2], [4.8, 52.7], [4.8, 48.9], [9.6, 44.5], [10, 39]]);

export const HACHIKO_TREES = Object.freeze([
  { east: 5.4, south: 38.8, height: 7.4, radius: 2.9, weeping: false },
  { east: 1.0, south: 46.4, height: 5.8, radius: 2.5, weeping: true },
  { east: .1, south: 58, height: 6.4, radius: 2.8, weeping: false },
].map(tree => Object.freeze({ ...tree, ...hachikoSquarePoint(tree.east, tree.south) })));

export const HACHIKO_BENCHES = Object.freeze([
  { from: [8.25, 39.2], to: [7.8, 43.3] },
  { from: [7.4, 44.2], to: [5.6, 47.1] },
  { from: [2.1, 53.0], to: [4.8, 54.5] },
  { from: [5.0, 55.1], to: [5.2, 57.6] },
]);

const { position: p, yaw, pedestal } = HACHIKO_MONUMENT;
export const HACHIKO_PEDESTAL_FOOTPRINT = (() => {
  const halfW = roadMetres(pedestal.width / 2 + .12), halfD = roadMetres(pedestal.depth / 2 + .12);
  const ring = [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]].map(([x, z]) => ({
    x: p.x + x * Math.cos(yaw) + z * Math.sin(yaw), z: p.z - x * Math.sin(yaw) + z * Math.cos(yaw),
  }));
  return { rings: [ring], bounds: { minX: Math.min(...ring.map(v => v.x)), maxX: Math.max(...ring.map(v => v.x)),
    minZ: Math.min(...ring.map(v => v.z)), maxZ: Math.max(...ring.map(v => v.z)) } };
})();

/** Photo-fitted pair along the station's crossing-facing curb, in survey metres. */
export const STATION_CURB_GARDENS = Object.freeze([
  // The short return sits at the east (station) end of the long curbside arm.
  [[29, 15.8], [39, 15.8], [39, 22], [36.5, 22], [36.5, 18.4], [29, 18.4]],
  [[21, 15], [25, 15], [25, 19], [21, 19]],
].map(points => Object.freeze({ points, footprint: polygon(points, citySurveyPoint) })));
export const STATION_CURB_TREES = Object.freeze([
  { east: 34, south: 17.1, height: 6.5, radius: 2.1 },
  { east: 23, south: 17, height: 10, radius: 2.4 },
].map(p => Object.freeze(p)));

export const HACHIKO_OBSTACLES = Object.freeze([...HACHIKO_GARDEN_BEDS, HACHIKO_PEDESTAL_FOOTPRINT,
  ...STATION_CURB_GARDENS.map(p => p.footprint)]);

export function isHachikoApproachClear(x: number, z: number, clearance = roadMetres(.55)) {
  return HACHIKO_OBSTACLES.every(polygon => !cityPointInPolygon({ x, z }, polygon)
    && citySurfaceDistance(x, z, [polygon]) < -clearance);
}
