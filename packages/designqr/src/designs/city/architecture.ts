import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from 'three';
import { cityNoise, type CityBuilding } from './layout.ts';
import { CITY_PAVEMENT_HEIGHT, citySurfaceContainsBounds, roadMetres, type RoadPoint } from './road-network.ts';
import { SHIBUYA_PALETTE as P, type ShibuyaPalette } from './palette.ts';
import type { CitySignDesign } from './sign-artwork.ts';
import type { CityTransitSign } from './transit-signs.ts';
import { buildCityStationFrontage, cityStationFrontagePanels } from './station-frontage.ts';
import { buildMarkCityPassage } from './mark-city-passage.ts';

export interface CityFacade {
  a: RoadPoint; b: RoadPoint; dx: number; dz: number; nx: number; nz: number; length: number;
}
export interface CityFacadePanel {
  id: string; path: readonly RoadPoint[]; y: number; height: number; width: number;
  design: number; hero?: boolean; label?: string; caption?: string; layout?: CitySignDesign['layout'];
  transit?: CityTransitSign; exit?: string; transparent?: boolean;
}
export interface CityArchitecturalModel { positions: number[]; swatches: string[]; glass?: CityArchitecturalModel }

/** Facades follow the source contour, including chamfers, returns and cut edges. */
export function cityBuildingFacades(building: CityBuilding): CityFacade[] {
  return building.footprint.rings[0].map((a, index, ring) => {
    const b = ring[(index + 1) % ring.length], length = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    return { a, b, dx, dz, nx: dz, nz: -dx, length };
  }).filter(f => f.length > 1e-7);
}

function frontageScore(f: CityFacade) {
  const x = (f.a.x + f.b.x) / 2, z = (f.a.z + f.b.z) / 2;
  const distance = Math.hypot(x, z);
  return -(f.nx * x + f.nz * z) / distance + Math.min(f.length, .15) - distance * .15;
}

export function cityBuildingFront(building: CityBuilding) {
  if (building.kind === 'station-front') {
    // The station compound faces Hachiko square to geographic west;
    // the shorter north return must not own the complete station name/roof ads.
    return cityBuildingFacades(building).filter(f => -(f.nx + f.nz) > .6)
      .sort((a, b) => b.length - a.length)[0];
  }
  return cityBuildingFacades(building).filter(f => f.length > roadMetres(4))
    .sort((a, b) => frontageScore(b) - frontageScore(a))[0]
    ?? cityBuildingFacades(building).sort((a, b) => b.length - a.length)[0];
}

const at = (f: CityFacade, t: number, offset = roadMetres(.12)): RoadPoint => ({
  x: f.a.x + (f.b.x - f.a.x) * t + f.nx * offset,
  z: f.a.z + (f.b.z - f.a.z) * t + f.nz * offset,
});

