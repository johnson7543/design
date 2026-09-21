import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { cityPanelAnchor, type CityFacadePanel } from './architecture.ts';
import { CITY_SIGN_DESIGNS } from './sign-artwork.ts';
import { cityEase, cityMorphPose, cityMorphProgress, type CityMorphVoxel } from './morph.ts';
import type { CityMorphTile } from './morph-sources.ts';

/** A bounded pilot: three panels on two landmarks, never the uploaded logo. */
export const CITY_MORPH_SIGN_IDS = ['qfront-vision', 'magnet-corner-poster', 'magnet-side-poster'] as const;
const retained = (panel: CityFacadePanel) => panel.path.length === 2
  && CITY_MORPH_SIGN_IDS.some(id => id === panel.id);

export function cityMorphSignSources(panel: CityFacadePanel, hasLogo: boolean): CityMorphVoxel[] {
  const anchor = cityPanelAnchor(panel), design = CITY_SIGN_DESIGNS[panel.design];
  const detailed = retained(panel), a = panel.path[0], b = panel.path.at(-1)!;
  const x = detailed ? (a.x + b.x) / 2 : anchor.x, z = detailed ? (a.z + b.z) / 2 : anchor.z;
  const width = detailed ? panel.width : anchor.width, height = detailed ? panel.height : anchor.height;
  return [-1, 1].map(side => ({
    x: x + Math.cos(anchor.angle) * width * .25 * side,
    y: anchor.y, z: z - Math.sin(anchor.angle) * width * .25 * side,
    width: width / 2, height, depth: .001, angle: anchor.angle,
    color: side < 0 || panel.hero && hasLogo ? design.background : design.ink,
    kind: 'sign', id: `${panel.id}-${side}`, group: panel.id,
  }));
}

export function cityMorphSignState(progress: number) {
  return {
    opacity: cityEase(progress, .30, .42) * (1 - cityEase(progress, .58, .78)),
    ink: cityEase(progress, .58, .78),
    tilt: Math.PI / 2 * cityEase(progress, .02, .58),
    fit: cityEase(progress, .58, .78),
    square: cityEase(progress, .78, .94),
  };
}

/** Rigid folding + uniform scale preserve glyph
 * proportions; the rectangle only squares AFTER its lettering has dissolved. */
export function cityMorphSignPose(tile: CityMorphTile, grid: number, progress: number) {
  const pose = cityMorphPose(tile.source, tile.target, grid, progress, tile.motion);
  const state = cityMorphSignState(cityMorphProgress(progress, tile.motion)), cell = 1.002 / grid;
  const scale = 1 + (cell / Math.max(tile.source.width, tile.source.height) - 1) * state.fit;
  return { ...pose, width: tile.source.width * scale * (1 - state.square) + cell * state.square,
    height: tile.source.height * scale * (1 - state.square) + cell * state.square, tilt: state.tilt };
}

type Sign = { panel: CityFacadePanel; mesh: Mesh<BufferGeometry, MeshBasicMaterial>; uvRect?: readonly [number, number, number, number] };

const corners = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, -.5], [.5, .5], [-.5, .5]];

/** Six quads, one geometry, at most three single-pass material groups.
 * Maps are BORROWED from the live signs, including the mutable private hero map.
 * Reuse the existing sign shader: only 36 positions (432 bytes) change during
 * visible folding. No atlas, texture upload, readback or logo texture is used. */
export class CityMorphSigns {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial[]>;
  private readonly materials = new Map<string, MeshBasicMaterial>();
  private parts: CityMorphTile[] = [];
  private materialParts: number[] = [];
  private grid = 1;
  private lastProgress = NaN;
  private readonly ids: readonly string[];

  constructor(ids: readonly string[] = CITY_MORPH_SIGN_IDS) {
    this.ids = ids;
    const vertices = ids.length * 12;
    const geometry = new BufferGeometry();
    for (const [name, size] of [['position', 3], ['uv', 2]] as const) {
      const attribute = new Float32BufferAttribute(new Float32Array(vertices * size), size);
      if (name === 'position') attribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute(name, attribute);
    }
    // MeshBasic does not light these faces, but HAS_NORMAL is part of Three's
    // program key. Retain the original sign's attribute layout to reuse it.
    const normals = new Float32Array(vertices * 3);
    for (let i = 0; i < vertices; i++) normals[i * 3 + 2] = 1;
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    this.mesh = new Mesh(geometry, []);
    this.mesh.name = 'shibuya-morph-sign-detail'; this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2.1; this.mesh.visible = false;
  }

