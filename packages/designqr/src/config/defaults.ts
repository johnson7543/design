import type { DesignQRConfigV1 } from './types.ts';
import { VIEW_TRANSITION_SPEED_DEFAULT } from '../designs/tree/constants.ts';

export const DESIGN_QR_SCHEMA_VERSION = 1 as const;
export const DESIGN_QR_MAX_VALUE_BYTES = 2048;
export const DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE = 57;
export const DESIGN_QR_MAX_TITLE_CHARACTERS = 40;
export const DESIGN_QR_MAX_ENCODED_LENGTH = 16_384;
export const DESIGN_QR_LOGO_SIZE_MIN = 0.08;
export const DESIGN_QR_LOGO_SIZE_MAX = 0.2;
export const DESIGN_QR_LOGO_SIZE_DEFAULT = 0.16;
export const DESIGN_QR_LOGO_MAX_SOURCE_CHARACTERS = 8_192;
export const DESIGN_QR_LOGO_MAX_ALT_CHARACTERS = 80;
export const DESIGN_QR_LOGO_MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const DESIGN_QR_BORDER_PADDING_MIN = 4;
export const DESIGN_QR_BORDER_PADDING_MAX = 32;
export const DESIGN_QR_BORDER_PADDING_STEP = 4;
export const DESIGN_QR_BORDER_PADDING_DEFAULT = 16;

export const DESIGN_QR_DETAIL_FONT_SCALE_MIN = 0.75;
export const DESIGN_QR_DETAIL_FONT_SCALE_MAX = 1.5;
export const DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT = 1;
export const DESIGN_QR_DETAIL_FONT_SCALE_STEP = 0.05;

export const DESIGN_QR_CANOPY_DENSITY_MIN = 20;
export const DESIGN_QR_CANOPY_DENSITY_MAX = 100;
export const DESIGN_QR_PARTICLE_AMOUNT_MIN = 0;
export const DESIGN_QR_PARTICLE_AMOUNT_MAX = 60;
export const DESIGN_QR_GROUND_LEAVES_AMOUNT_MIN = 0;
export const DESIGN_QR_GROUND_LEAVES_AMOUNT_MAX = 150;
export const DESIGN_QR_WEATHER_AMOUNT_MIN = 0;
export const DESIGN_QR_WEATHER_AMOUNT_MAX = 300;
export const DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MIN = 0;
export const DESIGN_QR_AMBIENT_PARTICLE_AMOUNT_MAX = 60;
export const DESIGN_QR_SNOWFLAKE_AMOUNT_MIN = 0;
export const DESIGN_QR_SNOWFLAKE_AMOUNT_MAX = 500;

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
    autoRotateDirection: 'clockwise',
    transitionSpeed: VIEW_TRANSITION_SPEED_DEFAULT,
    motionBlur: true,
  },
  logo: false,
  transparentBackground: false,
} as const satisfies Omit<DesignQRConfigV1, 'value'>;
