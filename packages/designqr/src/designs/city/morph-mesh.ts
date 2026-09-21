import { BoxGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute,
  InstancedMesh, MeshBasicMaterial, Vector4 } from 'three';
import { CITY_BUILDING_REVEAL_START, cityBuildingRevealWindows, cityEase, cityMorphState } from './morph.ts';
import type { CityMorphTile } from './morph-sources.ts';

/** One transient draw call. Correspondence uploads only at the start of a turn
 * (or a content edit); animation changes uniforms, never thousands of matrices.
 * The settled 3D/2D render paths do not draw or update this batch. */
export class CityMorphMesh {
  mesh: InstancedMesh<BoxGeometry, MeshBasicMaterial>;
  private readonly weights = { value: new Vector4() };
  private readonly color = new Color();

  constructor(tiles: readonly CityMorphTile[], grid: number) {
    const material = new MeshBasicMaterial({ vertexColors: true, transparent: true });
    material.onBeforeCompile = shader => {
      shader.uniforms.cityMorphWeights = this.weights;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 cityStart;
attribute vec3 citySize;
attribute vec3 cityEnd;
attribute vec4 cityAngle;
attribute vec3 cityTargetColor;
attribute vec3 cityGroup;
attribute vec2 cityReveal;
varying float vCityReveal;
uniform vec4 cityMorphWeights;
float cityTileEase(float p, float start, float end) {
  float t = clamp((p - start) / (end - start), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}`).replace('#include <color_vertex>', `#include <color_vertex>
float cityProgress = clamp((cityMorphWeights.y - cityAngle.y) / (cityAngle.z - cityAngle.y), 0.0, 1.0);
float cityVertical = cityTileEase(cityProgress, 0.02, 0.92);
vColor.rgb = mix(vColor.rgb, cityTargetColor, cityTileEase(cityProgress, 0.50, 0.94));
`).replace('#include <begin_vertex>', `
vCityReveal = cityTileEase(cityProgress, cityReveal.x, cityReveal.y);
float travel = cityTileEase(cityProgress, 0.42, 0.90);
float settle = cityTileEase(cityProgress, cityGroup.z, 0.94);
vec3 extent = mix(citySize, vec3(cityMorphWeights.w, 0.002, cityMorphWeights.w), settle);
extent.y = mix(citySize.y, 0.002, cityVertical);
float angle = cityAngle.x * (1.0 - settle);
vec3 local = position * extent;
vec3 transformed = vec3(local.x * cos(angle) + local.z * sin(angle), local.y,
  -local.x * sin(angle) + local.z * cos(angle));
vec2 ground = cityStart.xz + cityGroup.xy * travel + (cityEnd.xz - cityStart.xz - cityGroup.xy) * settle;
float lift = cityAngle.w * sin(3.141592653589793 * cityTileEase(cityProgress, 0.08, 0.88));
transformed += vec3(ground.x, mix(cityStart.y, cityEnd.y, cityVertical) + lift, ground.y);
`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying float vCityReveal;`).replace('#include <color_fragment>', `#include <color_fragment>
// Hidden street/detail tiles must not write depth during the building reveal.
if (vCityReveal <= 0.0) discard;
diffuseColor.a *= vCityReveal;`);
    };
    material.customProgramCacheKey = () => 'designqr-whole-city-morph-v4';
    this.mesh = this.create(tiles.length, material);
    this.setTiles(tiles, grid);
  }

  private create(count: number, material: MeshBasicMaterial) {
    const capacity = Math.ceil(count / 128) * 128;
    const geometry = new BoxGeometry(1, 1, 1);
    const normal = geometry.getAttribute('normal'), colors = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const shade = normal.getY(i) > .5 ? 1 : normal.getX(i) > .5 ? .65 : normal.getZ(i) > .5 ? .84 : .52;
      colors.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    // Angle and timing share one attribute: keep the shader within WebGL's
    // minimum 16 vertex attribute locations, including the instance matrix.
    for (const [name, size] of [['cityStart', 3], ['citySize', 3], ['cityEnd', 3], ['cityAngle', 4], ['cityTargetColor', 3], ['cityGroup', 3], ['cityReveal', 2]] as const) {
      geometry.setAttribute(name, new InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(DynamicDrawUsage));
    }
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.name = 'shibuya-whole-city-tiles'; mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    // Depth belongs to the tile layer during its coverage-preserving handoff.
    mesh.onBeforeRender = renderer => renderer.clearDepth();
    return mesh;
  }

  setTiles(tiles: readonly CityMorphTile[], grid: number) {
    if (tiles.length > this.mesh.instanceMatrix.count) {
      const previous = this.mesh;
      this.mesh = this.create(tiles.length, previous.material);
      previous.parent?.add(this.mesh);
      previous.removeFromParent(); previous.geometry.dispose(); previous.dispose();
    }
    const geometry = this.mesh.geometry;
    const start = geometry.getAttribute('cityStart'), size = geometry.getAttribute('citySize');
    const end = geometry.getAttribute('cityEnd'), angle = geometry.getAttribute('cityAngle'), color = geometry.getAttribute('cityTargetColor');
    const group = geometry.getAttribute('cityGroup');
    const reveal = geometry.getAttribute('cityReveal');
    const windows = cityBuildingRevealWindows(tiles.map(tile => tile.source));
    tiles.forEach(({ source: s, target: t, motion }, i) => {
      start.setXYZ(i, s.x, s.y, s.z); size.setXYZ(i, s.width, s.height, s.depth);
      end.setXYZ(i, t.x, t.light ? -.002 : .001, t.z);
      angle.setXYZW(i, s.angle ?? 0, motion.timing?.start ?? 0, motion.timing?.end ?? 1, motion.timing?.lift ?? 0);
      color.setXYZ(i, t.ink.r, t.ink.g, t.ink.b);
      group.setXYZ(i, motion.x, motion.z, motion.settle);
      reveal.setXY(i, ...windows[i]);
      this.mesh.setColorAt(i, this.color.set(s.color));
    });
    for (const attribute of [start, size, end, angle, color, group, reveal]) attribute.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.count = tiles.length;
    this.weights.value.w = 1.002 / grid;
  }

  update(progress: number) {
    const state = cityMorphState(progress), weights = this.weights.value;
    weights.x = state.vertical; weights.y = progress; weights.z = cityEase(progress, .50, .94);
    this.mesh.visible = progress > CITY_BUILDING_REVEAL_START && progress < 1;
    // Per-instance windows reveal buildings in sections; a shared material
    // opacity would make the whole skyline switch to blocks on the same frame.
    this.mesh.material.opacity = 1;
  }
}
