import { BufferGeometry, Vector3 } from 'three';

/** Source roofs define a small CPU height field for nearby sky obstruction.
 * This is an ambient-depth illustration, not a photometric shadow simulation.
 * Bake once after content changes; vertex paint then travels with every QR patch. */
export class DotonboriDepthShading {
  private readonly sourcePaint = new WeakMap<BufferGeometry, Float32Array>();
  private readonly resolution = 192;
  private readonly heights = new Float32Array(this.resolution ** 2);
  private readonly samples = new Map<string, number>();
  private readonly directions = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
  private metres = 144;

  update(buildings: readonly { geometry: BufferGeometry }[], metres: number) {
    this.metres = metres; this.heights.fill(0); this.samples.clear();
    const r = this.resolution;
    for (const { geometry } of buildings) {
      const p = geometry.getAttribute('position'), index = geometry.index;
      const count = index?.count ?? p.count;
      for (let face = 0; face < count; face += 3) {
        const ids = [0, 1, 2].map(i => index ? index.getX(face + i) : face + i);
        const [a, b, c] = ids.map(i => [(p.getX(i) + .5) * r, p.getY(i), (p.getZ(i) + .5) * r]);
        const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(denominator) < 1e-9) continue;
        for (let z = Math.max(0, Math.floor(Math.min(a[2], b[2], c[2]))); z <= Math.min(r - 1, Math.ceil(Math.max(a[2], b[2], c[2]))); z++) {
          for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))); x <= Math.min(r - 1, Math.ceil(Math.max(a[0], b[0], c[0]))); x++) {
            const u = ((b[2] - c[2]) * (x + .5 - c[0]) + (c[0] - b[0]) * (z + .5 - c[2])) / denominator;
            const v = ((c[2] - a[2]) * (x + .5 - c[0]) + (a[0] - c[0]) * (z + .5 - c[2])) / denominator;
            if (u < 0 || v < 0 || u + v > 1) continue;
            const slot = z * r + x;
            this.heights[slot] = Math.max(this.heights[slot], a[1] * u + b[1] * v + c[1] * (1 - u - v));
          }
        }
      }
    }
  }

  private height(x: number, z: number) {
    const r = this.resolution, ix = Math.floor((x + .5) * r), iz = Math.floor((z + .5) * r);
    return ix < 0 || iz < 0 || ix >= r || iz >= r ? 0 : this.heights[iz * r + ix];
  }

  visibility(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    const key = [x, y, z, nx, ny, nz].map(v => Math.round(v * 10000)).join(',');
    const cached = this.samples.get(key); if (cached !== undefined) return cached;
    let blocked = 0, weights = 0;
    for (const [dx, dz] of this.directions) {
      // Only the outward hemisphere contributes; a wall cannot shadow itself
      // through the solid building behind its outward normal.
      const weight = Math.max(0, nx * dx * .85 + ny * .53 + nz * dz * .85);
      if (!weight) continue;
      let horizon = 0;
      for (const distanceM of [1.1, 2.8, 7]) {
        const distance = distanceM / this.metres;
        const rise = this.height(x + dx * distance, z + dz * distance) - y - .18 / this.metres;
        // Bounded solid-angle estimate softens obstruction from distant roofs.
        horizon = Math.max(horizon, Math.max(0, rise) / Math.hypot(rise, distance) * Math.exp(-distanceM / 18));
      }
      blocked += horizon * weight; weights += weight;
    }
    const value = 1 - .48 * blocked / Math.max(.001, weights);
    this.samples.set(key, value); return value;
  }

  bake(geometry: BufferGeometry) {
    const p = geometry.getAttribute('position'), color = geometry.getAttribute('color');
    if (!p || !color) return;
    let original = this.sourcePaint.get(geometry);
    if (!original) { original = Float32Array.from(color.array); this.sourcePaint.set(geometry, original); }
    const unlit: { start: number; count: number }[] = geometry.userData.dotonboriUnlitRanges ?? [];
    const index = geometry.index, count = index?.count ?? p.count;
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3();
    let range = 0;
    for (let face = 0; face < count; face += 3) {
      while (range < unlit.length && unlit[range].start + unlit[range].count <= face) range++;
      const luminous = range < unlit.length && unlit[range].start <= face;
      const ids = [0, 1, 2].map(i => index ? index.getX(face + i) : face + i);
      a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
      normal.subVectors(b, a).cross(c.sub(a)).normalize();
      for (const id of ids) {
        const shade = luminous ? 1 : this.visibility(p.getX(id), p.getY(id), p.getZ(id), normal.x, normal.y, normal.z);
        const offset = id * color.itemSize;
        color.setXYZ(id, original[offset] * shade, original[offset + 1] * shade, original[offset + 2] * shade);
      }
    }
    // Keep an originally affine panel affine after the ambient approximation.
    // A least-squares planar color fit avoids splitting a window/rail into two
    // separate QR sources just because its four obstruction samples differ.
    // Paint seams, nonplanar faces and originally non-affine paint stay separate.
    range = 0;
    for (let face = 0; face + 6 <= count; face += 3) {
      while (range < unlit.length && unlit[range].start + unlit[range].count <= face) range++;
      if (range < unlit.length && unlit[range].start < face + 6) continue;
      const ids = Array.from({ length: 6 }, (_, i) => index ? index.getX(face + i) : face + i);
      const same = (a: number, b: number) => [0, 1, 2].every(axis => Math.abs(p.getComponent(a, axis) - p.getComponent(b, axis)) < 1e-8
        && Math.abs(original[a * color.itemSize + axis] - original[b * color.itemSize + axis]) < 1e-8);
      const shared = ids.slice(0, 3).map(id => ids.slice(3).some(other => same(id, other)));
      if (shared.filter(Boolean).length !== 2) continue;
      const single = shared.indexOf(false), other = ids.slice(3).find(id => !ids.slice(0, 3).some(first => same(id, first)));
      if (other === undefined) continue;
      const quad = [ids[single], ids[(single + 1) % 3], other, ids[(single + 2) % 3]];
      if ([0, 1, 2].some(axis => Math.abs(p.getComponent(quad[0], axis) + p.getComponent(quad[2], axis)
        - p.getComponent(quad[1], axis) - p.getComponent(quad[3], axis)) > 1e-7
        || Math.abs(original[quad[0] * color.itemSize + axis] + original[quad[2] * color.itemSize + axis]
          - original[quad[1] * color.itemSize + axis] - original[quad[3] * color.itemSize + axis]) > 1e-7)) continue;
      for (let axis = 0; axis < 3; axis++) {
        const values = quad.map(id => color.getComponent(id, axis));
        const mean = values.reduce((sum, v) => sum + v, 0) / 4;
        let u = (values[1] + values[2] - values[0] - values[3]) / 4;
        let v = (values[2] + values[3] - values[0] - values[1]) / 4;
        const amplitude = Math.abs(u) + Math.abs(v);
        const limit = Math.min(1, (mean - Math.min(...values)) / Math.max(1e-12, amplitude),
          (Math.max(...values) - mean) / Math.max(1e-12, amplitude));
        u *= limit; v *= limit;
        const fitted = [mean - u - v, mean + u - v, mean + u + v, mean - u + v];
        for (const id of ids) color.setComponent(id, axis, fitted[quad.findIndex(corner => same(id, corner))]);
      }
      face += 3;
    }
    color.needsUpdate = true;
  }

  finish() { this.samples.clear(); }
}
