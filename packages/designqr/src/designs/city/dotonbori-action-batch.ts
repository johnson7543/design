import { BoxGeometry, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Matrix4, Mesh,
  MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { mergeDotonboriGeometry, tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';

export const DOTONBORI_ACTION_GROUP = 'dotonbori-local-actions';
const UP = new Vector3(0, 1, 0);
export interface DotonboriActionPart {
  id: string; color: string; sourceBuilding?: string; group?: string;
  geometry?: BufferGeometry;
}

/** Capture a tilted box in its actor's horizontal frame. Vertical/sideways
 * spans include its actual pose instead of discarding arm pitch and roll. */
export function dotonboriActionBox(matrix: Matrix4, color: string, id: string, group: string, yaw: number): DotonboriFragment {
  const aligned = new Matrix4().makeRotationY(-yaw).multiply(matrix), e = aligned.elements;
  const width = Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8]);
  const height = Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9]);
  const depth = Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10]);
  const p = new Vector3().setFromMatrixPosition(matrix);
  return { x: p.x, y: p.y, z: p.z, width, height, depth, angle: yaw, color, id, group, kind: 'furniture' };
}

/** Small moving fittings share one retained vertex batch. Source ownership
 * keeps every actor's current pose attached to its building in the QR turn. */
export class DotonboriActionBatch {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  readonly parts: readonly DotonboriActionPart[];
  private readonly original: Float32Array;
  private readonly ranges: { start: number; count: number }[] = [];
  private readonly matrices: Matrix4[];
  private readonly yaws: number[];
  private readonly reflections: boolean[];
  private readonly dummy = new Object3D();
  private readonly direction = new Vector3();
  private readonly rotation = new Quaternion();

  constructor(name: string, parts: readonly DotonboriActionPart[], material?: MeshBasicMaterial) {
    this.parts = parts;
    let start = 0;
    const pieces = parts.map(part => {
      const source = part.geometry ?? new BoxGeometry(1, 1, 1), geometry = source.index ? source.toNonIndexed() : source;
      if (source !== geometry) source.dispose();
      geometry.computeVertexNormals();
      const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), color = new Color(part.color);
      const colors = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const shade = normal.getY(i) > .5 ? 1 : normal.getX(i) > .5 ? .84 : .75;
        colors.set([color.r * shade, color.g * shade, color.b * shade], i * 3);
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv');
      if (part.sourceBuilding) tagDotonboriBuilding(geometry, part.sourceBuilding);
      this.ranges.push({ start, count: position.count }); start += position.count;
      return geometry;
    });
    const geometry = mergeDotonboriGeometry(pieces); pieces.forEach(p => p.dispose());
    this.original = new Float32Array(geometry.getAttribute('position')?.array ?? []);
    if (!geometry.getAttribute('position')) geometry.setAttribute('position', new Float32BufferAttribute([], 3));
    (geometry.getAttribute('position') as Float32BufferAttribute).setUsage(DynamicDrawUsage);
    this.mesh = new Mesh(geometry, material ?? new MeshBasicMaterial({ vertexColors: true, transparent: true }));
    this.mesh.name = name; this.mesh.frustumCulled = false;
    this.matrices = parts.map(() => new Matrix4()); this.yaws = parts.map(() => 0); this.reflections = parts.map(() => false);
  }

  box(index: number, parent: Matrix4, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) {
    this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, yaw, 0); this.dummy.scale.set(w, h, d); this.dummy.updateMatrix();
    this.setMatrix(index, this.dummy.matrix.premultiply(parent), Math.atan2(parent.elements[8], parent.elements[10]) + yaw);
  }

  beam(index: number, parent: Matrix4, a: readonly number[], b: readonly number[], width: number) {
    this.direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    this.dummy.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.dummy.scale.set(width, this.direction.length(), width);
    this.rotation.setFromUnitVectors(UP, this.direction.normalize()); this.dummy.quaternion.copy(this.rotation); this.dummy.updateMatrix();
    this.setMatrix(index, this.dummy.matrix.premultiply(parent), Math.atan2(parent.elements[8], parent.elements[10]));
  }

  private setMatrix(index: number, matrix: Matrix4, yaw: number) {
    this.matrices[index].copy(matrix); this.yaws[index] = yaw;
    const range = this.ranges[index], position = this.mesh.geometry.getAttribute('position'), e = matrix.elements, reflected = matrix.determinant() < 0;
    if (reflected !== this.reflections[index]) {
      const colors = this.mesh.geometry.getAttribute('color');
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const r = colors.getX(i + 1), g = colors.getY(i + 1), b = colors.getZ(i + 1);
        colors.setXYZ(i + 1, colors.getX(i + 2), colors.getY(i + 2), colors.getZ(i + 2)); colors.setXYZ(i + 2, r, g, b);
      }
      colors.needsUpdate = true; this.reflections[index] = reflected;
    }
    for (let i = range.start; i < range.start + range.count; i++) {
      // Fitted wall coordinates can have a reflected tangent. Keep triangles
      // outward-facing after baking that reflection into the vertex buffer.
      const corner = (i - range.start) % 3, source = reflected && corner ? i + (corner === 1 ? 1 : -1) : i;
      const x = this.original[source * 3], y = this.original[source * 3 + 1], z = this.original[source * 3 + 2];
      position.setXYZ(i, e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
  }

  commit() { this.mesh.geometry.getAttribute('position').needsUpdate = true; }

  snapshot(parent?: Matrix4): DotonboriFragment[] {
    const matrix = new Matrix4(), extraYaw = parent ? Math.atan2(parent.elements[8], parent.elements[10]) : 0;
    return this.parts.flatMap((part, i) => {
      matrix.copy(this.matrices[i]); if (parent) matrix.premultiply(parent);
      const fragment = dotonboriActionBox(matrix, part.color, part.id, part.group ?? DOTONBORI_ACTION_GROUP, this.yaws[i] + extraYaw);
      if (fragment.width < 1e-10 || fragment.height < 1e-10 || fragment.depth < 1e-10) return [];
      fragment.sourceBuilding = part.sourceBuilding; return [fragment];
    });
  }
}
