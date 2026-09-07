import { BufferGeometry, Color, Float32BufferAttribute, MeshBasicMaterial, ShapeUtils, Vector2 } from 'three';
import { SHIBUYA_PALETTE as P } from './palette.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_ROAD_HEIGHT, SHIBUYA_CARRIAGEWAYS, SHIBUYA_LAND,
  SHIBUYA_ROAD_MARKINGS, cityPointInPolygon, type RoadPoint, type RoadPolygon } from './road-network.ts';
import { SHIBUYA_STAIR_WELLS } from './station-layout.ts';

function withStairWells(polygon: RoadPolygon) {
  return [...polygon.rings, ...SHIBUYA_STAIR_WELLS.filter(ring => ring.every(p => cityPointInPolygon(p, polygon)))];
}

/** Map-derived pavement, road markings and crossing geometry. */
export function createShibuyaRoadGeometry() {
  const positions: number[] = [], colors: number[] = [], morningWeights: number[] = [];
  const color = new Color();
  const triangle = (a: RoadPoint, ay: number, b: RoadPoint, by: number, c: RoadPoint, cy: number, morning = false) => {
    positions.push(a.x, ay, a.z, b.x, by, b.z, c.x, cy, c.z);
    for (let i = 0; i < 3; i++) {
      colors.push(color.r, color.g, color.b);
      morningWeights.push(Number(morning));
    }
  };
  const surface = (polygons: readonly RoadPolygon[], height: number, ink: string, stairs = false, morning = false) => {
    color.set(ink);
    for (const polygon of polygons) {
      const contours = stairs ? withStairWells(polygon) : polygon.rings;
      const points = contours.flat();
      const rings = contours.map(r => r.map(p => new Vector2(p.x, p.z)));
      for (const [ai, bi, ci] of ShapeUtils.triangulateShape(rings[0], rings.slice(1))) {
        const a = points[ai], b = points[bi], c = points[ci];
        // XZ, unlike XY, reverses the normal; all ground faces point up.
        if ((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x) > 0) triangle(a, height, c, height, b, height, morning);
        else triangle(a, height, b, height, c, height, morning);
      }
    }
  };
  surface(SHIBUYA_CARRIAGEWAYS, CITY_ROAD_HEIGHT, P.asphalt, false, true);
  for (const { role, polygons } of SHIBUYA_ROAD_MARKINGS) {
    if (role === 'warmLight') continue;
    surface(polygons, CITY_ROAD_HEIGHT + (role === 'paper' ? .00016 : .00008),
      role === 'paper' ? P.roadPaint : P.roadAccent);
  }
  const carriagewayCount = positions.length / 3;
  surface(SHIBUYA_LAND, CITY_PAVEMENT_HEIGHT, P.pavement, true);
  // Extrude the shared land boundaries, including the east pavement extension
  // and all survey holes, so the rendered curbs match occupancy queries.
  color.set(P.stone);
  for (const polygon of SHIBUYA_LAND) for (const ring of polygon.rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      triangle(a, CITY_ROAD_HEIGHT, b, CITY_ROAD_HEIGHT, a, CITY_PAVEMENT_HEIGHT);
      triangle(b, CITY_ROAD_HEIGHT, b, CITY_PAVEMENT_HEIGHT, a, CITY_PAVEMENT_HEIGHT);
      // The two sides avoid depending on polygon winding at survey holes.
      triangle(b, CITY_ROAD_HEIGHT, a, CITY_ROAD_HEIGHT, a, CITY_PAVEMENT_HEIGHT);
      triangle(b, CITY_PAVEMENT_HEIGHT, b, CITY_ROAD_HEIGHT, a, CITY_PAVEMENT_HEIGHT);
    }
  }
  for (const { role, polygons } of SHIBUYA_ROAD_MARKINGS) {
    if (role === 'warmLight') surface(polygons, CITY_PAVEMENT_HEIGHT + .00008, P.roadEdge);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('cityMorning', new Float32BufferAttribute(morningWeights, 1));
  // Offset only the carriageway and its paint. Low garden/pavement details keep
  // their existing depth relationship with the unoffset sidewalk material.
  geometry.addGroup(0, carriagewayCount, 0);
  geometry.addGroup(carriagewayCount, positions.length / 3 - carriagewayCount, 1);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** Evaluate the reflection per pixel: coincident survey polygons then agree,
 * regardless of triangulation, instead of exposing interpolation/z-fighting stripes. */
export function createShibuyaRoadMaterial() {
  // The plinth top sits just below this surface. Reserve depth-buffer separation
  // so its unlit asphalt cannot interfere with the reflected-light layer.
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  material.onBeforeCompile = shader => {
    shader.uniforms.cityMorningLight = { value: new Color(P.asphaltLight) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute float cityMorning;
varying float vCityMorning;
varying vec2 vCityRoadPosition;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vCityMorning = cityMorning;
vCityRoadPosition = position.xz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 cityMorningLight;
varying float vCityMorning;
varying vec2 vCityRoadPosition;`).replace('#include <color_fragment>', `#include <color_fragment>
float morningReflection = exp(-dot(vCityRoadPosition, vCityRoadPosition) / (0.17 * 0.17));
diffuseColor.rgb = mix(diffuseColor.rgb, cityMorningLight, morningReflection * vCityMorning);`);
  };
  material.customProgramCacheKey = () => 'designqr-city-morning-road-v1';
  return material;
}

/** Cut the underlying top too; an uncut box would fill the descending stairs
 * immediately below the 15 cm curb. The board sides and bottom stay closed. */
export function createShibuyaPlinthGeometry() {
  const positions: number[] = [], colors: number[] = [], color = new Color();
  const face = (points: number[][], ink: string) => {
    color.set(ink);
    for (let i = 1; i < points.length - 1; i++) {
      positions.push(...points[0], ...points[i], ...points[i + 1]);
      for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b);
    }
  };
  const outer = [{ x: -.5, z: -.5 }, { x: .5, z: -.5 }, { x: .5, z: .5 }, { x: -.5, z: .5 }];
  const rings = [outer, ...SHIBUYA_STAIR_WELLS], points = rings.flat();
  for (const indices of ShapeUtils.triangulateShape(rings[0].map(p => new Vector2(p.x, p.z)),
    rings.slice(1).map(r => r.map(p => new Vector2(p.x, p.z))))) {
    const [a, b, c] = indices.map(i => points[i]);
    const triangle = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x) > 0 ? [a, c, b] : [a, b, c];
    face(triangle.map(p => [p.x, CITY_ROAD_HEIGHT - .00004, p.z]), P.asphalt);
  }
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    face([[a.x, -.046, a.z], [a.x, CITY_ROAD_HEIGHT - .00004, a.z],
      [b.x, CITY_ROAD_HEIGHT - .00004, b.z], [b.x, -.046, b.z]], P.ink);
  }
  face(outer.map(p => [p.x, -.046, p.z]), P.ink);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
