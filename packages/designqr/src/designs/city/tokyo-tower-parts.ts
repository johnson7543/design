import { TOKYO_TOWER_BLENDER_DATA as model } from './tokyo-tower-blender-data.ts';
import { TOKYO_TOWER_PALETTE } from './tokyo-tower-palette.ts';

export type TowerAssembly = 'legs' | 'lattice' | 'main-deck' | 'top-deck' | 'antenna' | 'access' | 'base';
export type TowerPoint = readonly [number, number, number];
export type TowerRGB = readonly [number, number, number];
export interface TowerPart {
  id: string; assembly: TowerAssembly; center: TowerPoint;
  corners: readonly TowerPoint[]; surfaces: readonly (readonly [number, number, number, number])[];
  color: string; luminous: boolean; cornerLight: readonly TowerRGB[]; ground: boolean;
}
export interface TowerFace {
  id: string; part: TowerPart; corners: readonly [TowerPoint, TowerPoint, TowerPoint, TowerPoint];
  colors: readonly [TowerRGB, TowerRGB, TowerRGB, TowerRGB];
  sourceId: string; sourceUV: readonly [number, number, number, number];
}
export const TOKYO_TOWER_METRES = model.tileMetres;
const GROUND_PARTS = new Set(['island', 'forecourt', 'lit-forecourt-surface', 'entry-walk']);

/** Evaluated Blender geometry, including every concealed face. There is no
 * parallel procedural approximation or runtime mesh download. Each instance
 * gets its own semantic paint and source inventory. */
export function createTokyoTowerParts(): TowerPart[] {
  const units = model.unitsPerMetre * model.tileMetres;
  return model.parts.map(([id, assembly, role, luminous, vertices, indices, baked]) => {
    const corners: TowerPoint[] = [], surfaces: [number, number, number, number][] = [];
    const cornerLight: TowerRGB[] = [];
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i += 3) {
      const point: TowerPoint = [vertices[i] / units, vertices[i + 1] / units, vertices[i + 2] / units];
      corners.push(point);
      point.forEach((n, axis) => { low[axis] = Math.min(low[axis], n); high[axis] = Math.max(high[axis], n); });
    }
    for (let i = 0; i < indices.length; i += 4) surfaces.push([indices[i], indices[i + 1], indices[i + 2], indices[i + 3]]);
    for (let i = 0; i < baked.length; i += 3) cornerLight.push([
      baked[i] / model.lighting.colorUnits, baked[i + 1] / model.lighting.colorUnits, baked[i + 2] / model.lighting.colorUnits,
    ]);
    return { id, assembly: model.assemblies[assembly] as TowerAssembly,
      center: low.map((n, axis) => (n + high[axis]) / 2) as unknown as TowerPoint,
      corners, surfaces, cornerLight, color: TOKYO_TOWER_PALETTE[model.roles[role] as keyof typeof TOKYO_TOWER_PALETTE], luminous,
      ground: GROUND_PARTS.has(id) || id.startsWith('paving-joint-') };
  });
}

/** Preserve every exported surface. Broad paving gets fixed, two-dimensional
 * subdivisions so it can become QR paper without stretching into long ribbons.
 * This tessellation is independent of QR content, including during edits. */
export function towerFaces(parts: readonly TowerPart[]): TowerFace[] {
  return parts.flatMap(part => part.surfaces.flatMap((indices, index) => {
    const corners = indices.map(i => part.corners[i]) as unknown as TowerFace['corners'];
    const colors = part.cornerLight.slice(index * 4, index * 4 + 4) as unknown as TowerFace['colors'];
    const sourceId = `${part.id}/face-${index}`;
    const source: TowerFace = { id: sourceId, sourceId, sourceUV: [0, 0, 1, 1], part, corners, colors };
    if (!part.ground) return [source];
    const length = (a: number, b: number) => Math.hypot(...corners[a].map((n, axis) => n - corners[b][axis]));
    const nu = Math.max(1, Math.ceil(Math.max(length(0, 1), length(3, 2)) * 24));
    const nv = Math.max(1, Math.ceil(Math.max(length(0, 3), length(1, 2)) * 24));
    const faces: TowerFace[] = [];
    for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
      const uv = [[u / nu, v / nv], [(u + 1) / nu, v / nv], [(u + 1) / nu, (v + 1) / nv], [u / nu, (v + 1) / nv]];
      faces.push({ ...source, id: `${sourceId}/tile-${u}-${v}`, sourceUV: [u / nu, v / nv, (u + 1) / nu, (v + 1) / nv],
        corners: uv.map(([x, y]) => interpolate(corners, x, y)) as unknown as TowerFace['corners'],
        colors: uv.map(([x, y]) => interpolate(colors, x, y)) as unknown as TowerFace['colors'] });
    }
    return faces;
  }));
}

/** A new QR cut must retain the same baked irradiance at its source position. */
export function towerSourceColor(face: TowerFace, u: number, v: number): TowerRGB {
  return interpolate(face.colors, u, v);
}

function interpolate(corners: readonly TowerPoint[], u: number, v: number): TowerPoint {
  return [0, 1, 2].map(axis => {
    const top = corners[0][axis] * (1 - u) + corners[1][axis] * u;
    const bottom = corners[3][axis] * (1 - u) + corners[2][axis] * u;
    return top * (1 - v) + bottom * v;
  }) as unknown as TowerPoint;
}
