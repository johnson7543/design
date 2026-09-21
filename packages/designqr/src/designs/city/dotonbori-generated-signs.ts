import { BufferGeometry, CanvasTexture, Float32BufferAttribute, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';
import { mergeDotonboriGeometry, tagDotonboriBuilding, type DotonboriFragment } from './dotonbori-ownership.ts';
import { CITY_SIGN_DESIGNS, paintCitySign, type CitySignDesign } from './sign-artwork.ts';
import { OSAKA_NIGHT_SWATCHES as P } from './palette.ts';
import type { DotonboriGeneratedPanel } from './dotonbori-buildings.ts';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import type { CityFacadePanel } from './architecture.ts';
import { fitDotonboriPanel, frontPoint, libraryDotonboriFronts, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { contentVariation } from '../content-variation.ts';
import { cityNoise } from './building-variation.ts';
import { paintDotonboriLabel } from './dotonbori-lettering.ts';
import { DOTONBORI_LETTERING } from './dotonbori-lettering-data.ts';
import { paintCitySignText } from './sign-rendering.ts';
import { cityEase } from './morph.ts';

export const DOTONBORI_MORPH_SIGN_IDS = ['dotonbori-B031-screen-0', 'dotonbori-B031-screen-1'] as const;

/** Original campaigns, with QR-selected opening artwork. Independent holds
 * and slow crossfades are presentation timing, not a real advertising feed. */
export function dotonboriCampaignFrame(time: number, screen: number, design: number) {
  const duration = screen === 0 ? 10 : 13, fade = screen === 0 ? 2 : 2.2;
  const phase = Math.max(0, time) % (duration * 3), slot = Math.floor(phase / duration);
  const sequence = screen === 0 ? [0, 5, 9] : [0, 3, 8];
  return [(design + sequence[slot]) % 14, (design + sequence[(slot + 1) % 3]) % 14,
    cityEase(phase % duration, duration - fade, duration)] as const;
}

/** The two photographed blue screens can carry original QR-selected campaigns.
 * Letterbox the shared 2:1 artwork inside their fixed 13.3 × 7.3 m frames. */
export function dotonboriReferenceCampaigns(library: DotonboriLibrary, modules: readonly (readonly boolean[])[], fronts = libraryDotonboriFronts(library) as readonly DotonboriFront[]): DotonboriGeneratedPanel[] {
  const front = fronts.find(f => f.id === 'B031-west'); if (!front) return [];
  const seed = contentVariation(modules), size = library.layout.tileSizeM;
  return [25.7, 13.6].flatMap((y, i) => {
    const fit = fitDotonboriPanel(front, y, 13.3, 7.3); if (!fit) return [];
    return [{ id: DOTONBORI_MORPH_SIGN_IDS[i], building: front.building,
      position: frontPoint(front, 0, fit.y, .50), width: fit.width / size, height: fit.width / size / 2,
      angle: front.yaw, design: Math.floor(cityNoise(i ? 113 : 107, seed) * 14) }];
  });
}

/** Original QR artwork, not an inventory of real Osaka businesses. Use the
 * same sign layouts and proportion-preserving lettering painter as Shibuya. */
export const DOTONBORI_GENERATED_SIGN_DESIGNS: readonly CitySignDesign[] = CITY_SIGN_DESIGNS.map((design, i) => ({
  ...design, layout: design.layout === 'vertical' ? 'cafe' : design.layout === 'tenants' ? 'lightbox' : design.layout,
  background: [P.navy, P.ivory, P.blue, P.blue, P.navy, P.highRise, P.charcoal][i % 7],
  ink: [1, 5].includes(i % 7) ? P.navy : P.ivory,
  accent: i % 3 === 0 ? P.coral : P.gold, secondary: P.bay,
  label: ['大阪', '川辺の夜', 'カラオケ', '道頓堀', '音楽', '夜の街', '珈琲', '空', '読書', '未来', '水辺', '夜景', 'お食事', '遊び'][i],
  caption: ['CITY LIGHTS', 'ALONG THE CANAL', 'SING / PLAY', 'NIGHT VISION', 'LIVE / RECORDS', 'OPEN ALL NIGHT', 'ROAST / BREW',
    'ABOVE THE CITY', 'READ / DISCOVER', 'DESIGN / FUTURE', 'SHOP / CAFE', 'BAR / LOUNGE', 'DINING', 'ARCADE / GAMES'][i],
}));

export function paintDotonboriGeneratedSigns(ctx: CanvasRenderingContext2D) {
  const tile = document.createElement('canvas'); tile.width = 512; tile.height = 256;
  const context = tile.getContext('2d'); if (!context) return;
  const lettering: typeof paintCitySignText = (ctx, label, x, y, height, width, color, font) => {
    if (DOTONBORI_LETTERING[label]) {
      ctx.fillStyle = color; paintDotonboriLabel(ctx, label, x, y, width, height);
    } else paintCitySignText(ctx, label, x, y, height, width, color, font);
  };
  for (const [i, design] of DOTONBORI_GENERATED_SIGN_DESIGNS.entries()) {
    paintCitySign(context, design, false, lettering);
    ctx.drawImage(tile, i % 4 * 512, Math.floor(i / 4) * 256);
  }
}

/** A private, immutable atlas survives live edits. Only panel UVs/positions
 * change; a content update adds no texture allocation, asset fetch or actor. */
export class DotonboriGeneratedSigns {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  readonly fragments: DotonboriFragment[] = [];
  readonly morphSigns: { sourceBuilding: string; panel: CityFacadePanel; mesh: Mesh<BufferGeometry, MeshBasicMaterial>; uvRect: readonly [number, number, number, number] }[] = [];
  private readonly campaigns = { value: [new Vector3(), new Vector3()] };
  private readonly designs = [0, 0];
  constructor() {
    let map: CanvasTexture | undefined;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
      const context = canvas.getContext('2d');
      if (context) { paintDotonboriGeneratedSigns(context); map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 2; }
    }
    this.mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ ...(map ? { map } : { color: P.blue }), transparent: true }));
    this.mesh.name = 'dotonbori-qr-generated-signs';
    const material = this.mesh.material;
    material.userData.dotonboriCampaignFrames = this.campaigns;
    material.onBeforeCompile = shader => {
      shader.uniforms.dotonboriCampaignFrames = this.campaigns;
      shader.vertexShader = 'attribute vec3 dotonboriCampaign; varying vec3 vDotonboriCampaign;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvDotonboriCampaign = dotonboriCampaign;');
      shader.fragmentShader = 'uniform vec3 dotonboriCampaignFrames[2]; varying vec3 vDotonboriCampaign;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 campaignColor = texture2D(map, vMapUv);
  if (vDotonboriCampaign.x > 0.5) {
    vec3 frame = dotonboriCampaignFrames[int(vDotonboriCampaign.x - 0.5)];
    vec2 localUV = clamp(vDotonboriCampaign.yz, vec2(${.5 / 512}, ${.5 / 256}), vec2(${1 - .5 / 512}, ${1 - .5 / 256}));
    vec2 fromUV = (vec2(mod(frame.x, 4.0), 3.0 - floor(frame.x / 4.0)) + localUV) / 4.0;
    vec2 toUV = (vec2(mod(frame.y, 4.0), 3.0 - floor(frame.y / 4.0)) + localUV) / 4.0;
    campaignColor = mix(texture2D(map, fromUV), texture2D(map, toUV), frame.z);
  }
  diffuseColor *= campaignColor;
