/** Original GLB authoring swatches. Validate source assets independently of runtime paint. */
export const OSAKA_NIGHT_SWATCHES = Object.freeze({
  eveningSky: '#809dca', highRise: '#cddbe4', blue: '#436ea4',
  gold: '#eed883', bay: '#759db0', navy: '#1f3a52',
  charcoal: '#605b53', coral: '#ea6157', ivory: '#e8ddcf',
});

const S = OSAKA_NIGHT_SWATCHES;

/** Preserve the authoring inputs when regenerating existing landmark geometry. */
export const SHIBUYA_ASSET_SOURCE_PALETTE = Object.freeze({
  asphalt: S.navy, concrete: S.highRise, stone: S.ivory,
  glass: S.blue, glassLight: S.bay, roof: S.charcoal,
  ink: S.navy, paper: S.ivory, coolLight: S.highRise, warmLight: S.gold, windowLight: S.gold,
  blue: S.blue, coral: S.coral,
  foliage: S.bay, foliageHighlight: S.gold,
  transitStripe: S.blue, signalGo: S.blue,
  sky: S.eveningSky, dusk: S.ivory,
});

/** 青の朝: user-supplied Blue Period direction, plus cool white and small city accents. */
export const BLUE_MORNING_SWATCHES = Object.freeze({
  blue: '#4a7fa7', shadow: '#29445f', mist: '#a9cdd9', white: '#f5faff',
  gold: S.gold, coral: S.coral,
});

/** Blend approved sRGB bases in linear light without importing the 3D renderer. */
export function mixCityColor(from: string, to: string, amount: number): string {
  const linear = (hex: string, offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  };
  return '#' + [1, 3, 5].map(offset => {
    const a = linear(from, offset), b = linear(to, offset);
    const value = a + (b - a) * amount;
    const srgb = value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;
    return Math.round(srgb * 255).toString(16).padStart(2, '0');
  }).join('');
}

const M = BLUE_MORNING_SWATCHES;

/** One semantic palette for procedural surfaces, imported materials, signs and QR output. */
export const SHIBUYA_PALETTE = Object.freeze({
  asphalt: mixCityColor(M.shadow, M.blue, .22),
  asphaltLight: mixCityColor(M.shadow, M.mist, .18),
  pavement: mixCityColor(M.blue, M.mist, .82),
  roadPaint: mixCityColor(M.mist, M.white, .40),
  roadAccent: mixCityColor(M.shadow, M.blue, .48),
  roadEdge: mixCityColor(M.mist, M.gold, .22),
  concrete: mixCityColor(M.blue, M.mist, .62),
  stone: mixCityColor(M.mist, M.white, .26),
  glass: M.blue, glassLight: mixCityColor(M.blue, M.mist, .36),
  roof: mixCityColor(M.shadow, M.blue, .15),
  ink: M.shadow, paper: M.white, coolLight: M.mist,
  qrBlue: mixCityColor(M.shadow, M.blue, .72),
  qrSlate: mixCityColor(M.shadow, M.mist, .12),
  qrWarm: mixCityColor(M.shadow, mixCityColor(M.gold, M.coral, .55), .14),
  qrPaper: mixCityColor(M.mist, M.white, .82),
  windowLight: mixCityColor(M.mist, M.white, .40), warmLight: M.gold,
  blue: M.blue, coral: M.coral,
  foliage: mixCityColor(M.blue, M.shadow, .25),
  foliageHighlight: mixCityColor(M.blue, M.mist, .45),
  transitStripe: M.blue, signalGo: M.blue,
  sky: M.mist, dusk: mixCityColor(M.mist, M.white, .70),
});

export type ShibuyaPalette = Readonly<Record<keyof typeof SHIBUYA_PALETTE, string>>;

/** GLB roles survive loading; their embedded legacy swatches never choose runtime colors. */
export const CITY_ASSET_PALETTE_ROLES = Object.freeze({
  'vehicle-body': 'paper', glass: 'glass', glassLight: 'glassLight', metal: 'concrete',
  ink: 'ink', light: 'warmLight', gold: 'windowLight', coral: 'coral',
  ivory: 'stone', blue: 'blue', roof: 'roof', sky: 'coolLight',
} as const satisfies Record<string, keyof ShibuyaPalette>);

export type CityAssetPaletteRole = keyof typeof CITY_ASSET_PALETTE_ROLES;
