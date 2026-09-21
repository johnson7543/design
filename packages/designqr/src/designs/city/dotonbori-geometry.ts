import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { mergeDotonboriGeometry, tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';
import { OSAKA_NIGHT_SWATCHES as P, mixCityColor } from './palette.ts';

export const DOTONBORI_PALETTE = Object.freeze({
  paving: mixCityColor(P.navy, P.ivory, .43), stone: mixCityColor(P.navy, P.highRise, .48),
  joints: mixCityColor(P.navy, P.charcoal, .30), metal: mixCityColor(P.navy, P.highRise, .40),
  wall: mixCityColor(P.navy, P.charcoal, .42), water: mixCityColor(P.navy, P.charcoal, .08),
  foam: mixCityColor(P.bay, P.highRise, .50), boat: P.gold, glass: mixCityColor(P.navy, P.blue, .55),
  dark: P.navy, light: P.ivory, building: mixCityColor(P.navy, P.highRise, .18),
  roof: mixCityColor(P.navy, P.highRise, .22), section: mixCityColor(P.navy, P.charcoal, .28),
  road: mixCityColor(P.navy, P.charcoal, .52), warmWindow: mixCityColor(P.gold, P.ivory, .40),
  coolWindow: mixCityColor(P.blue, P.highRise, .58), glow: mixCityColor(P.blue, P.bay, .25),
});

/** Wheel paint shares the surrounding miniature's cool mineral finish.
 * Warm accents belong to the front rails, lettering and small light rims. */
export const DOTONBORI_EBISU_PALETTE = Object.freeze({
  frame: mixCityColor(P.gold, DOTONBORI_PALETTE.metal, .52),
  coral: mixCityColor(P.coral, DOTONBORI_PALETTE.stone, .62),
  blue: mixCityColor(P.blue, DOTONBORI_PALETTE.stone, .35),
  ivory: mixCityColor(P.ivory, DOTONBORI_PALETTE.stone, .48),
  skin: mixCityColor(mixCityColor(P.ivory, P.coral, .23), DOTONBORI_PALETTE.stone, .55),
  gold: mixCityColor(P.gold, DOTONBORI_PALETTE.stone, .45),
  coat: DOTONBORI_PALETTE.coolWindow,
});

/** A fixed broad key and cool ambient fill describe curved relief and roof
 * slopes continuously. Light direction belongs to the site, never the camera. */
export function dotonboriSurfaceShade(x: number, y: number, z: number) {
  return .40 + .30 * Math.max(0, y) + .30 * Math.max(0, x * -.38 + y * .74 + z * .56);
}

/** Small original geometry, baked to one vertex-colored draw per detail layer. */
export class DotonboriGeometry {
  private readonly parts: BufferGeometry[] = [];
  readonly fragments: DotonboriFragment[] = [];
  buildingId: string | undefined;
  readonly metres: number;
  readonly group: string;
  constructor(metres: number, group: string) { this.metres = metres; this.group = group; }

  add(input: BufferGeometry, color: string, luminous = false) {
    const geometry = input.index ? input.toNonIndexed() : input;
    if (geometry !== input) input.dispose();
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal'), ink = new Color(color);
    const colors = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      const shade = luminous ? 1 : dotonboriSurfaceShade(normals.getX(i), normals.getY(i), normals.getZ(i));
      colors.set([ink.r * shade, ink.g * shade, ink.b * shade], i * 3);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    if (luminous) geometry.userData.dotonboriUnlitRanges = [{ start: 0, count: normals.count }];
    geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv');
    if (this.buildingId) tagDotonboriBuilding(geometry, this.buildingId);
    this.parts.push(geometry);
  }

  box(center: Vector3, widthM: number, heightM: number, depthM: number, color: string, angle = 0, fragment = true, luminous = false) {
    const width = widthM / this.metres, height = heightM / this.metres, depth = depthM / this.metres;
    this.add(new BoxGeometry(width, height, depth).rotateY(angle).translate(center.x, center.y, center.z), color, luminous);
    if (fragment) this.fragments.push({ x: center.x, y: center.y, z: center.z, width, height, depth, angle, color,
      kind: 'furniture', group: this.group, sourceBuilding: this.buildingId, id: `${this.group}-${this.fragments.length}` });
  }

  beam(a: Vector3, b: Vector3, widthM: number, color: string, fragment = false, luminous = false) {
    const direction = b.clone().sub(a), center = a.clone().add(b).multiplyScalar(.5), width = widthM / this.metres;
    this.add(new BoxGeometry(width, width, direction.length()).applyQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction.normalize())).translate(center.x, center.y, center.z), color, luminous);
    if (fragment) this.fragments.push({ x: center.x, y: center.y, z: center.z, width, height: width,
      depth: a.distanceTo(b), angle: Math.atan2(b.x - a.x, b.z - a.z), color,
      kind: 'furniture', group: this.group, sourceBuilding: this.buildingId, id: `${this.group}-${this.fragments.length}` });
  }

  finish() {
    const geometry = mergeDotonboriGeometry(this.parts);
    this.parts.forEach(part => part.dispose()); this.parts.length = 0;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }
}