  private material(id: string, source: MeshBasicMaterial) {
    let material = this.materials.get(id);
    // Same map/UV/side shader variant as the existing landmark sign. Fading
    // reveals the palette-colored tile underneath instead of compiling a new
    // texture-to-ink shader on the user's first turn.
    if (!material) {
      material = new MeshBasicMaterial({ transparent: true, depthWrite: false });
      material.name = id; this.materials.set(id, material);
    }
    material.map = source.map;
    // Animated sign shaders borrow the same frozen uniforms as their live
    // artwork. Ordinary Shibuya/City sign materials retain the default shader.
    if (material.onBeforeCompile !== source.onBeforeCompile || material.customProgramCacheKey !== source.customProgramCacheKey) {
      material.onBeforeCompile = source.onBeforeCompile;
      material.customProgramCacheKey = source.customProgramCacheKey;
      material.needsUpdate = true;
    }
    return material;
  }

  /** Hidden morph faces must not retain maps retired by a content edit. */
  updateMaps(signs: Iterable<Sign>) {
    const maps = new Map([...signs].map(({ panel, mesh }) => [panel.id, mesh.material.map]));
    for (const [id, material] of this.materials) material.map = maps.get(id) ?? null;
  }

  setTiles(tiles: readonly CityMorphTile[], signs: Iterable<Sign>, grid: number) {
    const geometry = this.mesh.geometry, attributes = geometry.attributes;
    const byId = new Map(tiles.filter(t => t.source.kind === 'sign').map(t => [t.source.id, t]));
    const materials: MeshBasicMaterial[] = [];
    this.parts = []; this.materialParts = []; this.grid = grid; this.lastProgress = NaN;
    geometry.clearGroups(); let vertex = 0;
    for (const { panel, mesh, uvRect = [0, 0, 1, 1] } of signs) {
      if (!this.ids.includes(panel.id) || panel.path.length !== 2 || !mesh.material.map) continue;
      const start = vertex;
      for (const [half, side] of [-1, 1].entries()) {
        const tile = byId.get(`${panel.id}-${side}`);
        if (!tile) continue;
        this.parts.push(tile);
        for (const [x, y] of corners) {
          attributes.uv.setXY(vertex, uvRect[0] + (x + .5 + half) / 2 * (uvRect[2] - uvRect[0]),
            uvRect[1] + (y + .5) * (uvRect[3] - uvRect[1]));
          vertex++;
        }
      }
      if (vertex === start) continue;
      this.materialParts.push(start / 6);
      geometry.addGroup(start, vertex - start, materials.length);
      materials.push(this.material(panel.id, mesh.material));
    }
    this.mesh.material = materials;
    for (const [id, material] of this.materials) if (!materials.includes(material)) {
      material.dispose(); this.materials.delete(id); // The live sign owns its map.
    }
    geometry.setDrawRange(0, vertex);
    attributes.uv.needsUpdate = true;
  }

  update(progress: number) {
    if (progress === this.lastProgress) return;
    this.lastProgress = progress;
    this.mesh.visible = false;
    for (let i = 0; i < this.mesh.material.length; i++) {
      const state = cityMorphSignState(cityMorphProgress(progress, this.parts[this.materialParts[i]]?.motion));
      this.mesh.material[i].opacity = state.opacity;
      this.mesh.visible ||= state.opacity > 0;
    }
    this.mesh.visible &&= this.mesh.geometry.drawRange.count > 0;
    if (!this.mesh.visible) return;
    const position = this.mesh.geometry.getAttribute('position'); let vertex = 0;
    for (const tile of this.parts) {
      const pose = cityMorphSignPose(tile, this.grid, progress), cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
      for (const [x, y] of corners) {
        const dx = x * pose.width, dy = y * pose.height * Math.cos(pose.tilt), dz = -y * pose.height * Math.sin(pose.tilt);
        position.setXYZ(vertex++, pose.x + dx * cos + dz * sin, pose.y + dy + .0012, pose.z - dx * sin + dz * cos);
      }
    }
    position.needsUpdate = true;
  }
}
