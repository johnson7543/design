import { ExtrudeGeometry, ShapeUtils, Vector2, Vector3 } from 'three';
import type { CityArchitecturalModel, CityFacadePanel } from './architecture.ts';
import type { CityBuilding } from './layout.ts';
import { CITY_PAVEMENT_HEIGHT, roadMetres } from './road-network.ts';
import { SHIBUYA_PALETTE as P } from './palette.ts';
import { cityStationFrontageFrame, SHIBUYA_POLICE_BOX as POLICE, SHIBUYA_STATION_PASSAGE as PASSAGE } from './station-frontage-layout.ts';
import { CITY_STATION_NAME_LAYOUT, cityLetteringShapes, fitCityLettering } from './transit-lettering.ts';

type Point = [number, number, number];
type PlanPoint = { u: number; depth: number };
const BALCONY = { center: 5.55, radius: 2.78, segments: 20 };
const balconyDepth = (u: number) => .97 - 1.19 * Math.sqrt(Math.max(0, 1 - ((u - BALCONY.center) / BALCONY.radius) ** 2));

/** Factual station/police names and original advertisements share the source frame. */
export function cityStationFrontagePanels(b: CityBuilding): CityFacadePanel[] {
  const frame = cityStationFrontageFrame(b), panels: CityFacadePanel[] = [];
  const panel = (id: string, start: number, end: number, y: number, height: number, depth: number,
    extra: Partial<CityFacadePanel>, curved = false) => {
    const path = Array.from({ length: curved ? 17 : 2 }, (_, i) => {
      const u = start + (end - start) * i / (curved ? 16 : 1);
      return frame.point(u, curved ? balconyDepth(u) + depth : depth);
    });
    const width = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0);
    panels.push({ id: `${b.id}-${id}`, path, width, y: CITY_PAVEMENT_HEIGHT + roadMetres(y),
      height: roadMetres(height), design: 10, ...extra });
  };
  panel('police-koban', 4.45, 5.6, 7.89, .56, .184, { transit: 'police-koban' });
  panel('police-name', 3.25, 7.85, 3.04, .43, .595, { transit: 'police-name' });
  panel('police-english', 4.02, 7.28, 3.57, .21, -.025, { transit: 'police-english' }, true);
  panel('police-ticker', 3.28, 7.98, 5.08, .48, -.045, { transit: 'police-ticker' }, true);
  for (const u of [2.25, 8.53]) panel(`police-map-${u}`, u - .32, u + .32, 1.6, 1.18, .61, { transit: 'police-map' });
  panel('station-name', 10.0, 34.25, 9.65, 1.52, .355, { transit: 'station-facade', transparent: true });
  panel('station-entry-name', 11.0, 22.45, 3.20, .47, 1.66, { transit: 'station' });
  panel('station-street-ad', 24.15, 34.65, 2.16, 3.2, .435,
    { design: 4, label: 'CROSSING / CULTURE', caption: 'MUSIC / ART / TOKYO', layout: 'screen' });
  return panels;
}

/** Batched, three-dimensional police box and adjoining Hachiko entrance.
 * The source polygon owns the rear and the map cut; the reference owns the facade.
 * All coordinates below are metres in the same frame, never camera-relative. */
