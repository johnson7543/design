import { BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { dotonboriChannel, dotonboriContains, dotonboriPoint } from './dotonbori-detail-layout.ts';
import { DOTONBORI_PALETTE as P, DOTONBORI_EBISU_PALETTE as E } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S, mixCityColor } from './palette.ts';
import type { DotonboriBuildingRange, DotonboriFragment } from './dotonbori-ownership.ts';
import { hasDotonboriReferenceHost, DOTONBORI_REFERENCE_HOSTS } from './dotonbori-composition.ts';
import { dotonboriGlicoBlend, DOTONBORI_GLICO_REFLECTIONS } from './dotonbori-glico-animation.ts';
import { createDotonboriWake } from './dotonbori-wake.ts';
import { dotonboriWaterClearance } from './dotonbori-water-area.ts';
import { dotonboriLandmarkLocation } from './dotonbori-layout.ts';

export const DOTONBORI_WATER_REFLECTIONS = 'dotonbori-river-reflections';
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];

/** Broken light paths below the photographed sign fronts (S6/S14), plus fine
 * cross-channel ripples. This is illustrative lighting, not a water survey. */
export function createDotonboriRiver(library: DotonboriLibrary) {
  const { layout, waterfront: data } = library, size = layout.tileSizeM;
  const positions: number[] = [], colors: number[] = [], phases: number[] = [], fragments: DotonboriFragment[] = [];
  const alternateColors: number[] = [], clearance = dotonboriWaterClearance(library), wake = createDotonboriWake(library, clearance);
  const strokes: { east: number; north: number; width: number; depth: number; phase: number; freedom: number;
    x: number; z: number; currentWidth: number; currentDepth: number }[] = [];
  const fragmentSources: { stroke: number; ink: Color; alternate: Color }[] = [];
  const ranges: DotonboriBuildingRange[] = []; let sourceBuilding: string | undefined;
  const noise = (i: number) => { const x = Math.sin(i * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
  const stroke = (e: number, n: number, width: number, depth: number, color: string, strength: number, seed: number) => {
    const corners = [[e - width / 2, n - depth / 2], [e + width / 2, n - depth / 2], [e + width / 2, n + depth / 2], [e - width / 2, n + depth / 2]];
    const points = corners.map(([east, north]) => dotonboriPoint(east, north, data.levelsM.water + .018, layout));
    if (!corners.every(([east, north]) => dotonboriContains(library.plan.water, east, north))
      || points.some(p => Math.abs(p.x) > .4998 || Math.abs(p.z) > .4998)) return;
    const ink = new Color(mixCityColor(P.water, color, strength));
    const glico = sourceBuilding === DOTONBORI_REFERENCE_HOSTS.B040;
    const alternate = new Color(mixCityColor(P.water, glico ? color === S.blue ? S.bay : S.gold : color, strength));
    // Reserve the complete motion envelope inside a mapped-water circle.
    // Long strokes near a bank keep their shape and only shimmer.
    const freedom = Math.max(0, Math.min(1, (clearance(e, n) - Math.hypot(width, depth) / 2) / (.50 + width * .10 + depth * .24)));
    const phase = noise(seed) * Math.PI * 2, center = dotonboriPoint(e, n, data.levelsM.water + .018, layout);
    strokes.push({ east: e, north: n, width, depth, phase, freedom, x: center.x, z: center.z, currentWidth: width, currentDepth: depth });
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...points[i].toArray()); colors.push(ink.r, ink.g, ink.b);
      alternateColors.push(alternate.r, alternate.g, alternate.b); phases.push(phase);
    }
    if (seed % 8 === 0) {
      const p = dotonboriPoint(e, n, data.levelsM.water + .018, layout);
      fragments.push({ x: p.x, y: p.y, z: p.z, width: width / size, height: .035 / size, depth: depth / size,
        angle: layout.rotationYRadians, color: '#' + ink.getHexString(), kind: 'marking',
        group: glico ? DOTONBORI_GLICO_REFLECTIONS : DOTONBORI_WATER_REFLECTIONS, sourceBuilding,
        id: `dotonbori-water-stroke-${seed}` });
      fragmentSources.push({ stroke: strokes.length - 1, ink, alternate });
    }
  };
  for (let i = 0; i < 240; i++) {
    const first = data.channelSectionsM[0][0], last = data.channelSectionsM.at(-1)![0];
    const east = first + noise(i * 3) * (last - first), channel = dotonboriChannel(data, east);
    const north = channel.south + .4 + noise(i * 3 + 1) * (channel.north - channel.south - .8);
    stroke(east, north, .55 + noise(i * 3 + 2) * 2.1, .06 + noise(i + 18) * .07, P.foam, .07 + noise(i + 8) * .12, i);
  }
  ranges.push({ start: 0, count: positions.length / 3 });
  const lights = [
    [-40.68, -1, 10, S.gold, 'B039'], [-28.55, -1, 8, S.ivory, 'B041'], [-17.67, -1, 9, S.blue, 'B040'], [-14.8, -1, 3, S.coral, 'B040'],
    [-9.43, -1, 5, S.ivory, 'B037'], [22.33, -1, 10, S.gold, 'B046'], [-16.6, 1, 14, P.coolWindow, 'B034'], [26, 1, 13, S.blue, 'B031'],
    [135.5, 1, 26, E.frame, 'B092'], [141, 1, 9, E.coral, 'B092'],
  ] as const;
  lights.forEach(([center, side, span, color, host], light) => {
    if (!hasDotonboriReferenceHost(library.templates, host)) return;
    sourceBuilding = DOTONBORI_REFERENCE_HOSTS[host]; const start = positions.length / 3;
    const [placedCenter] = dotonboriLandmarkLocation(layout, sourceBuilding, center, 0);
    for (let row = 0; row < 17; row++) for (let col = 0; col < 3; col++) {
      const seed = 500 + light * 157 + row * 3 + col, r = noise(seed);
      const east = placedCenter + ((col + r) / 3 - .5) * span + Math.sin(row * 1.7 + light) * .45;
      const channel = dotonboriChannel(data, east), distance = .24 + row * .60;
      const north = (side < 0 ? channel.south : channel.north) - side * distance;
      if (north > channel.north - .3 || north < channel.south + .3 || r < .18) continue;
      const falloff = Math.exp(-distance / 9) * (.46 + r * .52);
      stroke(east, north, span / 3 * (.25 + noise(seed + 43) * .60), .10 + noise(seed + 17) * .19, color, falloff, seed);
    }
    ranges.push({ building: sourceBuilding, start, count: positions.length / 3 - start });
  });
  const geometry = new BufferGeometry();
  geometry.userData.buildingRanges = ranges;
  const position = new Float32BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('glicoReflectedColor', new Float32BufferAttribute(alternateColors, 3));
  geometry.setAttribute('ripplePhase', new Float32BufferAttribute(phases, 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const clock = { value: NaN }, glicoBlend = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.dotonboriWaterTime = clock;
    shader.uniforms.dotonboriGlicoBlend = glicoBlend;
    shader.vertexShader = 'attribute float ripplePhase; varying float vRipplePhase; attribute vec3 glicoReflectedColor; uniform float dotonboriGlicoBlend;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRipplePhase = ripplePhase;');
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, glicoReflectedColor, dotonboriGlicoBlend);');
    shader.fragmentShader = 'uniform float dotonboriWaterTime; varying float vRipplePhase;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= 0.76 + 0.24 * sin(dotonboriWaterTime * 1.15 + vRipplePhase);');
  };
  material.customProgramCacheKey = () => 'dotonbori-water-glimmer-v2';
  material.userData.dotonboriClock = clock;
  material.userData.dotonboriGlicoBlend = glicoBlend;
  const mesh = new Mesh(geometry, material); mesh.name = 'dotonbori-water-reflections';
  // The base water shares the fading city material. Transparent-object sorting
  // reverses with the eye; draw this overlay after it, retaining depth testing.
  mesh.renderOrder = .1;
  mesh.frustumCulled = false;
  const c = Math.cos(layout.rotationYRadians), s = Math.sin(layout.rotationYRadians), water = new Color(P.water);
  const update = (time: number) => {
    if (time === clock.value) return;
    clock.value = time; glicoBlend.value = dotonboriGlicoBlend(time); wake.update(time);
    strokes.forEach((stroke, i) => {
      const { east, north, width, depth, phase, freedom } = stroke, disturbance = wake.disturbance(east, north);
      const e = east + freedom * (.34 * Math.sin(time * .63 + phase) + disturbance * .10);
      const n = north + freedom * (.14 * Math.cos(time * .47 - phase) + disturbance * .05);
      stroke.currentWidth = width * (1 + freedom * (.14 * Math.sin(time * .88 + phase) + disturbance * .05));
      stroke.currentDepth = depth * (1 + freedom * (.30 * Math.sin(time * 1.13 - phase) + disturbance * .16));
      const x = e - layout.centerEastNorthM[0], z = layout.centerEastNorthM[1] - n;
      stroke.x = (x * c + z * s) / size; stroke.z = (z * c - x * s) / size;
      CORNERS.forEach(([a, b], vertex) => {
        const dx = a * stroke.currentWidth / 2, dz = -b * stroke.currentDepth / 2;
        position.setXYZ(i * 6 + vertex, stroke.x + (dx * c + dz * s) / size,
          (data.levelsM.water + .018) / size, stroke.z + (dz * c - dx * s) / size);
      });
    });
    position.needsUpdate = true;
  };
  update(0);
  return { mesh, material, fragments, wake, update,
    snapshot: () => [...fragments.map((fragment, i) => {
      const { stroke: index, ink, alternate } = fragmentSources[i], stroke = strokes[index];
      const alpha = .76 + .24 * Math.sin(clock.value * 1.15 + stroke.phase);
      return { ...fragment, x: stroke.x, z: stroke.z, width: stroke.currentWidth / size, depth: stroke.currentDepth / size,
        color: '#' + water.clone().lerp(ink.clone().lerp(alternate, glicoBlend.value), alpha).getHexString() };
    }), ...wake.snapshot()] };
}
