import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import type { ResolvedTreeTheme } from '../../config/types.ts';
import { BLOCK_SIZE } from '../../designs/tree/constants.ts';
import { createCityQRTargets } from '../../designs/city/qr-colors.ts';
import { createTokyoTowerParts, towerFaces, towerSourceColor } from '../../designs/city/tokyo-tower-parts.ts';
import { mapTokyoTower, towerSourcePoint, towerTargetPoint, towerCollapsePoint } from '../../designs/city/tokyo-tower-morph.ts';
import type { TowerPatch } from '../../designs/city/tokyo-tower-morph.ts';
import type { CityMorphTarget } from '../../designs/city/morph-sources.ts';

/** The same fully inventoried surface mesh renders the tower AND the final QR.
 * No transient samples, opacity handoff, hidden surplus or replacement plate. */
export class TokyoTowerScene {
  readonly root = new Group();
  readonly assetStatus = 'ready';
  readonly parts = createTokyoTowerParts();
  readonly faces = towerFaces(this.parts);
  private readonly progress = { value: 0 };
  private readonly editProgress = { value: -1 };
  private readonly material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, toneMapped: false });
  private readonly mesh = new Mesh(new BufferGeometry(), this.material);
  private patches: TowerPatch[] = [];
  private targets: CityMorphTarget[] = [];
  private grid = 0;
  private disposed = false;
  private compiled = false;

  constructor(modules: boolean[][], theme: ResolvedTreeTheme) {
    this.root.name = 'designqr-tokyo-tower';
    this.mesh.name = 'tokyo-tower-complete-surfaces';
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
    this.material.onBeforeCompile = shader => {
      shader.uniforms.towerProgress = this.progress;
      shader.uniforms.towerEditProgress = this.editProgress;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 towerCenter;
attribute vec3 towerEnd;
attribute vec3 towerInk;
attribute vec3 towerCorrection;
attribute float towerGround;
uniform float towerProgress;
uniform float towerEditProgress;
float towerEase(float p, float a, float b) { float t = clamp((p-a)/(b-a), 0.0, 1.0); return t*t*(3.0-2.0*t); }
`).replace('#include <color_vertex>', `#include <color_vertex>
vColor.rgb = mix(color, towerInk, towerGround > .5 ? towerEase(towerProgress, .18, .9) : towerEase(towerProgress, .52, .94));
`).replace('#include <begin_vertex>', `
float p = towerProgress;
float phase = clamp(towerCenter.y * .08, 0.0, .1);
float fall = towerEase(p, phase, .72 + phase);
float spread = towerEase(p, .30, .94);
float flatten = towerEase(p, .45, 1.0);
float angle = sin(fall * 3.14159265359) * (.55 + towerCenter.y * .5) * clamp((towerCenter.y - .055) * 25.0, 0.0, 1.0) * (towerCenter.x < 0.0 ? 1.0 : -1.0);
vec3 local = position - towerCenter;
vec3 folded = vec3(local.x*cos(angle) - local.y*sin(angle), local.x*sin(angle) + local.y*cos(angle), local.z);
vec3 center = vec3(towerCenter.x, 0.0, towerCenter.z) * (1.0 - .22*sin(fall*3.14159265359));
center.y = towerCenter.y * (1.0-fall);
vec3 transformed = mix(center + folded, towerEnd, vec3(spread, flatten, spread));
if (towerGround > .5) transformed = mix(position, towerEnd, towerEase(p, 0.0, 1.0));
if (towerEditProgress > 0.0 && towerEditProgress < 1.0) {
  float weight = p < towerEditProgress ? towerEase(p, 0.0, towerEditProgress) : 1.0-towerEase(p, towerEditProgress, 1.0);
  transformed += towerCorrection * weight;
}
`);
    };
    this.material.customProgramCacheKey = () => 'tokyo-tower-ground-paper-v3';
    this.updateContent(modules, theme);
  }

  updateContent(modules: boolean[][], theme: ResolvedTreeTheme) {
    if (this.disposed) return;
    const p = this.progress.value, oldGrid = this.grid, oldTargets = this.targets;
    const oldPatches = new Map<string, { patch: TowerPatch; offset: number }[]>();
    this.patches.forEach((patch, i) => {
      const group = oldPatches.get(patch.face.id) ?? [];
      group.push({ patch, offset: i * 6 }); oldPatches.set(patch.face.id, group);
    });
    const oldCorrections = this.mesh.geometry.getAttribute('towerCorrection');
    const oldEdit = this.editProgress.value;
    const retarget = p > 0 && p < 1 && this.grid > 0;
    this.grid = modules.length;
    this.root.scale.setScalar(this.grid * BLOCK_SIZE);
    this.targets = createCityQRTargets(modules, theme);
    let patches = mapTokyoTower(this.faces, this.targets);
    // Preserve old source split boundaries, so an edited frame has exactly the
    // old surface tessellation as well as continuous corner positions.
    if (retarget) patches = patches.flatMap(patch => {
      const cuts = [patch.sourceStart, ...(oldPatches.get(patch.face.id) ?? []).map(p => p.patch.sourceEnd)
        .filter(u => u > patch.sourceStart + 1e-10 && u < patch.sourceEnd - 1e-10), patch.sourceEnd].sort((a, b) => a - b);
      return cuts.slice(0, -1).map((u, i) => ({ ...patch, sourceStart: u, sourceEnd: cuts[i + 1],
        targetStart: patch.targetStart + (u - patch.sourceStart) / (patch.sourceEnd - patch.sourceStart) * (patch.targetEnd - patch.targetStart),
        targetEnd: patch.targetStart + (cuts[i + 1] - patch.sourceStart) / (patch.sourceEnd - patch.sourceStart) * (patch.targetEnd - patch.targetStart) }));
    });
    this.patches = patches;
    const positions: number[] = [], centers: number[] = [], ends: number[] = [], colors: number[] = [], inks: number[] = [], corrections: number[] = [], grounds: number[] = [];
    const vertices = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    for (const patch of patches) for (const [u, v] of vertices) {
      const sourceU = patch.sourceStart + u * (patch.sourceEnd - patch.sourceStart);
      const source = towerSourcePoint(patch.face, sourceU, v), center = patch.face.part.center;
      const target = towerTargetPoint(patch, this.targets[patch.cell], this.grid, u, v);
      positions.push(...source); centers.push(...center); ends.push(...target); colors.push(...towerSourceColor(patch.face, sourceU, v));
      grounds.push(Number(patch.face.part.ground));
      const ink = this.targets[patch.cell].ink; inks.push(ink.r, ink.g, ink.b);
      const correction = [0, 0, 0];
      if (retarget) {
        const prior = oldPatches.get(patch.face.id)!.find(({ patch: old }) =>
          (patch.sourceStart + patch.sourceEnd) / 2 > old.sourceStart - 1e-10
          && (patch.sourceStart + patch.sourceEnd) / 2 < old.sourceEnd + 1e-10)!;
        const oldU = Math.max(0, Math.min(1, (sourceU - prior.patch.sourceStart) / (prior.patch.sourceEnd - prior.patch.sourceStart)));
        const before = towerCollapsePoint(source, center, towerTargetPoint(prior.patch, oldTargets[prior.patch.cell], oldGrid, oldU, v), p, patch.face.part.ground);
        const after = towerCollapsePoint(source, center, target, p, patch.face.part.ground);
        const weight = oldEdit > 0 && oldEdit < 1 ? (p < oldEdit ? smooth(p / oldEdit) : 1 - smooth((p - oldEdit) / (1 - oldEdit))) : 0;
        for (let axis = 0; axis < 3; axis++) {
          const a = v ? 5 : 0, b = v ? 2 : 1;
          const oldDelta = oldCorrections ? oldCorrections.array[(prior.offset + a) * 3 + axis] * (1 - oldU)
            + oldCorrections.array[(prior.offset + b) * 3 + axis] * oldU : 0;
          correction[axis] = before[axis] + oldDelta * weight - after[axis];
        }
      }
      corrections.push(...correction);
    }
    const geometry = new BufferGeometry();
    for (const [name, data] of Object.entries({ position: positions, towerCenter: centers, towerEnd: ends,
      color: colors, towerInk: inks, towerCorrection: corrections })) geometry.setAttribute(name, new Float32BufferAttribute(data, 3));
    geometry.setAttribute('towerGround', new Float32BufferAttribute(grounds, 1));
    this.mesh.geometry.dispose(); this.mesh.geometry = geometry;
    this.editProgress.value = retarget ? p : -1;
    this.root.userData.inventory = { parts: this.parts.length, faces: this.parts.reduce((sum, part) => sum + part.surfaces.length, 0),
      morphFaces: this.faces.length, patches: patches.length, cells: this.grid ** 2 };
  }

  getLogoAnchor() { return { x: 0, y: 10.4 / 320, z: 26.7 / 320, width: 13 / 320, height: 5.5 / 320, angle: 0 }; }
  setLogoPresent(_present: boolean) { /* Plain panel is the permanent backing. */ }
  prepareMorphRendering(renderer: WebGLRenderer, camera: Camera, scene: Scene) { if (!this.compiled) { renderer.compile(this.root, camera, scene); this.compiled = true; } }
  update(progress: number, _deltaSeconds = 0, _reducedMotion = false, _running = true) {
    if (!this.disposed) this.progress.value = Math.max(0, Math.min(1, progress));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.mesh.geometry.dispose(); this.material.dispose();
    this.root.clear(); this.root.removeFromParent(); this.patches = []; this.targets = [];
  }
}

function smooth(t: number) { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); }
