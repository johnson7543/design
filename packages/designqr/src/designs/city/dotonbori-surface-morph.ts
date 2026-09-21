import { BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import type { CityMorphTarget } from './morph-sources.ts';
import { dotonboriBuildingRanges } from './dotonbori-ownership.ts';
import { DOTONBORI_SURFACE_PHASES as PHASE } from './dotonbori-transition.ts';
import { DOTONBORI_REFERENCE_HOSTS } from './dotonbori-composition.ts';
import { DOTONBORI_GLICO_SIGN_ID } from './dotonbori-glico-animation.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { frontPoint, libraryDotonboriFronts } from './dotonbori-facade-layout.ts';
import { cityEase } from './morph.ts';
import { DotonboriSurfaceGeometry } from './dotonbori-surface-geometry.ts';

// Rotate the printed front toward +Y so the overhead view reads its front face.
export const DOTONBORI_GLICO_FOLD_RADIANS = -Math.PI / 2;

type Point = readonly [number, number, number];
type Source = { mesh: Mesh<BufferGeometry, MeshBasicMaterial>; matrix: Matrix4; instance: number;
  owner: string; start: number; count: number; dynamic: boolean; batch: Batch; };
type Face = { source: Source; offset: number; ids: number[]; owner: string; center: Point; weight: number; mode: number; bucket: number; };
type Batch = { source: MeshBasicMaterial; mesh: Mesh<DotonboriSurfaceGeometry, MeshBasicMaterial>; count: number; cursor: number;
  geometry: DotonboriSurfaceGeometry; dynamic: { source: Source; ids: number[]; start: number; end: number; offset: number }[]; };
export interface DotonboriSurfacePatch { face: number; cell: number; sourceStart: number; sourceEnd: number; targetStart: number; targetEnd: number }

/** Integer interval transport cuts triangles only at destination boundaries.
 * Matching planar triangles form panels; unpaired triangles use a collapsed
 * fourth corner. Strips preserve every source face and tile each complete cell. */
export function mapDotonboriSurfaceIntervals(weights: readonly number[], cells: readonly number[], emit: (patch: DotonboriSurfacePatch) => void) {
  if (!weights.length || !cells.length) throw new Error('Dōtonbori surface groups require sources and QR cells.');
  const total = weights.reduce((sum, weight) => sum + weight, 0), count = cells.length;
  let face = 0, target = 0, boundary = 0, sourceBoundary = 0;
  while (face < weights.length && target < count) {
    const sourceEnd = sourceBoundary + weights[face] * count, targetEnd = (target + 1) * total;
    const end = Math.min(sourceEnd, targetEnd);
    emit({ face, cell: cells[target],
      sourceStart: (boundary - sourceBoundary) / (weights[face] * count), sourceEnd: (end - sourceBoundary) / (weights[face] * count),
      targetStart: (boundary - target * total) / total, targetEnd: (end - target * total) / total });
    boundary = end;
    if (end === sourceEnd) { face++; sourceBoundary = sourceEnd; }
    if (end === targetEnd) target++;
  }
}

export function dotonboriFinderCell(cell: number, grid: number) {
  const row = Math.floor(cell / grid), col = cell % grid - (grid - 7);
  if (row < 0 || row > 6 || col < 0 || col > 6) return undefined;
  if (row === 0 || row === 6 || col === 0 || col === 6) return 'ring';
  if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return 'center';
  return undefined;
}

const smooth = `float surfaceEase(float p,float a,float b) { float t=clamp((p-a)/(b-a),0.0,1.0); return t*t*(3.0-2.0*t); }`;
const phase = (interval: readonly [number, number]) => `surfaceEase(p,${interval.map(n => n.toFixed(2)).join(',')})`;

/** Complete, textured surface transport. Original meshes own their live data
 * and atlases. This batched snapshot owns only geometry/materials, refreshes
 * moving vertices once per turn, and changes one uniform during playback. */
export class DotonboriSurfaceMorph {
  readonly root = new Group();
  readonly progress = { value: 0 };
  readonly inventory = { sourceTriangles: 0, degenerateTriangles: 0, patches: 0, bytes: 0, batches: 0, buildMs: 0,
    cells: [] as number[], buildings: [] as string[], meshes: {} as Record<string, number>, wheelCells: [] as number[] };
  private readonly batches = new Map<MeshBasicMaterial, Batch>();
  private readonly sources: Source[] = [];
  private readonly inverse = new Matrix4();
  private readonly palette: Color[] = [];
  private readonly inks: number[] = [];
  private readonly grid: number;
  private readonly wheel: { origin: Vector3; axis: Vector3 };
  private readonly glico: { center: Vector3; axis: Vector3 };
  private readonly city: Group;
  private compiled = false;

  constructor(city: Group, library: DotonboriLibrary, targets: readonly CityMorphTarget[]) {
    const started = performance.now(); this.city = city; this.grid = Math.round(Math.sqrt(targets.length));
    this.root.name = 'dotonbori-complete-surfaces'; this.root.visible = false;
    const fronts = libraryDotonboriFronts(library), front = fronts.find(f => f.id === 'B092')!, sign = fronts.find(f => f.id === 'B040')!;
    this.wheel = { origin: frontPoint(front, 0, 45.735, 2.4), axis: new Vector3(-Math.cos(front.yaw), 0, Math.sin(front.yaw)) };
    this.glico = { center: frontPoint(sign, 0, 15.4, .44), axis: new Vector3(Math.cos(sign.yaw), 0, -Math.sin(sign.yaw)) };
    this.updateTargets(targets);
    city.updateWorldMatrix(true, true); this.inverse.copy(city.matrixWorld).invert();
    const hosts = new Map(library.templates.map(t => [t.id, t.geometry.boundingBox!.getCenter(new Vector3())]));
    const references = new Set(Object.values(DOTONBORI_REFERENCE_HOSTS));
    const groups: Face[][] = Array.from({ length: 5 }, () => []), a = new Vector3(), b = new Vector3(), c = new Vector3();
    const u = new Vector3(), v = new Vector3(), local = new Vector3();
    city.traverse(object => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial) || !object.visible) return;
      for (let parent = object.parent; parent && parent !== city; parent = parent.parent) if (!parent.visible) return;
      const mesh = object as Mesh<BufferGeometry, MeshBasicMaterial>, geometry = mesh.geometry, position = geometry.getAttribute('position');
      if (!position) return;
      const owner = mesh.userData.sourceBuilding ?? (hosts.has(mesh.name) ? mesh.name : '');
      const ranges = dotonboriBuildingRanges(geometry), index = geometry.index;
      const start = geometry.drawRange.start, count = Math.min(index?.count ?? position.count, start + geometry.drawRange.count) - start;
      const instances = mesh instanceof InstancedMesh ? mesh.count : 1;
      const ground = /water|river|wake|datum|road|bridge|ebisubashi-deck/.test(mesh.name);
      const wheel = mesh.name === 'dotonbori-ebisu-structure' || mesh.name === 'dotonbori-ebisu-cabins';
      for (let instance = 0; instance < instances; instance++) {
        const matrix = this.inverse.clone().multiply(mesh.matrixWorld);
        if (mesh instanceof InstancedMesh) { const transform = new Matrix4(); mesh.getMatrixAt(instance, transform); matrix.multiply(transform); }
        const source: Source = { mesh, matrix, instance, owner, start, count,
          dynamic: mesh instanceof InstancedMesh || ('usage' in position && position.usage === DynamicDrawUsage) || mesh.name === 'dotonbori-doton-tour-boat' || !!mesh.material.map || mesh.name === 'dotonbori-night-signs',
          batch: this.batch(mesh.material) };
        let rangeIndex = 0, triangles = 0;
        for (let offset = start; offset < start + count; offset += 3) {
          while (rangeIndex + 1 < ranges.length && ranges[rangeIndex].start + ranges[rangeIndex].count <= offset) rangeIndex++;
          const host = owner || ranges[rangeIndex]?.building || '';
          a.fromBufferAttribute(position, index ? index.getX(offset) : offset).applyMatrix4(matrix);
          b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1).applyMatrix4(matrix);
          c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2).applyMatrix4(matrix);
          const area = u.subVectors(b, a).cross(v.subVectors(c, a)).length() / 2;
          // Zero-area hidden visitor limbs and inactive wake slots have no drawn surface.
          if (area < 1e-16 && !source.dynamic) { this.inventory.degenerateTriangles++; continue; }
          const quad = offset + 6 <= Math.min(start + count, ranges[rangeIndex] ? ranges[rangeIndex].start + ranges[rangeIndex].count : Infinity)
            ? planarQuad(geometry, offset) : undefined;
          const ids = quad ?? [0, 1, 2, 2].map(i => index ? index.getX(offset + i) : offset + i);
          const center: Point = quad ? ids.reduce((sum, id) => {
            local.fromBufferAttribute(position, id).applyMatrix4(matrix); return [sum[0] + local.x / 4, sum[1] + local.y / 4, sum[2] + local.z / 4];
          }, [0, 0, 0] as [number, number, number]) : [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3];
          local.fromArray(center).sub(this.wheel.origin);
          const isWheel = wheel && (mesh instanceof InstancedMesh || center[1] * library.layout.tileSizeM > 17);
          const core = isWheel && Math.abs(local.dot(this.wheel.axis) * library.layout.tileSizeM) < 9.5
            && center[1] * library.layout.tileSizeM > 20 && center[1] * library.layout.tileSizeM < 55;
          const bucket = isWheel ? core ? 4 : 3 : ground ? 2 : references.has(host) ? 0 : 1;
          groups[bucket].push({ source, offset, ids, owner: host || mesh.name, center, weight: Math.max(1, Math.round(area * (quad ? 2 : 1) * 1e9)),
            mode: isWheel ? 3 : ground ? 0 : mesh.name === DOTONBORI_GLICO_SIGN_ID ? 2 : 1, bucket });
          triangles += quad ? 2 : 1; if (quad) offset += 3;
        }
        if (triangles) { this.sources.push(source); this.inventory.meshes[mesh.name] = (this.inventory.meshes[mesh.name] ?? 0) + triangles; }
      }
    });
    const cells: number[][] = Array.from({ length: 5 }, () => []), dark: number[] = [];
    targets.forEach((target, cell) => {
      const finder = dotonboriFinderCell(cell, this.grid);
      if (target.light) cells[2].push(cell);
      else if (finder) cells[finder === 'ring' ? 3 : 4].push(cell);
      else if (Math.abs(target.x) < .1 + 1 / this.grid && Math.abs(target.z) < .1 + 1 / this.grid) cells[1].push(cell);
      else dark.push(cell);
    });
    const area = (faces: Face[]) => faces.reduce((sum, face) => sum + face.weight, 0);
    const share = area(groups[0]) / Math.max(1, area(groups[0]) + area(groups[1]));
    dark.sort((a, b) => spatial(targets[a].x, targets[a].z) - spatial(targets[b].x, targets[b].z)).forEach((cell, i) => {
      cells[Math.floor((i + 1) * share) > Math.floor(i * share) ? 0 : 1].push(cell);
    });
    const angle = (x: number, y: number) => Math.atan2(y, x);
    const wheelCenter = (this.grid - 3.5) / this.grid - .5;
    groups.forEach((faces, group) => {
      if (!faces.length) return;
      faces.sort((a, b) => {
        if (group >= 3) {
          const ax = local.fromArray(a.center).sub(this.wheel.origin).dot(this.wheel.axis), ay = a.center[1] - this.wheel.origin.y;
          const bx = local.fromArray(b.center).sub(this.wheel.origin).dot(this.wheel.axis), by = b.center[1] - this.wheel.origin.y;
          return angle(ax, -ay) - angle(bx, -by) || a.offset - b.offset;
        }
        const ac = hosts.get(a.owner), bc = hosts.get(b.owner);
        return spatial(ac?.x ?? a.center[0], ac?.z ?? a.center[2]) - spatial(bc?.x ?? b.center[0], bc?.z ?? b.center[2])
          || a.owner.localeCompare(b.owner) || a.center[1] - b.center[1] || a.offset - b.offset;
      });
      cells[group].sort((a, b) => group >= 3
        ? angle(targets[a].x - wheelCenter, targets[a].z + wheelCenter) - angle(targets[b].x - wheelCenter, targets[b].z + wheelCenter)
        : spatial(targets[a].x, targets[a].z) - spatial(targets[b].x, targets[b].z));
      const weights = faces.map(f => f.weight);
      // Count before allocating typed buffers. Retain no per-triangle JS graph.
      mapDotonboriSurfaceIntervals(weights, cells[group], patch => { faces[patch.face].source.batch.count++; });
    });
    for (const batch of this.batches.values()) this.allocate(batch);
    const travel = new Map<string, { x: number; z: number; weight: number }>();
    for (let group = 0; group < groups.length; group++) {
      const faces = groups[group]; if (!faces.length) continue;
      mapDotonboriSurfaceIntervals(faces.map(f => f.weight), cells[group], patch => {
        const face = faces[patch.face], target = targets[patch.cell], w = (patch.sourceEnd - patch.sourceStart) * face.weight;
        const total = travel.get(face.owner) ?? { x: 0, z: 0, weight: 0 };
        total.x += target.x * w; total.z += target.z * w; total.weight += w; travel.set(face.owner, total);
      });
      mapDotonboriSurfaceIntervals(faces.map(f => f.weight), cells[group], patch => {
        const face = faces[patch.face], batch = face.source.batch, offset = batch.cursor, host = hosts.get(face.owner);
        const target = targets[patch.cell], ink = this.inks[patch.cell];
        const total = travel.get(face.owner)!, dx = host ? total.x / total.weight - host.x : 0, dz = host ? total.z / total.weight - host.z : 0;
        this.writeSource(face.source, face.ids, patch.sourceStart, patch.sourceEnd, offset);
        const x = (u: number) => target.x + (patch.targetStart + u * (patch.targetEnd - patch.targetStart) - .5) / this.grid;
        batch.geometry.bounds.setXYZW(offset, x(0), x(1), target.z - .5 / this.grid, target.z + .5 / this.grid);
        batch.geometry.target.setXY(offset, patch.cell * 8 + ink, face.mode);
        batch.geometry.flow.setXY(offset, dx, dz);
        if (face.source.dynamic) batch.dynamic.push({ source: face.source, ids: face.ids, start: patch.sourceStart, end: patch.sourceEnd, offset });
        batch.cursor++; this.inventory.cells[patch.cell] = (this.inventory.cells[patch.cell] ?? 0) + patch.targetEnd - patch.targetStart;
        this.inventory.patches++;
      });
    }
    this.inventory.buildings = [...new Set(groups.flat().map(face => face.owner).filter(owner => hosts.has(owner)))];
    this.inventory.sourceTriangles = Object.values(this.inventory.meshes).reduce((sum, count) => sum + count, 0);
    this.inventory.wheelCells = [...cells[3], ...cells[4]];
    for (const batch of this.batches.values()) {
      this.inventory.bytes += batch.geometry.bytes;
      if (!batch.count) continue;
      batch.geometry.computeBoundingSphere();
      this.inventory.batches++;
    }
    this.inventory.buildMs = performance.now() - started;
    this.root.userData.inventory = this.inventory;
  }

  /** Presentation-only edits retain the correspondence and all GPU geometry.
   * Palette roles are uniforms; only a changed role index needs an upload. */
  updateTargets(targets: readonly CityMorphTarget[]) {
    if (targets.length !== this.grid ** 2) throw new Error('Surface retargeting requires the same QR matrix.');
    this.palette.length = 0;
    for (const target of [targets.find(t => t.light)!, ...targets]) if (!this.palette.some(c => c.equals(target.ink))) this.palette.push(target.ink.clone());
    if (this.palette.length > 6) throw new Error('Dōtonbori expects the six shared City scan roles.');
    while (this.palette.length < 6) this.palette.push(this.palette[0].clone());
    const inks = targets.map(target => this.palette.findIndex(c => c.equals(target.ink)));
    const changed = inks.some((ink, cell) => ink !== this.inks[cell]);
    this.inks.length = 0; this.inks.push(...inks);
    if (changed) for (const batch of this.batches.values()) {
      const target = batch.geometry.target;
      for (let patch = 0; patch < batch.count; patch++) {
        const cell = Math.floor(target.getX(patch) / 8); target.setX(patch, cell * 8 + inks[cell]);
      }
      batch.geometry.updateMotion();
    }
  }

  private batch(source: MeshBasicMaterial) {
    const existing = this.batches.get(source); if (existing) return existing;
    const material = source.clone(); material.side = DoubleSide; material.forceSinglePass = true; material.clippingPlanes = source.clippingPlanes; material.userData = { ...source.userData };
    material.defines = { ...source.defines }; delete material.defines.DOTONBORI_CITY_SOURCE;
    const key = source.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      source.onBeforeCompile.call(source, shader, renderer);
      shader.uniforms.surfaceProgress = this.progress;
      shader.uniforms.surfaceGrid = { value: this.grid };
      shader.uniforms.surfaceInks = { value: this.palette };
      shader.uniforms.surfaceAccent = { value: new Color(P.warmWindow) };
      shader.uniforms.surfaceGlicoCenter = { value: this.glico.center };
      shader.uniforms.surfaceGlicoAxis = { value: this.glico.axis };
      shader.uniforms.surfaceMotion = { value: batch.geometry.motionTexture };
      shader.uniforms.surfaceMotionWidth = { value: batch.geometry.motionTexture.image.width };
      shader.vertexShader = `uniform float surfaceProgress; uniform float surfaceGrid;
uniform vec3 surfaceGlicoCenter; uniform vec3 surfaceGlicoAxis;
varying float vSurfaceInk; varying float vSurfacePaint; varying float vSurfacePulse;
${smooth}\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
float p=clamp(surfaceProgress,0.0,1.0);
float mode=surfaceEnd.w;
float cell=floor(surfaceEnd.z/8.0), ink=mod(surfaceEnd.z,8.0);
vec3 end=vec3(surfaceEnd.x,mode<0.5 ? -0.002 : 0.001,surfaceEnd.y);
vec3 destination=vec3((mod(cell,surfaceGrid)+0.5)/surfaceGrid-0.5,end.y,(floor(cell/surfaceGrid)+0.5)/surfaceGrid-0.5);
float travel=${phase(PHASE.travel)}, settle=${phase(PHASE.settle)}, shrink=${phase(PHASE.contract)};
vec3 center=surfaceCenter;
if (mode>0.5) {
  center.xz+=surfaceFlow.xy*${phase(PHASE.drift)};
  center.y*=1.0-${phase(PHASE.lower)};
  center.y+=0.018*sin(3.14159265359*${phase(PHASE.lift)});
}
float compact=min(1.0,0.5/(surfaceGrid*max(surfaceFlow.z,0.00001)));
transformed=mix(center,destination,travel)+mix((position-surfaceCenter)*(1.0-shrink*(1.0-compact)),end-destination,settle);
if (mode>1.5 && mode<2.5) {
  vec3 local=position-surfaceGlicoCenter;
  float fold=${DOTONBORI_GLICO_FOLD_RADIANS}*${phase(PHASE.fold)};
  vec3 rotated=local*cos(fold)+cross(surfaceGlicoAxis,local)*sin(fold)+surfaceGlicoAxis*dot(surfaceGlicoAxis,local)*(1.0-cos(fold));
  vec3 center=surfaceGlicoCenter;
  center.xz+=surfaceFlow.xy*${phase(PHASE.drift)};
  center.y*=1.0-${phase(PHASE.lower)};
  center.y+=0.12*sin(3.14159265359*${phase(PHASE.lift)});
  transformed=mix(center+rotated,end,settle);
}
vSurfaceInk=ink;
vSurfacePaint=${phase(PHASE.paint)};
vSurfacePulse=surfaceEase(p,0.0,0.055)*(1.0-surfaceEase(p,0.37,0.58))*exp(-pow((p-0.18)/0.10,2.0))*mix(0.045,0.16,1.0-surfaceEase(abs((position.x+position.z)*0.70710678118),0.075,0.20));
#include <project_vertex>`);
      shader.vertexShader = batch.geometry.vertexShader(shader.vertexShader);
      shader.fragmentShader = `uniform vec3 surfaceInks[6]; uniform vec3 surfaceAccent;
varying float vSurfaceInk; varying float vSurfacePaint; varying float vSurfacePulse;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
outgoingLight=mix(outgoingLight,surfaceAccent,vSurfacePulse);
outgoingLight=mix(outgoingLight,surfaceInks[int(vSurfaceInk+0.5)],vSurfacePaint);
diffuseColor.a=mix(diffuseColor.a,1.0,vSurfacePaint);
#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => key + ':dotonbori-complete-surfaces-v5';
    const geometry = new DotonboriSurfaceGeometry(0, { position: 3 });
    const mesh = new Mesh(geometry, material); mesh.name = source.name || 'dotonbori-surface-batch';
    mesh.frustumCulled = false;
    const batch: Batch = { source, mesh, count: 0, cursor: 0, geometry, dynamic: [] };
    this.batches.set(source, batch); this.root.add(mesh); return batch;
  }

  private allocate(batch: Batch) {
    const sizes: Record<string, number> = { position: 3 };
    for (const source of this.sources) if (source.batch === batch) {
      for (const [name, attribute] of Object.entries(source.mesh.geometry.attributes)) {
        if (!['position', 'normal'].includes(name)) sizes[name] = Math.max(sizes[name] ?? 0, attribute.itemSize);
      }
      if (source.mesh instanceof InstancedMesh && source.mesh.instanceColor) sizes.color = Math.max(sizes.color ?? 0, 3);
    }
    batch.mesh.geometry.dispose();
    batch.mesh.geometry = batch.geometry = new DotonboriSurfaceGeometry(batch.count, sizes);
    batch.mesh.material.vertexColors = !!sizes.color;
    batch.mesh.userData.sourceMeshes = [...new Set(this.sources.filter(source => source.batch === batch).map(source => source.mesh.name))];
  }

  private writeSource(source: Source, ids: number[], start: number, end: number, offset: number) {
    const g = source.mesh.geometry;
    const point = new Vector3(), instanceColor = new Color();
    if (source.mesh instanceof InstancedMesh && source.mesh.instanceColor) source.mesh.getColorAt(source.instance, instanceColor);
    const geometry = source.batch.geometry;
    for (const [name, destinations] of Object.entries(geometry.source)) {
      const attribute = g.getAttribute(name), size = destinations[0].itemSize;
      for (let corner = 0; corner < 4; corner++) {
        const destination = destinations[corner];
        const [cu, v] = corners[corner], u = start + cu * (end - start);
        for (let axis = 0; axis < size; axis++) {
          const read = (i: number) => attribute && axis < attribute.itemSize ? attribute.getComponent(ids[i], axis) : name === 'color' ? 1 : 0;
          let value = (read(0) * (1 - u) + read(1) * u) * (1 - v) + (read(3) * (1 - u) + read(2) * u) * v;
          if (name === 'color' && axis < 3) value *= [instanceColor.r, instanceColor.g, instanceColor.b][axis];
          destination.setComponent(offset, axis, value);
        }
        if (name === 'position') {
          point.fromBufferAttribute(destination, offset).applyMatrix4(source.matrix);
          destination.setXYZ(offset, point.x, point.y, point.z);
        }
      }
    }
    const positions = geometry.source.position;
    point.set(0, 0, 0);
    for (const position of positions) {
      point.x += position.getX(offset) / 4; point.y += position.getY(offset) / 4; point.z += position.getZ(offset) / 4;
    }
    let radius = 0;
    for (const position of positions) radius = Math.max(radius, Math.hypot(position.getX(offset) - point.x,
      position.getY(offset) - point.y, position.getZ(offset) - point.z));
    geometry.centers.setXYZ(offset, point.x, point.y, point.z);
    geometry.flow.setZ(offset, radius);
  }

  capture() {
    this.city.updateWorldMatrix(true, true); this.inverse.copy(this.city.matrixWorld).invert();
    const instance = new Matrix4();
    for (const source of this.sources) if (source.dynamic) {
      source.matrix.copy(this.inverse).multiply(source.mesh.matrixWorld);
      if (source.mesh instanceof InstancedMesh) { source.mesh.getMatrixAt(source.instance, instance); source.matrix.multiply(instance); }
    }
    for (const batch of this.batches.values()) {
      for (const patch of batch.dynamic) {
        this.writeSource(patch.source, patch.ids, patch.start, patch.end, patch.offset);
      }
      if (batch.dynamic.length) batch.geometry.updateSource();
    }
  }

  prepare(renderer: WebGLRenderer, camera: Camera, scene: Scene) {
    if (this.compiled) return; this.compiled = true;
    renderer.compile(this.root, camera, scene);
  }
  update(progress: number) { this.progress.value = progress; this.root.visible = progress > 0 && progress < 1; }
  dispose() {
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); batch.mesh.material.dispose(); }
    this.root.removeFromParent(); this.root.clear(); this.batches.clear(); this.sources.length = 0;
  }
}

/** Morton order keeps neighbouring façade groups and QR cells together. */
function spatial(x: number, z: number) {
  const spread = (n: number) => { n = (n | n << 8) & 16_711_935; n = (n | n << 4) & 252_645_135; n = (n | n << 2) & 858_993_459; return (n | n << 1) & 1_431_655_765; };
  return spread(Math.max(0, Math.min(1023, Math.floor((x + .5) * 1024)))) | spread(Math.max(0, Math.min(1023, Math.floor((z + .5) * 1024)))) << 1;
}

/** Shared architecture, wheel and ground path, for surface-motion audits. */
export function dotonboriSurfacePoint(source: Point, target: Point, center: Point, destination: Point,
  flow: Point, grid: number, progress: number, ground = false): Point {
  const p = Math.max(0, Math.min(1, progress));
  const travel = cityEase(p, ...PHASE.travel), settle = cityEase(p, ...PHASE.settle), shrink = cityEase(p, ...PHASE.contract);
  const drift = cityEase(p, ...PHASE.drift);
  const moved = ground ? center : [center[0] + flow[0] * drift,
    center[1] * (1 - cityEase(p, ...PHASE.lower)) + .018 * Math.sin(Math.PI * cityEase(p, ...PHASE.lift)), center[2] + flow[1] * drift];
  const compact = Math.min(1, .5 / (grid * Math.max(flow[2], .00001)));
  return source.map((n, axis) => moved[axis] * (1 - travel) + destination[axis] * travel
    + (n - center[axis]) * (1 - shrink * (1 - compact)) * (1 - settle) + (target[axis] - destination[axis]) * settle) as unknown as Point;
}


const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** Only merge an affine parallelogram with matching corner attributes. This
 * preserves the source's texture interpolation, paint and closed silhouette;
 * warped surfaces and paint seams retain their original triangles. */
function planarQuad(geometry: BufferGeometry, offset: number) {
  const index = geometry.index, ids = Array.from({ length: 6 }, (_, i) => index ? index.getX(offset + i) : offset + i);
  const attributes = Object.entries(geometry.attributes).filter(([name]) => name !== 'normal').map(([, a]) => a);
  const equal = (a: number, b: number) => a === b || attributes.every(attribute => {
    for (let axis = 0; axis < attribute.itemSize; axis++) if (Math.abs(attribute.getComponent(a, axis) - attribute.getComponent(b, axis)) > 1e-8) return false;
    return true;
  });
  const shared = ids.slice(0, 3).map(id => ids.slice(3).some(other => equal(id, other)));
  if (shared.filter(Boolean).length !== 2) return undefined;
  const single = shared.indexOf(false), other = ids.slice(3).find(id => !ids.slice(0, 3).some(first => equal(id, first)));
  if (other === undefined) return undefined;
  const quad = [ids[single], ids[(single + 1) % 3], other, ids[(single + 2) % 3]];
  for (const attribute of attributes) for (let axis = 0; axis < attribute.itemSize; axis++) {
    if (Math.abs(attribute.getComponent(quad[0], axis) + attribute.getComponent(quad[2], axis)
      - attribute.getComponent(quad[1], axis) - attribute.getComponent(quad[3], axis)) > 1e-7) return undefined;
  }
  return quad;
}
