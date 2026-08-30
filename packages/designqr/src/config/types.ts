export type DesignQRDesignName = 'tree';
export type DesignQRView = 'design' | 'qr';
export type DesignQRThemePreset = 'spring' | 'summer' | 'autumn' | 'winter';
export type DesignQRQuality = 'low' | 'high';

export interface TreeDesignOptions {
  shape?: 'dome' | 'wide' | 'pine';
  seed?: number;
}

export interface TreeTheme {
  foliageColor: string;
  foliageHighlightColor?: string;
  foliageShadowColor?: string;
  foliageMidtoneColor?: string;
  foliageShape?: 'blossom' | 'leaf';
  groundColor: string;
  groundShadowColor?: string;
  groundFeature?: 'grass' | 'snow' | 'none';
  groundFeatureColor?: string;
  groundFeatureHighlightColor?: string;
  groundFeatureShadowColor?: string;
  skyTop: string;
  skyBottom: string;
  titleColor?: string;
  canopyDensity?: number;
  particleType: 'leaf' | 'sakura' | 'fireflies' | 'snow' | 'none';
  particleAmount?: number;
  groundLeavesAmount?: number;
}

export interface DesignQRDetailsOptions {
  title?: string;
  showValue?: boolean;
  border?: false | {
    padding?: number;
  };
}

export interface DesignQRInteractionOptions {
  dragToRotate?: boolean;
  tapToToggleView?: boolean;
  autoRotate?: boolean;
  motionBlur?: boolean;
}

export interface DesignQRConfigInput {
  schemaVersion?: 1;
  value: string;
  design?: DesignQRDesignName | {
    type: DesignQRDesignName;
    options?: TreeDesignOptions;
  };
  tree?: TreeDesignOptions;
  theme?: DesignQRThemePreset
    | TreeTheme
    | DesignQRConfigV1['theme'];
  view?: DesignQRView | {
    initial: DesignQRView;
  };
  defaultView?: DesignQRView;
  details?: DesignQRDetailsOptions;
  interaction?: DesignQRInteractionOptions;
  quality?: DesignQRQuality;
}

export interface DesignQRConfigV1 {
  schemaVersion: 1;
  value: string;
  design: {
    type: 'tree';
    options: Required<TreeDesignOptions>;
  };
  theme:
    | {
        type: 'preset';
        preset: DesignQRThemePreset;
      }
    | {
        type: 'custom';
        value: TreeTheme;
      };
  view: {
    initial: DesignQRView;
  };
  details: {
    title: string;
    showValue: boolean;
    border: false | {
      padding: number;
    };
  };
  interaction: Required<DesignQRInteractionOptions>;
  quality: DesignQRQuality;
}

export type DesignQRErrorCode =
  | 'INVALID_CONFIG'
  | 'UNSUPPORTED_DESIGN'
  | 'QR_GENERATION_FAILED'
  | 'WEBGL_UNAVAILABLE'
  | 'WEBGL_CONTEXT_LOST'
  | 'EXPORT_FAILED';

export interface DesignQRError {
  code: DesignQRErrorCode;
  message: string;
  cause?: unknown;
}

export type Result<TValue, TError> =
  | { ok: true; value: TValue }
  | { ok: false; error: TError };

export class DesignQRConfigError extends Error implements DesignQRError {
  readonly code: DesignQRErrorCode;
  override readonly cause?: unknown;

  constructor(code: DesignQRErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'DesignQRConfigError';
    this.code = code;
    this.cause = cause;
  }
}
