import { BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Mesh, MeshBasicMaterial, Vector3, type Matrix4 } from 'three';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { cityMorphActor } from './morph-sources.ts';
import type { DotonboriFragment } from './dotonbori-ownership.ts';

export const DOTONBORI_CLOTH_GROUP = 'dotonbori-breeze-cloth';
export const DOTONBORI_NOREN = 'dotonbori-storefront-noren';
export const DOTONBORI_PENNANT = 'dotonbori-boat-pennant';
export interface DotonboriClothPanel {
  id: string;
  kind: 'noren' | 'pennant';
  /** Top center for a noren flap; top of the hoist for the pennant. */
  anchor: Vector3;
  yaw: number;
  widthM: number;
  heightM: number;
  color: string;
  mark?: boolean;
  sourceBuilding?: string;
}

const ease = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
/** Illustrative light breeze, not measured Osaka wind. Every fitting shares
 * the same gust envelope, including four seconds of rest across the loop seam. */
export function dotonboriBreeze(time: number) {
  const t = ((time % 18) + 18) % 18;
  return ease(2, 5, t) * (1 - ease(13, 16, t)) * (.78 + .22 * Math.sin(time * .67));
}

/** Thin, two-sided cloth replaces the old solid inserts. Fixed seams never
 * move; free edges bend inside the existing fitting's clearance. One retained
 * position buffer per batch, with no texture or per-frame geometry allocation. */
export function createDotonboriCloth(panels: readonly DotonboriClothPanel[], size: number, retainedMaterial?: MeshBasicMaterial) {
  const coordinates: number[] = [], colors: number[] = [];
  const ranges: { building?: string; start: number; count: number }[] = [];
  const slices: { panel: DotonboriClothPanel; start: number; count: number; id: string; color: string }[] = [];
  const sheets = panels.map(panel => {
    const start = coordinates.length / 2;
    let hash = 2166136261;
    for (const character of panel.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    hash = Math.imul(hash ^ hash >>> 16, 2246822519); hash = Math.imul(hash ^ hash >>> 13, 3266489917); hash ^= hash >>> 16;
    const phase = (hash >>> 0) / 4294967296 * Math.PI * 2;
    const us = panel.mark ? [0, .5 - .04 / panel.widthM, .5 + .04 / panel.widthM, 1] : [0, .25, .5, .75, 1];
    const vs = [0, .2, .4, .6, .8, 1];
    // Horizontal strips follow hanging curtains; vertical strips follow the flag.
    const hanging = panel.kind === 'noren', strips = hanging ? vs.length - 1 : us.length - 1;
    for (let strip = 0; strip < strips; strip++) {
      const first = coordinates.length / 2, ink = new Color().setRGB(0, 0, 0);
      let area = 0;
      for (let cross = 0; cross < (hanging ? us.length - 1 : vs.length - 1); cross++) {
        const col = hanging ? cross : strip, row = hanging ? strip : cross;
        const u = us[col], right = us[col + 1], v = vs[row], bottom = vs[row + 1];
        // The old light marks are painted into the fabric, so no rigid overlay
        // remains floating in front when the flap bends.
        const color = new Color(panel.mark && row >= 1 && row < 4 && col === 1 ? P.light : panel.color)
          .multiplyScalar(.84 + .12 * Math.cos(((u + right) / 2 - .5) * Math.PI * 2));
        const weight = (right - u) * (bottom - v);
        ink.r += color.r * weight; ink.g += color.g * weight; ink.b += color.b * weight; area += weight;
        for (const [x, y] of [[u, v], [u, bottom], [right, v], [right, v], [u, bottom], [right, bottom]]) {
          coordinates.push(x, y); colors.push(color.r, color.g, color.b);
        }
      }
      slices.push({ panel, start: first, count: coordinates.length / 2 - first, id: `${panel.id}-${strip}`, color: `#${ink.multiplyScalar(1 / area).getHexString()}` });
    }
    const count = coordinates.length / 2 - start;
    ranges.push({ building: panel.sourceBuilding, start, count });
    return { panel, start, count, phase, cos: Math.cos(panel.yaw), sin: Math.sin(panel.yaw) };
  });
  const geometry = new BufferGeometry(), position = new Float32BufferAttribute(new Float32Array(coordinates.length / 2 * 3), 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.userData.buildingRanges = ranges;
  const material = retainedMaterial ?? new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide });
  material.forceSinglePass = true;
  const mesh = new Mesh(geometry, material);
  mesh.userData.evidence = 'Existing interpreted cloth fittings; authored gentle wind';
  let previousTime = NaN, previousBreeze = NaN;
  const update = (time: number) => {
    if (time === previousTime) return;
    previousTime = time;
    const breeze = dotonboriBreeze(time);
    if (breeze === 0 && previousBreeze === 0) return;
    previousBreeze = breeze;
    for (const { panel, start, count, phase, cos, sin } of sheets) for (let i = start; i < start + count; i++) {
      const u = coordinates[i * 2], v = coordinates[i * 2 + 1];
      let x: number, y: number, z: number;
      if (panel.kind === 'noren') {
        const free = v * v;
        x = (u - .5) * panel.widthM + .006 * breeze * free * Math.sin(time * 1.1 + phase);
        y = -v * panel.heightM + .006 * breeze ** 2 * free * v;
        z = .004 * Math.sin(u * Math.PI * 2) * v + breeze * free * (.065 + .024 * Math.sin(time * 2.1 - v * 2.2 + phase));
      } else {
        const free = u * u;
        x = u * panel.widthM - .007 * breeze ** 2 * free * u;
        y = -v * panel.heightM - .012 * free + .008 * breeze * free * Math.sin(time * 2.4 - u * 3 + phase);
        z = .006 * u * Math.sin(Math.PI * u + v * .8) + .05 * breeze * free * Math.sin(time * 4.2 - u * 5.3 + v * .9 + phase);
      }
      position.setXYZ(i, panel.anchor.x + (x * cos + z * sin) / size,
        panel.anchor.y + y / size, panel.anchor.z + (-x * sin + z * cos) / size);
    }
    position.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  };
  update(0);
  const snapshot = (parent?: Matrix4): DotonboriFragment[] => slices.map(slice => {
    const { panel } = slice, cos = Math.cos(panel.yaw), sin = Math.sin(panel.yaw);
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = slice.start; i < slice.start + slice.count; i++) {
      const dx = position.getX(i) - panel.anchor.x, y = position.getY(i), dz = position.getZ(i) - panel.anchor.z;
      const x = dx * cos - dz * sin, z = dx * sin + dz * cos;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
    const center = new Vector3(panel.anchor.x + x * cos + z * sin, (minY + maxY) / 2, panel.anchor.z - x * sin + z * cos);
    const dimensions = new Vector3(maxX - minX, maxY - minY, Math.max(.008 / size, maxZ - minZ));
    const fragment: DotonboriFragment = parent ? cityMorphActor(parent, slice.color, 'furniture', slice.id, center, dimensions)
      : { x: center.x, y: center.y, z: center.z, width: dimensions.x, height: dimensions.y, depth: dimensions.z, angle: 0,
        id: slice.id, color: slice.color, kind: 'furniture' };
    fragment.angle = (fragment.angle ?? 0) + panel.yaw;
    fragment.group = DOTONBORI_CLOTH_GROUP; fragment.sourceBuilding = panel.sourceBuilding;
    return fragment;
  });
  return { mesh, material, panels, update, snapshot };
}
