import type { DesignQRConfigV1 } from './types.ts';

export const DESIGN_QR_SCHEMA_VERSION = 1 as const;
export const DESIGN_QR_MAX_VALUE_BYTES = 2048;
export const DESIGN_QR_MAX_TITLE_CHARACTERS = 40;
export const DESIGN_QR_MAX_ENCODED_LENGTH = 16_384;

export const DESIGN_QR_BORDER_PADDING_MIN = 4;
export const DESIGN_QR_BORDER_PADDING_MAX = 32;
export const DESIGN_QR_BORDER_PADDING_STEP = 4;
export const DESIGN_QR_BORDER_PADDING_DEFAULT = 16;

export const DESIGN_QR_CANOPY_DENSITY_MIN = 20;
export const DESIGN_QR_CANOPY_DENSITY_MAX = 100;
export const DESIGN_QR_PARTICLE_AMOUNT_MIN = 0;
export const DESIGN_QR_PARTICLE_AMOUNT_MAX = 60;
export const DESIGN_QR_GROUND_LEAVES_AMOUNT_MIN = 0;
export const DESIGN_QR_GROUND_LEAVES_AMOUNT_MAX = 150;

export const DESIGN_QR_DEFAULTS = {
  schemaVersion: DESIGN_QR_SCHEMA_VERSION,
  design: {
    type: 'tree',
    options: {
      shape: 'dome',
      seed: 0.5,
    },
  },
  theme: {
    type: 'preset',
    preset: 'spring',
  },
  view: {
    initial: 'design',
  },
  details: {
    title: '',
    showValue: false,
    border: false,
  },
  interaction: {
    dragToRotate: true,
    tapToToggleView: true,
    autoRotate: false,
    motionBlur: true,
  },
  quality: 'high',
} as const satisfies Omit<DesignQRConfigV1, 'value'>;
