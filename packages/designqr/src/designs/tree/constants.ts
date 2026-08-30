export const BLOCK_SIZE = 0.0245; // voxel cube dimension
export const QR_VISUAL_REFERENCE_GRID_SIZE = 25;
export const TREE_RADIUS_RATIO = 0.46; // Tree canopy covers ~90% of QR code for broad foliage projection
export const MAX_BLOCK_BUFFER = 67240; // 0x106a8

// Shared scan-camera values keep the WebGL QR and its HTML details frame aligned.
export const QR_SCAN_DESKTOP_VERTICAL_FOV = 42;
export const QR_SCAN_MOBILE_HORIZONTAL_FOV = 23;
export const QR_SCAN_DESKTOP_DISTANCE = 2.4;
export const QR_SCAN_MOBILE_DISTANCE = 2.2;

// The 1x baseline matches the former 1.5x timing: 1.25s / 1.5 = 5/6s.
export const VIEW_TRANSITION_DURATION_SECONDS = 5 / 6;
export const VIEW_TRANSITION_SPEED_MIN = 0.25;
export const VIEW_TRANSITION_SPEED_MAX = 2;
export const VIEW_TRANSITION_SPEED_STEP = 0.25;
export const VIEW_TRANSITION_SPEED_DEFAULT = 1;

export const QR_BORDER_PADDING_MIN = 4;
export const QR_BORDER_PADDING_MAX = 32;
export const QR_BORDER_PADDING_STEP = 4;
export const QR_BORDER_PADDING_DEFAULT = 16;

export const TreeBlockType = {
  Dirt: 0,
  CherryBlossom: 1, // Foliage / Blossom
  Trunk: 2,
  Grass: 3,
  FallenPetals: 4,
  Branch: 5,
} as const;

export type TreeBlockType = (typeof TreeBlockType)[keyof typeof TreeBlockType];

export interface SeasonTheme {
  id: number;
  label: string;
  name: 'spring' | 'summer' | 'autumn' | 'winter';
  skyTop: [number, number, number];
  skyBottom: [number, number, number];
  foliageHex: string;
  titleHex: string;
  grassColor: [number, number, number];
  dirtColor: [number, number, number];
}

export interface SeasonEnvironmentConfig {
  id: number;
  name: 'spring' | 'summer' | 'autumn' | 'winter';
  canopyDensity: number;
  fallingLeavesCount: number;
  fallingLeafType: 'sakura' | 'leaf' | 'none';
  groundLeafCoverage: number;
  groundLeafCount: number;
  butterflyCount: number;
  butterflyColor: number;
  snowflakesCount: number;
}

export const SEASON_ENV_CONFIGS: Record<number, SeasonEnvironmentConfig> = {
  0: {
    id: 0,
    name: 'spring',
    canopyDensity: 1.0,
    fallingLeavesCount: 16,
    fallingLeafType: 'sakura',
    groundLeafCoverage: 0.24,
    groundLeafCount: 44,
    butterflyCount: 0,
    butterflyColor: 0xffedf4,
    snowflakesCount: 0,
  },
  1: {
    id: 1,
    name: 'summer',
    canopyDensity: 1.0,
    fallingLeavesCount: 0,
    fallingLeafType: 'none',
    groundLeafCoverage: 0.08,
    groundLeafCount: 16,
    butterflyCount: 6,
    butterflyColor: 0x88eeff,
    snowflakesCount: 0,
  },
  2: {
    id: 2,
    name: 'autumn',
    canopyDensity: 1.0,
    fallingLeavesCount: 60,
    fallingLeafType: 'leaf',
    groundLeafCoverage: 0.45,
    groundLeafCount: 80,
    butterflyCount: 0,
    butterflyColor: 0xffedf4,
    snowflakesCount: 0,
  },
  3: {
    id: 3,
    name: 'winter',
    canopyDensity: 1.0,
    fallingLeavesCount: 0,
    fallingLeafType: 'none',
    groundLeafCoverage: 0.0,
    groundLeafCount: 0,
    butterflyCount: 0,
    butterflyColor: 0xffedf4,
    snowflakesCount: 300,
  },
};

export const SEASONS: SeasonTheme[] = [
  {
    id: 0,
    label: 'Spring',
    name: 'spring',
    skyTop: [0.965, 0.885, 0.835],
    skyBottom: [0.945, 0.804, 0.741],
    foliageHex: '#f4b4cf',
    titleHex: '#98596e',
    grassColor: [0.525, 0.714, 0.408],
    dirtColor: [0.945, 0.804, 0.741],
  },
  {
    id: 1,
    label: 'Summer',
    name: 'summer',
    skyTop: [246 / 255, 244 / 255, 216 / 255],
    skyBottom: [216 / 255, 222 / 255, 138 / 255],
    foliageHex: '#02983b',
    titleHex: '#00785e',
    grassColor: [154 / 255, 204 / 255, 130 / 255],
    dirtColor: [246 / 255, 244 / 255, 216 / 255],
  },
  {
    id: 2,
    label: 'Autumn',
    name: 'autumn',
    skyTop: [248 / 255, 240 / 255, 236 / 255],
    skyBottom: [244 / 255, 164 / 255, 88 / 255],
    foliageHex: '#e2451e',
    titleHex: '#bd3528',
    grassColor: [158 / 255, 140 / 255, 115 / 255],
    dirtColor: [248 / 255, 240 / 255, 236 / 255],
  },
  {
    id: 3,
    label: 'Winter',
    name: 'winter',
    skyTop: [0.95, 0.96, 0.98],
    skyBottom: [0.96, 0.97, 0.985],
    foliageHex: '#d8e5f0',
    titleHex: '#577a9e',
    grassColor: [0.75, 0.82, 0.86],
    dirtColor: [0.96, 0.97, 0.985],
  },
];

export type TreeShapeStyle = 'dome' | 'wide' | 'pine';

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}