/** Original ads: identity and scale from the reference, never copied campaigns. */
export function cityBuildingPanels(b: CityBuilding): CityFacadePanel[] {
  if (b.kind === 'mark-city-passage') return [];
  if (b.kind === 'station-front') return cityStationFrontagePanels(b);
  const result: CityFacadePanel[] = [];
  const campaign = (salt: number) => Math.floor(cityNoise(salt, b.detailSeed) * 14);
  const front = cityBuildingFront(b);
  const panel = (id: string, f: CityFacade, t0: number, t1: number, y: number, h: number,
    design: number, extra: Partial<CityFacadePanel> = {}) => {
    if (f.length * (t1 - t0) < roadMetres(1.2)) return;
    // Reversed edge order gives an outward-facing +Z panel with upright, unmirrored UVs.
    const offset = roadMetres(.12);
    result.push({ id: `${b.id}-${id}`, path: [at(f, t1, offset), at(f, t0, offset)],
      width: f.length * (t1 - t0), y: CITY_PAVEMENT_HEIGHT + y, height: h, design, ...extra });
  };
  if (b.kind === 'qfront') {
    panel('vision', front, .08, .92, b.height * .67, b.height * .37, 0, { hero: true });
    panel('books', front, .05, .95, roadMetres(5.6), roadMetres(1.4), 10,
      { label: 'QFRONT / BOOKS', caption: 'CROSSING CULTURE', layout: 'lightbox' });
    panel('coffee', front, .10, .90, roadMetres(10.4), roadMetres(1.35), 6,
      { label: 'COFFEE', caption: 'OVER THE CROSSING', layout: 'lightbox' });
  } else if (b.kind === 'magnet') {
    panel('corner-poster', front, .12, .88, b.height * .61, b.height * .58, campaign(107),
      { label: 'MAGNET', caption: 'CULTURE / MUSIC', layout: 'screen' });
    panel('street-screen', front, .03, .97, roadMetres(7), roadMetres(3.7), campaign(113),
      { label: 'SHIBUYA', caption: 'CROSSING VISION', layout: 'screen' });
    const side = cityBuildingFacades(b).filter(f => (f.a.x !== front.a.x || f.a.z !== front.a.z) && f.length > roadMetres(9))
      .sort((a, c) => frontageScore(c) - frontageScore(a))[0];
    if (side) panel('side-poster', side, .21, .73, b.height * .62, b.height * .48, campaign(127),
      { label: 'MAGNET', caption: 'ART / FASHION / MUSIC' });
  } else if (b.kind === 'sign-block') {
    for (const [edge, f] of cityBuildingFacades(b).filter(f => f.length > roadMetres(6) && frontageScore(f) > .1).entries()) {
      const bays = Math.max(1, Math.floor(f.length / roadMetres(8)));
      for (let bay = 0; bay < bays; bay++) {
        const design = [3, 2, 8, 12, 5][(edge + bay + Math.floor(b.detailSeed * 5)) % 5];
        panel(`tenant-${edge}-${bay}`, f, (bay + .08) / bays, (bay + .92) / bays,
          b.height * .49, b.height * .58, design);
        panel(`crown-${edge}-${bay}`, f, (bay + .04) / bays, (bay + .96) / bays,
          b.height + roadMetres(3.0 + (bay % 2)), roadMetres(5), [9, 0, 7][bay % 3]);
      }
    }
  } else {
    panel('shop', front, .08, .92, b.height * .58, Math.min(roadMetres(11), b.height * .47), b.sign ?? 8);
    if (b.width * b.depth > .008) panel('street', front, .05, .95, roadMetres(3.8), roadMetres(1.3), 6,
      { label: b.kind === 'department-store' ? 'DEPARTMENT STORE' : 'SHIBUYA', caption: 'SHOP / CAFE', layout: 'lightbox' });
  }
  return result;
}

/** Triangle soup with BASE swatches. Both Three and Blender consume this model;
 * lighting is applied only after geometry generation, never to authored colors. */
