import type { CityMorphTarget } from './morph-sources.ts';
import { cityEase } from './morph.ts';
import type { TowerFace, TowerPoint } from './tokyo-tower-parts.ts';

export interface TowerPatch {
  face: TowerFace; cell: number; sourceStart: number; sourceEnd: number;
  targetStart: number; targetEnd: number;
}

/** The paving becomes all QR paper; tower and context become the dark modules.
 * Ground uses surface area and face positions, so a broad island cannot collapse
 * into the few strips allotted to its low polygon count or shared part center.
 * Integer interval transport preserves every source face and tiles every cell. */
export function mapTokyoTower(faces: readonly TowerFace[], targets: readonly CityMorphTarget[]): TowerPatch[] {
  const groups = [faces.filter(f => f.part.assembly !== 'base'),
    faces.filter(f => f.part.assembly === 'base' && !f.part.ground), faces.filter(f => f.part.ground)];
  const cells: number[][] = [[], [], []];
  const angle = (x: number, z: number) => Math.atan2(z, x);
  const byTarget = (a: number, b: number) => angle(targets[a].x, targets[a].z) - angle(targets[b].x, targets[b].z)
    || Math.hypot(targets[a].x, targets[a].z) - Math.hypot(targets[b].x, targets[b].z);
  const dark: number[] = [];
  targets.forEach((target, cell) => {
    // Only context may end beneath the largest supported logo footprint.
    const logo = Math.abs(target.x) < .1 + 1 / Math.sqrt(targets.length) && Math.abs(target.z) < .1 + 1 / Math.sqrt(targets.length);
    if (target.light) cells[2].push(cell);
    else if (logo) cells[1].push(cell);
    else dark.push(cell);
  });
  const contextShare = groups[1].length / (groups[0].length + groups[1].length);
  dark.sort(byTarget).forEach((cell, i) => {
    cells[Math.floor((i + 1) * contextShare) > Math.floor(i * contextShare) ? 1 : 0].push(cell);
  });
  const result: TowerPatch[] = [];
  for (let group = 0; group < groups.length; group++) {
    const sources = groups[group].map(face => ({ face, center: group === 2 ? towerSourcePoint(face, .5, .5) : face.part.center,
      weight: group === 2 ? Math.max(1, Math.round(faceArea(face) * 1e9)) : 1 }))
      .sort((a, b) => angle(a.center[0], a.center[2]) - angle(b.center[0], b.center[2])
        || Math.hypot(a.center[0], a.center[2]) - Math.hypot(b.center[0], b.center[2])
        || a.center[1] - b.center[1] || a.face.id.localeCompare(b.face.id));
    const destinations = cells[group].sort(byTarget);
    if (!sources.length || !destinations.length) throw new Error('Tokyo Tower requires structural and ground sources and QR destinations.');
    const total = sources.reduce((sum, source) => sum + source.weight, 0), nt = destinations.length;
    let si = 0, ti = 0, boundary = 0, sourceBoundary = 0;
    while (si < sources.length && ti < nt) {
      const sourceEnd = sourceBoundary + sources[si].weight * nt, targetEnd = (ti + 1) * total;
      const end = Math.min(sourceEnd, targetEnd);
      result.push({ face: sources[si].face, cell: destinations[ti], sourceStart: (boundary - sourceBoundary) / (sources[si].weight * nt),
        sourceEnd: (end - sourceBoundary) / (sources[si].weight * nt), targetStart: (boundary - ti * total) / total, targetEnd: (end - ti * total) / total });
      boundary = end;
      if (end === sourceEnd) { si++; sourceBoundary = sourceEnd; }
      if (end === targetEnd) ti++;
    }
  }
  return result;
}

function faceArea(face: TowerFace): number {
  const [a, b, c, d] = face.corners;
  const triangle = (p: TowerPoint, q: TowerPoint, r: TowerPoint) => {
    const u = q.map((n, i) => n - p[i]), v = r.map((n, i) => n - p[i]);
    return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  };
  return triangle(a, b, c) + triangle(a, c, d);
}

export function towerSourcePoint(face: TowerFace, u: number, v: number): TowerPoint {
  return [0, 1, 2].map(axis => {
    const top = face.corners[0][axis] * (1 - u) + face.corners[1][axis] * u;
    const bottom = face.corners[3][axis] * (1 - u) + face.corners[2][axis] * u;
    return top * (1 - v) + bottom * v;
  }) as unknown as TowerPoint;
}

export function towerTargetPoint(patch: TowerPatch, target: CityMorphTarget, grid: number, u: number, v: number): TowerPoint {
  const x = patch.targetStart + (patch.targetEnd - patch.targetStart) * u;
  return [target.x + (x - .5) / grid, .001, target.z + (v - .5) / grid];
}

/** CPU equivalent of the shader, used for edit retargeting and geometry tests. */
export function towerCollapsePoint(source: TowerPoint, center: TowerPoint, target: TowerPoint, p: number, ground = false): TowerPoint {
  if (ground) {
    const spread = cityEase(p, 0, 1);
    return source.map((n, axis) => n * (1 - spread) + target[axis] * spread) as unknown as TowerPoint;
  }
  const phase = Math.max(0, Math.min(.1, center[1] * .08));
  const fall = cityEase(p, phase, .72 + phase);
  const spread = cityEase(p, .30, .94), flatten = cityEase(p, .45, 1);
  const angle = Math.sin(fall * Math.PI) * (.55 + center[1] * .5) * Math.max(0, Math.min(1, (center[1] - .055) * 25)) * (center[0] < 0 ? 1 : -1);
  const dx = source[0] - center[0], dy = source[1] - center[1], dz = source[2] - center[2];
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = center[0] * (1 - .22 * Math.sin(fall * Math.PI)) + dx * c - dy * s;
  const y = center[1] * (1 - fall) + dx * s + dy * c;
  const z = center[2] * (1 - .22 * Math.sin(fall * Math.PI)) + dz;
  return [x * (1 - spread) + target[0] * spread, y * (1 - flatten) + target[1] * flatten, z * (1 - spread) + target[2] * spread];
}
