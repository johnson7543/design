import { CanvasTexture, LinearFilter, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { cityEase } from './morph.ts';

export const DOTONBORI_GLICO_SIGN_ID = 'dotonbori-glico-sign';
export const DOTONBORI_GLICO_REFLECTIONS = 'dotonbori-glico-reflections';
export type DotonboriGlicoArtwork = 'track' | 'rainbow';

/** The two photographed LED looks are reference-directed illustrations.
 * This readable miniature loop is authored timing, not today's ad playlist. */
export function dotonboriGlicoBlend(time: number) {
  const t = Math.max(0, time) % 16;
  return cityEase(t, 4, 6) * (1 - cityEase(t, 10, 12));
}

/** Paint once per player; both the sign and its folding halves borrow this
 * atlas and uniform. Animation requires no canvas repaint or texture upload. */
export function createDotonboriGlicoProgram(paint: (ctx: CanvasRenderingContext2D, artwork: DotonboriGlicoArtwork) => void) {
  const width = 512, height = Math.round(width * 20 / 10.38), blend = { value: 0 };
  let map: CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const atlas = document.createElement('canvas'); atlas.width = width * 2; atlas.height = height;
    const tile = document.createElement('canvas'); tile.width = width; tile.height = height;
    const ctx = atlas.getContext('2d'), source = tile.getContext('2d');
    if (ctx && source) {
      for (const [i, artwork] of (['track', 'rainbow'] as const).entries()) {
        source.save(); source.clearRect(0, 0, width, height); paint(source, artwork); source.restore();
        ctx.drawImage(tile, i * width, 0);
      }
      map = new CanvasTexture(atlas); map.colorSpace = SRGBColorSpace;
      map.generateMipmaps = false; map.minFilter = map.magFilter = LinearFilter;
    }
  }
  const material = new MeshBasicMaterial({ ...(map ? { map } : { color: S.blue }), transparent: true });
  material.userData.dotonboriGlicoBlend = blend;
  material.onBeforeCompile = shader => {
    shader.uniforms.dotonboriGlicoBlend = blend;
    shader.fragmentShader = 'uniform float dotonboriGlicoBlend;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec2 glicoUV = clamp(vMapUv, vec2(${.5 / width}, ${.5 / height}), vec2(${1 - .5 / width}, ${1 - .5 / height}));
  vec4 track = texture2D(map, vec2(glicoUV.x * 0.5, glicoUV.y));
  vec4 rainbow = texture2D(map, vec2(0.5 + glicoUV.x * 0.5, glicoUV.y));
  diffuseColor *= mix(track, rainbow, dotonboriGlicoBlend);
#endif`);
  };
  material.customProgramCacheKey = () => 'dotonbori-glico-led-v1';
  return { material, blend, update: (time: number) => { blend.value = dotonboriGlicoBlend(time); } };
}