export function buildCityArchitecturalModel(b: CityBuilding, palette: ShibuyaPalette = P): CityArchitecturalModel {
  if (b.kind === 'mark-city-passage') return buildMarkCityPassage(b, palette);
  if (b.kind === 'station-front') return buildCityStationFrontage(b);
  const P = palette;
  const positions: number[] = [], swatches: string[] = [];
  const face = (points: number[][], color: string) => {
    for (let i = 1; i < points.length - 1; i++) {
      positions.push(...points[0], ...points[i], ...points[i + 1]); swatches.push(color);
    }
  };
  const band = (f: CityFacade, t0: number, t1: number, low: number, high: number, color: string, offset = roadMetres(.035)) => {
    const a = at(f, t0, offset), c = at(f, t1, offset);
    face([[a.x, low, a.z], [a.x, high, a.z], [c.x, high, c.z], [c.x, low, c.z]], color);
  };
  const roof = (height: number, color: string) => {
    const flat = b.footprint.rings.flat();
    const rings = b.footprint.rings.map(r => r.map(p => new Vector2(p.x, p.z)));
    for (const [i, j, k] of ShapeUtils.triangulateShape(rings[0], rings.slice(1))) {
      const a = flat[i], c = flat[j], d = flat[k];
      face([[a.x, height, a.z], [d.x, height, d.z], [c.x, height, c.z]], color);
    }
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    if (!citySurfaceContainsBounds([b.footprint], { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 })) return;
    const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
      .map(([sx, sy, sz]) => [x + sx * w / 2, y + sy * h / 2, z + sz * d / 2]);
    for (const indices of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]]) face(indices.map(i => v[i]), color);
  };
  const facades = cityBuildingFacades(b), base = CITY_PAVEMENT_HEIGHT;
  const landmark = b.id === 'qfront' || b.id === 'magnet';
  const qfront = b.kind === 'qfront', signBlock = b.kind === 'sign-block';
  roof(base + b.height, P.roof);
  for (const [edge, f] of facades.entries()) {
    band(f, 0, 1, base, base + b.height, P[b.facade], 0);
    const floors = b.floors;
    const floorHeight = b.height / floors;
    const rhythm = cityNoise(edge * 43 + 19, b.detailSeed);
    const columns = Math.max(1, Math.floor(f.length / roadMetres(qfront ? 1.6 : 2.1 + rhythm * 1.8)));
    const inset = .08 + rhythm * .16;
    const sill = .16 + cityNoise(edge * 43 + 23, b.detailSeed) * .22;
    // Crossing-facing shopfronts.
    band(f, .025, .975, base + roadMetres(.5), base + Math.min(roadMetres(3.4), b.height * .65), P.windowLight);
    for (let floor = 0; floor < floors; floor++) {
      const y = base + floor * floorHeight;
      band(f, 0, 1, y + floorHeight - roadMetres(.22), y + floorHeight, qfront ? P.concrete : P.stone);
      for (let col = 0; col < columns; col++) {
        const noise = cityNoise(edge * 601 + col * 31 + floor * 7, b.detailSeed);
        const color = qfront ? (noise > .91 ? P.glassLight : noise > .70 ? P.sky : P.glass)
          : noise > .97 ? P.warmLight : noise > .77 ? P.windowLight : noise > .55 ? P.coolLight : P.glass;
        band(f, (col + (qfront ? .035 : inset)) / columns, (col + (qfront ? .965 : 1 - inset)) / columns,
          y + floorHeight * (qfront ? .04 : sill), y + floorHeight * (qfront ? .96 : .83), color, roadMetres(.05));
      }
    }
    if (qfront || signBlock) {
      const bays = columns;
      for (let col = 1; col < bays; col++) {
        const half = roadMetres(qfront ? .09 : .22) / f.length;
        band(f, col / bays - half, col / bays + half, base, base + b.height + (qfront ? roadMetres(.7) : 0), P.concrete, roadMetres(.09));
      }
    }
    // Flush cornice: unlike the former awning boxes, nothing projects metres into a street.
    band(f, 0, 1, base + b.height - roadMetres(.35), base + b.height + roadMetres(.35), P.concrete, roadMetres(.06));
    if (landmark) {
      band(f, .02, .98, base + b.height + roadMetres(.65), base + b.height + roadMetres(.75), P.concrete, 0);
      const posts = Math.max(1, Math.floor(f.length / roadMetres(2.5)));
      for (let i = 0; i <= posts; i++) {
        const half = roadMetres(.06) / f.length, t = .02 + .96 * i / posts;
        band(f, t - half, t + half, base + b.height, base + b.height + roadMetres(.7), P.concrete, 0);
      }
    }
  }
  {
    const pitch = roadMetres(4);
    for (let x = b.footprint.bounds.minX + pitch; x < b.footprint.bounds.maxX; x += pitch) {
      for (let z = b.footprint.bounds.minZ + pitch; z < b.footprint.bounds.maxZ; z += pitch) {
        if (cityNoise(Math.round(x * 160) + Math.round(z * 160) * 11, b.detailSeed) < .64) continue;
        box(x, base + b.height + roadMetres(.6), z, roadMetres(2), roadMetres(1.2), roadMetres(1.6), P.glassLight);
        if (landmark) for (let i = 0; i < 4; i++) box(x, base + b.height + roadMetres(1.22), z + roadMetres((i - 1.5) * .3),
          roadMetres(1.8), roadMetres(.07), roadMetres(.09), P.roof);
      }
    }
  }
  // Roof advertising has a real backing and supports when viewed from the station
  // side; only its outward face receives the runtime artwork texture.
  for (const panel of cityBuildingPanels(b)) {
    const low = panel.y - panel.height / 2, high = panel.y + panel.height / 2;
    if (low <= base + b.height) continue;
    const [a, c] = panel.path, anchor = cityPanelAnchor(panel);
    const nx = Math.sin(anchor.angle), nz = Math.cos(anchor.angle);
    const point = (t: number, y: number, depth: number) => [a.x + (c.x - a.x) * t - nx * depth,
      y, a.z + (c.z - a.z) * t - nz * depth];
    const frontDepth = roadMetres(.04), backDepth = roadMetres(.28);
    face([point(0, low, frontDepth), point(1, low, frontDepth), point(1, high, frontDepth), point(0, high, frontDepth)], P.roof);
    face([point(1, low, backDepth), point(0, low, backDepth), point(0, high, backDepth), point(1, high, backDepth)], P.stone);
    for (const t of [0, 1]) face([point(t, low, frontDepth), point(t, high, frontDepth), point(t, high, backDepth), point(t, low, backDepth)], P.roof);
    face([point(0, high, frontDepth), point(1, high, frontDepth), point(1, high, backDepth), point(0, high, backDepth)], P.glassLight);
    for (const t of [.2, .8]) {
      const half = roadMetres(.10) / panel.width;
      face([point(t - half, base + b.height, backDepth), point(t + half, base + b.height, backDepth),
        point(t + half, high, backDepth), point(t - half, high, backDepth)], P.roof);
      face([point(t + half, base + b.height, backDepth), point(t - half, base + b.height, backDepth),
        point(t - half, high, backDepth), point(t + half, high, backDepth)], P.roof);
    }
  }
  return { positions, swatches };
}

