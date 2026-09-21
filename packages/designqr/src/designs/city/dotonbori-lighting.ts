import { Color, MeshBasicMaterial, Vector3, Vector4 } from 'three';
import type { DotonboriLayout } from './dotonbori-layout.ts';
import { dotonboriPoint } from './dotonbori-detail-layout.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import type { DotonboriTemplate } from './dotonbori-assets.ts';
import { hasDotonboriReferenceHost } from './dotonbori-composition.ts';

/** Restrained light spill from the photographed sign fronts and bank lamps.
 * One material pass, no bloom target or extra scene render. Intensities and
 * reach are a night illustration, not a measured photometric reconstruction. */
export function applyDotonboriNightLighting(material: MeshBasicMaterial, layout: DotonboriLayout, templates?: readonly DotonboriTemplate[]) {
  const lights = [
    [-40.7, -8.0, 9, P.warmWindow, 'B039'], [-28.6, -7.7, 8, P.coolWindow, 'B041'],
    [-18.0, -7.7, 9, S.blue, 'B040'], [-14.3, -7.7, 4.5, S.coral, 'B040'],
    [22.3, -7.2, 11, P.warmWindow, 'B046'], [-16.6, 11.6, 13, P.coolWindow, 'B034'], [26, 12.3, 12, S.blue, 'B031'],
  ] as const;
  const points = lights.map(([e, n, radius, , host]) => {
    const p = dotonboriPoint(e, n, 0, layout);
    return new Vector4(p.x, p.z, radius / layout.tileSizeM, !templates || hasDotonboriReferenceHost(templates, host) ? 1 : 0);
  });
  const colors = lights.map(light => new Color(light[3]));
  material.onBeforeCompile = shader => {
    shader.uniforms.dotonboriLights = { value: points };
    shader.uniforms.dotonboriLightColors = { value: colors };
    shader.vertexShader = 'varying vec3 vDotonboriSite;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDotonboriSite = position;');
    shader.fragmentShader = `varying vec3 vDotonboriSite; uniform vec4 dotonboriLights[7]; uniform vec3 dotonboriLightColors[7];\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
for (int i = 0; i < 7; i++) {
  vec2 delta = vDotonboriSite.xz - dotonboriLights[i].xy;
  float reach = dotonboriLights[i].z;
  float spill = dotonboriLights[i].w * 0.43 * exp(-dot(delta, delta) / (reach * reach)) * exp(-max(0.0, vDotonboriSite.y - 0.02) * 14.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, dotonboriLightColors[i], spill);
}`);
  };
  material.customProgramCacheKey = () => 'dotonbori-night-spill-v3';
  // The editable review samples the same lighting at its mesh vertices.
  material.userData.dotonboriLightAt = (position: Vector3, color: Color) => {
    points.forEach((p, i) => {
      const distance = (position.x - p.x) ** 2 + (position.z - p.y) ** 2;
      const spill = p.w * .43 * Math.exp(-distance / p.z ** 2) * Math.exp(-Math.max(0, position.y - .02) * 14);
      color.lerp(colors[i], spill);
    });
    return color;
  };
  material.needsUpdate = true;
}
