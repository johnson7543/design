import { BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { dotonboriBoatPose } from './dotonbori-activity.ts';
import { dotonboriPoint } from './dotonbori-detail-layout.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { cityEase, type CityMorphVoxel } from './morph.ts';
import { dotonboriWaterClearance } from './dotonbori-water-area.ts';

export const DOTONBORI_WAKE_GROUP = 'dotonbori-spreading-wake';
export const DOTONBORI_WAKE_INTERVAL = .72;
export const DOTONBORI_WAKE_RINGS = 12;
const LIFETIME = DOTONBORI_WAKE_INTERVAL * DOTONBORI_WAKE_RINGS;
const PARTS = 6, ORDER = [0, 1, 2, 0, 2, 3];

/** Analytic emission history retains waves in the water after the boat moves.
 * Periodic slots fade at both ends; QR edits and frame rate cannot reset them.
 * Spread, drift, lifetime and strength are miniature choreography, not a survey. */
export function createDotonboriWake(library: DotonboriLibrary, clearance = dotonboriWaterClearance(library)) {
  const { layout, waterfront } = library, size = layout.tileSizeM;
  const count = DOTONBORI_WAKE_RINGS * PARTS, geometry = new BufferGeometry();
  const positions = new Float32BufferAttribute(new Float32Array(count * 18), 3).setUsage(DynamicDrawUsage);
  const colors = new Float32BufferAttribute(new Float32Array(count * 24), 4).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positions); geometry.setAttribute('color', colors);
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const mesh = new Mesh(geometry, material); mesh.name = DOTONBORI_WAKE_GROUP; mesh.frustumCulled = false;
  // Keep crests above the base water and reflection layer from every orbit angle.
  // Depth testing still lets the boat, bridge and banks occlude them.
  mesh.renderOrder = .2;
  mesh.userData.evidence = 'operator vessel; interpreted spreading stern waves';
  const foam = new Color(P.foam), water = new Color(P.water), fragments: (CityMorphVoxel | undefined)[] = new Array(count);
  const rings = Array.from({ length: DOTONBORI_WAKE_RINGS }, () => ({ east: 0, north: 0, c: 1, s: 0, radius: 0, strength: 0 }));
  let lastTime = NaN;
  const update = (time: number) => {
    if (time === lastTime) return;
    lastTime = time;
    const latest = Math.floor(time / DOTONBORI_WAKE_INTERVAL);
    for (let history = 0; history < DOTONBORI_WAKE_RINGS; history++) {
      const emission = latest - history, born = emission * DOTONBORI_WAKE_INTERVAL, age = time - born;
      const slot = ((emission % DOTONBORI_WAKE_RINGS) + DOTONBORI_WAKE_RINGS) % DOTONBORI_WAKE_RINGS;
      const boat = dotonboriBoatPose(waterfront, layout, born), angle = boat.angle - layout.rotationYRadians;
      const c = Math.cos(angle), s = Math.sin(angle), stern = waterfront.boat.lengthOverallM / 2 + .18;
      const radius = waterfront.boat.beamM * .38 + age * .54;
      const strength = cityEase(age, 0, .38) * (1 - cityEase(age, 1.1, LIFETIME)) * .64;
      const east = boat.east - stern * c + age * .045, north = boat.north - stern * s;
      Object.assign(rings[slot], { east, north, c, s, radius, strength });
      for (let part = 0; part < PARTS; part++) {
        const side = part < PARTS / 2 ? -1 : 1, segment = part % (PARTS / 2);
        const start = segment / 3 * 1.30, end = (segment + .88) / 3 * 1.30;
        const point = (a: number) => {
          const x = -.28 - radius * .42 * Math.cos(a), z = side * radius * Math.sin(a);
          return [east + x * c - z * s, north + x * s + z * c];
        };
        const a = point(start), b = point(end), e = (a[0] + b[0]) / 2, n = (a[1] + b[1]) / 2;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]), width = .075 + age * .012;
        const alpha = strength * cityEase(clearance(e, n) - Math.hypot(length, width) / 2, 0, .45);
        const index = slot * PARTS + part, dx = -(b[1] - a[1]) / length * width / 2, dn = (b[0] - a[0]) / length * width / 2;
        const corners = [[a[0] - dx, a[1] - dn], [b[0] - dx, b[1] - dn], [b[0] + dx, b[1] + dn], [a[0] + dx, a[1] + dn]];
        const points = corners.map(([east, north]) => dotonboriPoint(east, north, waterfront.levelsM.water + .027, layout));
        for (let vertex = 0; vertex < 6; vertex++) {
          const target = index * 6 + vertex, p = points[ORDER[vertex]];
          positions.setXYZ(target, alpha > 0 ? p.x : 0, (waterfront.levelsM.water + .027) / size, alpha > 0 ? p.z : 0);
          colors.setXYZW(target, foam.r, foam.g, foam.b, alpha);
        }
        const center = dotonboriPoint(e, n, waterfront.levelsM.water + .027, layout);
        fragments[index] = alpha > .0001 ? { ...center, width: length / size, height: .025 / size, depth: width / size,
          angle: layout.rotationYRadians + Math.atan2(b[1] - a[1], b[0] - a[0]),
          color: '#' + water.clone().lerp(foam, alpha).getHexString(), kind: 'marking', group: DOTONBORI_WAKE_GROUP,
          id: `${DOTONBORI_WAKE_GROUP}-${index}` } : undefined;
      }
    }
    positions.needsUpdate = true; colors.needsUpdate = true;
  };
  update(0);
  return { mesh, material, update,
    snapshot: () => fragments.filter((f): f is CityMorphVoxel => !!f).map(f => ({ ...f })),
    /** Small, bounded disturbance where a spreading crest reaches a reflection. */
    disturbance(east: number, north: number) {
      let value = 0;
      for (const ring of rings) {
        const e = east - ring.east, n = north - ring.north, x = e * ring.c + n * ring.s, z = -e * ring.s + n * ring.c;
        if (x > .3 || x < -ring.radius * .42 - 1 || Math.abs(z) > ring.radius + 1) continue;
        const distance = Math.hypot((x + .28) / .42, z) - ring.radius;
        if (Math.abs(distance) < 1) value += Math.sin(distance * Math.PI) * (1 - Math.abs(distance)) * ring.strength;
      }
      return Math.max(-1, Math.min(1, value));
    },
  };
}