export function createCityArchitectureGeometry(buildings: readonly CityBuilding[]) {
  return architectureGeometry(buildings.map(b => buildCityArchitecturalModel(b)));
}

/** Rooftop equipment and rails share the contextual building generator. */
export function createCityRooftopGeometry(buildings: readonly CityBuilding[], palette: ShibuyaPalette = P) {
  return architectureGeometry(buildings.map(b => {
    const model = buildCityArchitecturalModel(b, palette);
    const positions: number[] = [], swatches: string[] = [];
    const roof = CITY_PAVEMENT_HEIGHT + b.height;
    for (let i = 0; i < model.swatches.length; i++) {
      const triangle = model.positions.slice(i * 9, i * 9 + 9);
      const ys = [triangle[1], triangle[4], triangle[7]];
      if (Math.min(...ys) < roof - 1e-7 || Math.max(...ys) <= roof + 1e-7) continue;
      positions.push(...triangle); swatches.push(model.swatches[i]);
    }
    return { positions, swatches };
  }));
}

export function createCityArchitectureGlassGeometry(buildings: readonly CityBuilding[]) {
  return architectureGeometry(buildings.map(b => buildCityArchitecturalModel(b).glass).filter((m): m is CityArchitecturalModel => !!m));
}

function architectureGeometry(models: readonly CityArchitecturalModel[]) {
  const positions: number[] = [], colors: number[] = [];
  const color = new Color(), a = new Vector3(), c = new Vector3(), d = new Vector3();
  for (const model of models) {
    positions.push(...model.positions);
    for (let i = 0; i < model.swatches.length; i++) {
      const offset = i * 9;
      a.fromArray(model.positions, offset); c.fromArray(model.positions, offset + 3); d.fromArray(model.positions, offset + 6);
      c.sub(a).cross(d.sub(a)).normalize();
      const shade = c.y > .5 ? 1 : c.x > .5 ? .65 : c.z > .5 ? .84 : .52;
      color.set(model.swatches[i]).multiplyScalar(shade);
      for (let v = 0; v < 3; v++) colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function cityFacadePanelGeometry(panel: CityFacadePanel) {
  const positions: number[] = [], uv: number[] = [];
  let distance = 0;
  for (let i = 1; i < panel.path.length; i++) {
    const a = panel.path[i - 1], b = panel.path[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    const u0 = distance / panel.width, u1 = (distance + length) / panel.width;
    const low = panel.y - panel.height / 2, high = panel.y + panel.height / 2;
    positions.push(a.x, low, a.z, b.x, low, b.z, b.x, high, b.z, a.x, low, a.z, b.x, high, b.z, a.x, high, a.z);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1); distance += length;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function cityPanelAnchor(panel: CityFacadePanel) {
  const a = panel.path[0], b = panel.path.at(-1)!;
  const angle = Math.atan2(-(b.z - a.z), b.x - a.x);
  return { x: (a.x + b.x) / 2 + Math.sin(angle) * roadMetres(.06),
    z: (a.z + b.z) / 2 + Math.cos(angle) * roadMetres(.06), y: panel.y, angle,
    width: panel.width * .86, height: panel.height * .72 };
}