#endif`);
    };
    material.customProgramCacheKey = () => 'dotonbori-campaign-screens-v1';
  }

  updateTime(time: number) {
    this.campaigns.value.forEach((frame, screen) => frame.set(...dotonboriCampaignFrame(time, screen, this.designs[screen])));
  }

  update(panels: readonly DotonboriGeneratedPanel[]) {
    const parts: PlaneGeometry[] = []; this.fragments.length = 0; this.morphSigns.length = 0;
    for (const panel of panels) {
      const { position: p, width, height, angle, design, id } = panel;
      const geometry = new PlaneGeometry(width, height).rotateY(angle).translate(p.x, p.y, p.z);
      tagDotonboriBuilding(geometry, panel.building);
      const uv = geometry.getAttribute('uv');
      const screen = DOTONBORI_MORPH_SIGN_IDS.findIndex(retained => retained === id);
      const campaign = new Float32Array(uv.count * 3);
      for (let i = 0; i < uv.count; i++) campaign.set([screen + 1, uv.getX(i), uv.getY(i)], i * 3);
      geometry.setAttribute('dotonboriCampaign', new Float32BufferAttribute(campaign, 3));
      if (screen >= 0) this.designs[screen] = design;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + design % 4) / 4, (uv.getY(i) + 3 - Math.floor(design / 4)) / 4);
      parts.push(geometry);
      if (DOTONBORI_MORPH_SIGN_IDS.some(retained => retained === id)) {
        const path = [-1, 1].map(side => ({ x: p.x + Math.cos(angle) * width * side / 2, z: p.z - Math.sin(angle) * width * side / 2 }));
        this.morphSigns.push({ sourceBuilding: panel.building, panel: { id, path, y: p.y, width, height, design }, mesh: this.mesh,
          uvRect: [design % 4 / 4, (3 - Math.floor(design / 4)) / 4, (design % 4 + 1) / 4, (4 - Math.floor(design / 4)) / 4] });
      }
      const artwork = DOTONBORI_GENERATED_SIGN_DESIGNS[design];
      for (const side of [-1, 1]) this.fragments.push({ x: p.x + Math.cos(angle) * width * side / 4, y: p.y,
        z: p.z - Math.sin(angle) * width * side / 4, width: width / 2, height, depth: .001, angle,
        color: side < 0 ? artwork.background : artwork.ink, kind: 'sign', group: id, sourceBuilding: panel.building, id: `${id}-${side}` });
    }
    const previous = this.mesh.geometry;
    this.mesh.geometry = mergeDotonboriGeometry(parts);
    this.mesh.visible = parts.length > 0;
    parts.forEach(p => p.dispose()); previous.dispose();
  }
}