export function buildCityStationFrontage(b: CityBuilding): CityArchitecturalModel {
  const frame = cityStationFrontageFrame(b);
  const solid: CityArchitecturalModel = { positions: [], swatches: [] };
  const glass: CityArchitecturalModel = { positions: [], swatches: [] };
  const world = ([u, y, depth]: Point) => {
    const p = frame.point(u, depth); return [p.x, CITY_PAVEMENT_HEIGHT + roadMetres(y), p.z];
  };
  const face = (points: Point[], color: string, glazed = false) => {
    const model = glazed ? glass : solid, vertices = points.map(world);
    // Along-front/inward coordinates are left handed; reverse every triangle.
    for (let i = 1; i < vertices.length - 1; i++) {
      model.positions.push(...vertices[0], ...vertices[i + 1], ...vertices[i]); model.swatches.push(color);
    }
  };
  const box = (u: number, y: number, depth: number, width: number, height: number, thick: number, color: string) => {
    const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
      .map(([x, h, z]) => [u + x * width / 2, y + h * height / 2, depth + z * thick / 2] as Point);
    for (const indices of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]]) face(indices.map(i => corners[i]), color);
  };
  const beam = (a: Point, c: Point, radius: number, color: string, sides = 8, topRadius = radius) => {
    const start = new Vector3(...a), end = new Vector3(...c), axis = end.clone().sub(start).normalize();
    const tangent = new Vector3(0, 1, 0);
    if (Math.abs(axis.y) > .95) tangent.set(1, 0, 0);
    tangent.cross(axis).normalize(); const bitangent = axis.clone().cross(tangent).normalize();
    const ring = (center: Vector3, r: number) => Array.from({ length: sides }, (_, i) =>
      center.clone().addScaledVector(tangent, Math.cos(i / sides * Math.PI * 2) * r)
        .addScaledVector(bitangent, Math.sin(i / sides * Math.PI * 2) * r).toArray() as Point);
    const low = ring(start, radius), high = ring(end, topRadius);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides; face([low[i], low[j], high[j], high[i]], color);
    }
    face([...low].reverse(), color); face(high, color);
  };
  const clip = (ring: PlanPoint[], split: number, below: boolean) => {
    const output: PlanPoint[] = [];
    for (const [i, a] of ring.entries()) {
      const c = ring[(i + 1) % ring.length], ain = below ? a.u <= split : a.u >= split, cin = below ? c.u <= split : c.u >= split;
      if (ain) output.push(a);
      if (ain !== cin) {
        const t = (split - a.u) / (c.u - a.u); output.push({ u: split, depth: a.depth + (c.depth - a.depth) * t });
      }
    }
    return output;
  };
  const source = b.footprint.rings[0].map(frame.local);
  const prism = (ring: PlanPoint[], low: number, high: number, color: string, openFront = false) => {
    if (ShapeUtils.isClockWise(ring.map(p => new Vector2(p.u, p.depth)))) ring.reverse();
    const outline = ring.map(p => new Vector2(p.u, p.depth));
    for (const [i, j, k] of ShapeUtils.triangulateShape(outline, [])) face([ring[i], ring[k], ring[j]].map(p => [p.u, high, p.depth]), P.roof);
    for (const [i, a] of ring.entries()) {
      const c = ring[(i + 1) % ring.length];
      if (openFront && a.depth < .8 && c.depth < .8) continue;
      face([[a.u, low, a.depth], [a.u, high, a.depth], [c.u, high, c.depth], [c.u, low, c.depth]], color);
    }
  };
  const police = clip(source, POLICE.width, true), station = clip(source, POLICE.width, false);
  prism(police, 0, POLICE.roofHeight, P.concrete, true);
  prism(station, 4.2, b.height / roadMetres(1), P.glassLight, true);
  // Close the rear/map cut below the station concourse, never its west doorway.
  prism(station, 0, 4.19, P.roof, true);

  // Police box: panelled outer portal, deep upper room and rectangular openings.
  box(4.6, 5.37, 2.07, 8.3, 3.96, .78, P.concrete);
  box(4.6, 1.55, 4.5, 7.8, 3.1, .22, P.ink);
  for (const u of [.67, 8.81]) box(u, 3.76, .72, .77, 7.52, 1.05, P.concrete);
  box(4.74, 7.82, .72, 8.91, .76, 1.07, P.concrete);
  for (let y = .6; y < 7.55; y += .75) for (const u of [.67, 8.81]) box(u, y, .183, .77, .021, .018, P.roof);
  for (const u of [2.2, 4.4, 6.6]) box(u, 7.82, .176, .022, .74, .025, P.roof);
  box(1.89, 2.33, 1.15, 1.61, 4.3, .38, P.concrete);
  for (const [u, width] of [[1.8, 1.25], [4.23, 1.8], [6.65, 2.32]]) {
    box(u, 6.21, 1.59, width + .16, 1.9, .18, P.roof);
    box(u, 6.21, 1.482, width, 1.71, .035, P.glass);
    for (const x of [u - width / 2, u, u + width / 2]) box(x, 6.21, 1.45, .055, 1.8, .055, P.concrete);
    for (const y of [5.31, 7.11]) box(u, y, 1.45, width + .1, .065, .055, P.stone);
  }
  box(6.44, 5.90, 1.417, .42, .60, .024, P.paper);
  // Raised glass-block strips retain a visible mortar grid at close range.
  for (const [bottom, rows] of [[.20, 4], [3.78, 7]]) for (let x = 0; x < 5; x++) for (let y = 0; y < rows; y++) {
    box(1.29 + x * .245, bottom + y * .245, .935, .216, .216, .10, (x + y) % 4 ? P.glassLight : P.glass);
    box(1.29 + x * .245, bottom + y * .245, .878, .16, .16, .016, P.concrete);
  }
  beam([2.77, 0, 1.02], [2.77, 8.91, 1.02], .34, P.concrete, 20);
  for (const y of [3.37, 7.6, 8.81]) beam([2.77, y, 1.02], [2.77, y + .09, 1.02], .368, P.stone, 20);
  // Glazed ground doors, actual side returns and a raised threshold.
  box(5.53, .075, 1.18, 4.85, .15, 1.15, P.stone);
  box(5.53, 1.48, 1.42, 4.7, 2.69, .07, P.glassLight);
  for (const u of [3.18, 5.59, 6.76, 7.88]) box(u, 1.47, 1.35, .09, 2.67, .12, P.concrete);
  for (const y of [.20, .92, 2.77]) box(5.53, y, 1.34, 4.82, .075, .13, P.concrete);
  // The left window's blinds and right doors' handles are separate geometry.
  for (let y = 1.03; y < 2.6; y += .09) box(4.38, y, 1.364, 2.24, .023, .035, P.roof);
  for (const u of [6.63, 6.88]) beam([u, 1.13, 1.19], [u, 1.55, 1.19], .024, P.stone);
  box(5.55, 3.03, .74, 5.18, .62, .27, P.ink);
  for (const u of [3.01, 8.1]) {
    beam([u, .06, .72], [u, 3.43, .72], .30, P.concrete, 16);
    beam([u, 2.79, .72], [u, 2.96, .72], .305, P.coral, 16);
  }
  for (const u of [2.25, 8.53]) box(u, 1.6, .67, .73, 1.28, .10, P.concrete);

  // Elliptical metal balcony/canopy, frosted glass and a curved LED fascia.
  for (let i = 0; i < BALCONY.segments; i++) {
    const u0 = BALCONY.center - BALCONY.radius + 2 * BALCONY.radius * i / BALCONY.segments;
    const u1 = BALCONY.center - BALCONY.radius + 2 * BALCONY.radius * (i + 1) / BALCONY.segments;
    const d0 = balconyDepth(u0), d1 = balconyDepth(u1);
    face([[u0,3.35,d0],[u0,4.22,d0],[u1,4.22,d1],[u1,3.35,d1]], P.concrete);
    face([[u0,4.22,d0],[u0,4.22,1.76],[u1,4.22,1.76],[u1,4.22,d1]], P.stone);
    face([[u1,3.35,d1],[u1,3.35,1.76],[u0,3.35,1.76],[u0,3.35,d0]], P.roof);
    face([[u0,4.24,d0],[u0,5.36,d0],[u1,5.36,d1],[u1,4.24,d1]], P.glassLight, true);
    // Glass is two-sided so it remains visible when viewing the balcony from above.
    face([[u1,4.24,d1],[u1,5.36,d1],[u0,5.36,d0],[u0,4.24,d0]], P.glassLight, true);
    for (let y = 4.28; y < 5.35; y += .065) face([[u0,y,d0-.009],[u0,y+.013,d0-.009],
      [u1,y+.013,d1-.009],[u1,y,d1-.009]], P.glassLight);
    for (const y of [4.22, 5.36]) beam([u0,y,d0], [u1,y,d1], .026, P.concrete, 6);
    if (i % 4 === 0) beam([u0,3.37,d0-.018], [u0,5.36,d0-.018], .022, P.roof, 6);
    if (u0 >= 3.26 && u1 <= 8.10) face([[u0,4.80,d0-.03],[u0,5.36,d0-.03],
      [u1,5.36,d1-.03],[u1,4.80,d1-.03]], P.ink);
  }
  for (const u of [BALCONY.center - BALCONY.radius, BALCONY.center + BALCONY.radius]) {
    const depth = balconyDepth(u); box(u, 3.785, (depth + 1.76) / 2, .06, .87, 1.76 - depth, P.concrete);
    beam([u,4.22,depth], [u,5.36,depth], .028, P.concrete);
  }
  // Flag, service conduit, roof marker and protective cones from the references.
  beam([1.97,3.98,.48], [1.97,5.13,-.19], .026, P.concrete);
  face([[1.97,4.96,-.13],[2.55,4.61,-.13],[2.55,3.70,-.13],[1.97,4.05,-.13]], P.paper);
  face([[1.97,4.05,-.13],[2.55,3.70,-.13],[2.55,4.61,-.13],[1.97,4.96,-.13]], P.paper);
  const disk: Point[] = Array.from({ length: 20 }, (_, i) => [2.26 + .19 * Math.cos(i / 20 * Math.PI * 2),
    4.33 + .24 * Math.sin(i / 20 * Math.PI * 2), -.139]);
  face([...disk].reverse(), P.coral);
  for (const u of [2.18, 3.16, 8.1]) {
    box(u, .035, .03, .42, .07, .42, P.coral);
    beam([u,.07,.03], [u,.77,.03], .15, P.coral, 10, .026);
    beam([u,.40,.03], [u,.50,.03], .092, P.paper, 10, .074);
  }
  beam([7.72,5.52,1.25], [7.72,7.16,1.25], .023, P.roof);
  beam([3.32,7.19,1.24], [7.72,7.19,1.24], .024, P.roof);

  // JR's dark tiled frontage is taller and visually separate from the police box.
  box(22.22, 7.52, .74, 26.04, 6.56, .36, P.glassLight);
  for (let u = 9.25, col = 0; u < 35.2; u += 1.65, col++) for (let y = 4.25, row = 0; y < 10.75; y += 1.1, row++) {
    const end = Math.min(35.24, u + 1.61), high = Math.min(10.8, y + 1.06);
    face([[u,y,.546],[u,high,.546],[end,high,.546],[end,y,.546]], (col + row * 3) % 5 === 0 ? P.glass : P.glassLight);
    if ((col * 7 + row) % 4 === 0) face([[u,y,.538],[u,high,.538],[end,high-.26,.538]], P.glass);
  }
  // Freestanding metal letter bodies, with canvas faces sharing the exact outlines.
  // Their 18 cm returns remain visible at an oblique angle with baked face shading.
  for (const p of CITY_STATION_NAME_LAYOUT) {
    const fitted = fitCityLettering(p.key, p.x * 24.25, p.y * 1.52, p.width * 24.25, p.height * 1.52);
    const g = new ExtrudeGeometry(cityLetteringShapes(fitted.outline), { depth: .18, bevelEnabled: false, curveSegments: 4 });
    const vertices = g.getAttribute('position');
    for (let i = 0; i < vertices.count; i += 3) {
      const corners = [0, 1, 2].map(j => [10 + fitted.x + vertices.getX(i+j) * fitted.scale,
        9.65 + .76 - fitted.y - fitted.scale + vertices.getY(i+j) * fitted.scale,
        .36 + vertices.getZ(i+j)] as Point);
      face(corners, P.concrete);
    }
    g.dispose();
  }
  for (const u of [9.65, 23.60, 35.22]) box(u, 2.1, .83, .76, 4.2, .72, P.glassLight);
  // A true recessed passage: rear wall, soffit, beams, lit signs and inner pillars.
  box(PASSAGE.center, PASSAGE.floorHeight - .05, (PASSAGE.front + PASSAGE.back) / 2,
    PASSAGE.width, .10, PASSAGE.back - PASSAGE.front, P.stone);
  box(16.55, 3.79, 3.6, 12.7, .27, 6.4, P.roof);
  box(PASSAGE.center, 1.81, PASSAGE.rearWall, PASSAGE.width, 3.62, PASSAGE.rearThickness, P.ink);
  box(16.72, 3.2, 1.76, 11.68, .65, .19, P.transitStripe);
  for (const u of [11.1, 15.6, 20.2, 22.45]) {
    box(u, 1.62, 5.0, .25, 3.24, .40, P.concrete);
    box(u, 3.48, 3.33, .10, .06, 4.2, P.warmLight);
  }
  for (const u of [12.0, 16.0, 20.0]) {
    box(u, 2.82, 5.68, 2.55, .23, .04, P.warmLight);
    for (const x of [-.8, 0, .8]) box(u + x, 2.82, 5.644, .34, .10, .018, P.ink);
  }
  // Thin, projecting entrance canopy and the distinctive triangular suspension rods.
  box(16.65, 3.98, .55, 13.15, .15, 1.45, P.glassLight);
  box(16.65, 3.88, -.17, 13.15, .10, .08, P.roof);
  for (const u of [10.5, 13.5, 16.5, 19.5, 22.5]) {
    beam([u,4.56,.53], [u-.7,4.06,-.14], .019, P.concrete, 6);
    beam([u,4.56,.53], [u+.7,4.06,-.14], .019, P.concrete, 6);
  }
  // Short tactile guidance lies inside the entrance; the surveyed square stays open.
  for (const u of [13.0, 20.4]) for (const offset of [-.15, -.05, .05, .15]) box(u+offset, .12, 2.5, .045, .027, 4.0, P.warmLight);
  // The remaining southern frontage recedes to the existing diagonal map cut.
  const tail = clip(station, 35.6, false);
  prism(tail, 0, 10.8, P.glassLight);

  return { ...solid, glass };
}
