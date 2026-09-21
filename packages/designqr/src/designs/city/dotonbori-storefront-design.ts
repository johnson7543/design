import type { DotonboriFront } from './dotonbori-facade-layout.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { cityNoise } from './building-variation.ts';

export type DotonboriShopKind = 'takoyaki' | 'dining' | 'sweets' | 'cafe' | 'restaurant' | 'retail' | 'commercial' | 'lobby' | 'shutter' | 'service';
export type DotonboriShopBay = 'entry' | 'counter' | 'cabinet' | 'seating' | 'shelf' | 'glazing' | 'mannequin' | 'rail' | 'folded' | 'directory' | 'bench' | 'shutter' | 'service' | 'tank';

function frontageHash(text: string) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** One coordinated frontage, not one shop cloned into every window. These
 * identities describe original miniature layouts, not surveyed tenant units.
 * Known corner hosts share finishes; QR input varies the display arrangement. */
export function dotonboriShopDesign(front: DotonboriFront, kind: DotonboriShopKind, count: number, width: number, entrance: boolean) {
  const identity = `${front.building}:${kind}`, identitySeed = frontageHash(identity);
  const seed = frontageHash(front.id) ^ (front.context?.seed ?? 0), noise = (salt: number) => cityNoise(salt, seed);
  const finish = identitySeed % 4, artVariant = Math.floor(identitySeed / 4) % 4;
  const accent = kind === 'restaurant' ? S.charcoal : kind === 'retail' ? [P.dark, P.metal, S.blue, P.stone][finish]
    : [S.coral, S.blue, P.dark, S.gold][finish];
  const frame = [P.metal, S.charcoal, P.stone, P.dark][finish];
  const entry = entrance ? (count <= 2 ? count - 1 : noise(17) < .5 ? 1 : count - 2) : -1;
  const patterns: Record<DotonboriShopKind, DotonboriShopBay[]> = {
    takoyaki: ['counter', 'cabinet', 'glazing', 'shelf'], dining: ['counter', 'seating', 'glazing', 'shelf'],
    sweets: ['cabinet', 'shelf', 'glazing', 'seating'], cafe: ['counter', 'seating', 'shelf', 'glazing', 'cabinet', 'seating'],
    restaurant: ['seating', 'glazing', 'seating'], retail: ['mannequin', 'rail', 'folded', 'glazing'],
    commercial: ['glazing', 'directory', 'service', 'glazing', 'bench'], lobby: ['directory', 'bench', 'glazing'],
    shutter: ['shutter', 'service', 'shutter'], service: ['service', 'glazing'],
  };
  const weights = Array.from({ length: count }, (_, i) => i === entry ? .82 : .80 + noise(i * 31 + 43) * .65);
  const total = weights.reduce((a, b) => a + b, 0), pattern = patterns[kind];
  let cursor = -width / 2, index = 0;
  const bays = weights.map((weight, i) => {
    const span = width * weight / total, x = cursor + span / 2; cursor += span;
    let role: DotonboriShopBay = i === entry ? 'entry' : pattern[index++ % pattern.length];
    if (kind === 'restaurant' && front.id === 'B046-west') role = i === 0 ? 'tank' : 'seating';
    // Tiny alley faces keep fittings proportional to the actual available span.
    if (span < 1.2 && !['entry', 'service', 'shutter'].includes(role)) role = 'glazing';
    return { x, width: span, role, variation: noise(i * 73 + 91) };
  });
  return { identity, finish, artVariant, accent, frame, bays, entry,
    frameWidth: .05 + noise(31) * .04, fasciaHeight: .28 + noise(59) * .08,
    fasciaInset: finish === 0 ? 0 : width * (.06 + noise(67) * .17),
    // The full descriptor can be audited without treating a facade section as a tenant.
    layoutKey: `${front.id}:${seed >>> 0}:${finish}:${artVariant}` };
}
