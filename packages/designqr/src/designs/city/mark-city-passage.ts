import { ShapeUtils, Vector2 } from 'three';
import type { CityArchitecturalModel } from './architecture.ts';
import type { CityBuilding } from './layout.ts';
import { CITY_PAVEMENT_HEIGHT, citySurfaceContainsBounds, roadMetres, type RoadPoint } from './road-network.ts';
import type { ShibuyaPalette } from './palette.ts';

/** Low glazed station connection: closed roof/floor, inset windows and an open
 * vehicle passage beneath. Geometry is shared by the city rendering paths. */
export function buildMarkCityPassage(b: CityBuilding, p: ShibuyaPalette): CityArchitecturalModel {
  const model: CityArchitecturalModel = { positions: [], swatches: [] };
  const ring = b.footprint.rings[0];
  const base = b.baseHeight!;
  const y = (height: number) => CITY_PAVEMENT_HEIGHT + height;
  const face = (points: number[][], color: string) => {
    for (let i = 1; i < points.length - 1; i++) {
      model.positions.push(...points[0], ...points[i], ...points[i + 1]);
      model.swatches.push(color);
    }
  };
  const vertex = (point: RoadPoint, height: number) => [point.x, y(height), point.z];
  const triangles = ShapeUtils.triangulateShape(ring.map(v => new Vector2(v.x, v.z)), []);
  // Floor soffit and roof have opposite winding and remain opaque from below.
  for (const [a, c, d] of triangles) {
    face([ring[a], ring[c], ring[d]].map(v => vertex(v, base)), p.roof);
    face([ring[a], ring[d], ring[c]].map(v => vertex(v, b.height)), p.concrete);
  }
  const clockwise = ShapeUtils.isClockWise(ring.map(v => new Vector2(v.x, v.z)));
  for (let edge = 0; edge < ring.length; edge++) {
    const a = ring[edge], c = ring[(edge + 1) % ring.length];
    const length = Math.hypot(c.x - a.x, c.z - a.z);
    const nx = (c.z - a.z) / length * (clockwise ? -1 : 1);
    const nz = -(c.x - a.x) / length * (clockwise ? -1 : 1);
    const point = (t: number, depth = 0) => ({ x: a.x + (c.x - a.x) * t - nx * depth,
      z: a.z + (c.z - a.z) * t - nz * depth });
    const band = (from: number, to: number, low: number, high: number, color: string, depth = 0) => {
      // Inset glazing also stops short of angled corners and the tile cut.
      const margin = Math.min(.4, 4 * depth / length);
      const left = point(Math.max(from, margin), depth), right = point(Math.min(to, 1 - margin), depth);
      const vertices = [vertex(left, low), vertex(left, high), vertex(right, high), vertex(right, low)];
      face(clockwise ? vertices.reverse() : vertices, color);
    };
    // The cropped section is a solid end cap, without invented window bays.
    const cut = Math.abs(a.x + roadMetres(77.6)) < 1e-6 && Math.abs(c.x + roadMetres(77.6)) < 1e-6;
    if (cut) {
      band(0, 1, base, b.height, p.concrete);
      continue;
    }
    band(0, 1, base, base + roadMetres(.15), p.stone);
    band(0, 1, base + roadMetres(.28), base + roadMetres(.85), p.stone);
    band(0, 1, base + roadMetres(.85), b.height - roadMetres(.65), p.glass, roadMetres(.06));
    band(0, 1, b.height - roadMetres(.65), b.height, p.stone);
    band(0, 1, base + roadMetres(.15), base + roadMetres(.28), p.concrete);
    const jamb = Math.min(.5, roadMetres(.30) / length);
    band(0, jamb, base + roadMetres(.85), b.height - roadMetres(.65), p.stone);
    band(1 - jamb, 1, base + roadMetres(.85), b.height - roadMetres(.65), p.stone);
    const bays = Math.max(1, Math.round(length / roadMetres(2.5)));
    for (let bay = 0; bay < bays; bay++) {
      const from = (bay + .08) / bays, to = (bay + .92) / bays;
      const low = base + roadMetres(1.12), high = b.height - roadMetres(.9);
      band(from, to, low, high, bay % 4 === 1 ? p.glassLight : p.glass, roadMetres(.035));
      band(from, to, high - roadMetres(.5), high, p.coolLight, roadMetres(.025));
      for (const height of [low + roadMetres(.95), high - roadMetres(.75)]) {
        band(from, to, height, height + roadMetres(.08), p.concrete);
      }
      const post = roadMetres(.20) / length;
      band(bay / bays, Math.min(1, bay / bays + post), base + roadMetres(.7), b.height - roadMetres(.25), p.stone);
      band((bay + .5) / bays, (bay + .5) / bays + roadMetres(.07) / length,
        low, high, p.concrete);
    }
  }
  // Three piers fit the retained station-side ground parcel. No supports are
  // placed in the roadway or transplanted inward from beyond the map boundary.
  const ground = b.groundEnvelope!;
  const points = ground.rings[0];
  const center = points.reduce((v, p) => ({ x: v.x + p.x / points.length, z: v.z + p.z / points.length }), { x: 0, z: 0 });
  const end = [...points].sort((a, c) => a.z - c.z);
  for (const t of [.2, .5, .8]) {
    const x = (end[0].x + (end.at(-1)!.x - end[0].x) * t + center.x) / 2;
    const z = (end[0].z + (end.at(-1)!.z - end[0].z) * t + center.z) / 2;
    const half = roadMetres(.48);
    if (!citySurfaceContainsBounds([ground], { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half })) continue;
    const corners = [[x - half, z - half], [x + half, z - half], [x + half, z + half], [x - half, z + half]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], c = corners[(i + 1) % 4];
      face([[a[0], y(0), a[1]], [a[0], y(base), a[1]], [c[0], y(base), c[1]], [c[0], y(0), c[1]]], p.concrete);
    }
  }
  return model;
}
