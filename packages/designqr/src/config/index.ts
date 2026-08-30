export {
  DESIGN_QR_BORDER_PADDING_DEFAULT,
  DESIGN_QR_BORDER_PADDING_MAX,
  DESIGN_QR_BORDER_PADDING_MIN,
  DESIGN_QR_BORDER_PADDING_STEP,
  DESIGN_QR_DEFAULTS,
  DESIGN_QR_MAX_ENCODED_LENGTH,
  DESIGN_QR_MAX_TITLE_CHARACTERS,
  DESIGN_QR_MAX_VALUE_BYTES,
  DESIGN_QR_SCHEMA_VERSION,
} from './defaults.ts';
export { decodeDesignQRConfig, encodeDesignQRConfig } from './codec.ts';
export {
  decodeCompatibleDesignQRConfig,
  decodeLegacyDesignQRConfig,
} from './legacy.ts';
export {
  normalizeDesignQRConfig,
  normalizeHexColor,
  parseDesignQRConfig,
} from './normalize.ts';
export type {
  DesignQRConfigV1,
  DesignQRConfigInput,
  DesignQRDesignName,
  DesignQRDetailsOptions,
  DesignQRError,
  DesignQRErrorCode,
  DesignQRInteractionOptions,
  DesignQRQuality,
  DesignQRThemePreset,
  DesignQRView,
  Result,
  TreeDesignOptions,
  TreeTheme,
} from './types.ts';
export { DesignQRConfigError } from './types.ts';
