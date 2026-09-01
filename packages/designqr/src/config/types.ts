export type DesignQRDesignName = 'tree';
export type DesignQRView = 'design' | 'qr';
export type DesignQRThemePreset = 'spring' | 'summer' | 'autumn' | 'winter';
export type AutoRotateDirection = 'clockwise' | 'counterclockwise';
export type TreeFoliageShape = 'blossom' | 'leaf' | 'pixel';
export type TreeGroundFeature = 'grass' | 'pixel' | 'none';
export type TreeParticleType = 'leaf' | 'sakura' | 'fireflies' | 'snow' | 'none';
export type TreeWeatherType = 'rain' | 'none';
export type TreeAmbientParticleType = 'butterflies' | 'fireflies' | 'none';
export type TreeBranchStyle = 'natural' | 'frosted';
export type TreePaletteColors4 = readonly [string, string, string, string];
export type TreePaletteColors5 = readonly [string, string, string, string, string];
export type TreePaletteStops3 = readonly [number, number, number];
export type TreePaletteStops4 = readonly [number, number, number, number];
export type TreePaletteVariations4 = readonly [number, number, number, number];

export interface TreeDesignOptions {
  shape?: 'dome' | 'wide' | 'pine';
  seed?: number;
}

/** Visual roles available to presets and consumer-authored tree themes. */
export interface TreeTheme {
  /** Organic canopy base and optional tonal roles. */
  foliageColor: string;
  foliageHighlightColor?: string;
  foliageShadowColor?: string;
  foliageMidtoneColor?: string;
  foliageShape?: TreeFoliageShape;
  /** Ordered canopy colors and cumulative stops used by the procedural sampler. */
  foliagePaletteColors?: TreePaletteColors5;
  foliagePaletteStops?: TreePaletteStops4;
  foliageColorVariation?: number;
  foliageVerticalLift?: number;
  /** QR-derived voxel and settled scan-face foliage roles. */
  qrFoliageColor?: string;
  qrFoliageHighlightColor?: string;
  qrFoliageShadowColor?: string;
  qrFoliageMidtoneColor?: string;
  qrFoliagePaletteColors?: TreePaletteColors4;
  qrFoliagePaletteStops?: TreePaletteStops3;
  qrFoliageColorVariation?: number;
  blossomCenterColor?: string;
  /** Procedural trunk and branch roles. */
  branchColor?: string;
  branchHighlightColor?: string;
  branchShadowColor?: string;
  branchTipColor?: string;
  branchStyle?: TreeBranchStyle;
  /** Light QR modules, 3D ground, pedestal, and ground-decoration roles. */
  groundColor: string;
  groundShadowColor?: string;
  groundSurfaceColor?: string;
  groundSurfaceShadowColor?: string;
  groundSurfaceVariation?: number;
  groundSurfaceShadowVariation?: number;
  pedestalColor?: string;
  groundFeature?: TreeGroundFeature;
  groundFeatureColor?: string;
  groundFeatureHighlightColor?: string;
  groundFeatureShadowColor?: string;
  /** Four ordered ground-decoration bands; start/end pairs may form gradients. */
  groundFeaturePaletteStartColors?: TreePaletteColors4;
  groundFeaturePaletteEndColors?: TreePaletteColors4;
  groundFeaturePaletteStops?: TreePaletteStops3;
  groundFeaturePaletteVariations?: TreePaletteVariations4;
  /**
   * Finder-pattern roles used while turning and on the settled scan face when
   * ground decor is Grass or Pixel. None keeps finder geometry but uses the QR
   * foliage roles instead.
   */
  qrFinderColor?: string;
  qrFinderHighlightColor?: string;
  qrFinderShadowColor?: string;
  qrFinderEyeColor?: string;
  qrFinderPaletteColors?: TreePaletteColors4;
  qrFinderPaletteStops?: TreePaletteStops3;
  qrFinderColorVariation?: number;
  /** Presentation background and metadata roles. */
  skyTop: string;
  skyBottom: string;
  titleColor?: string;
  /** Density and environmental effect controls. */
  canopyDensity?: number;
  particleType: TreeParticleType;
  particleAmount?: number;
  groundLeavesAmount?: number;
  /** Deterministic layout seed for fallen leaves and petals on the ground. */
  groundLeavesSeed?: number;
  weatherType?: TreeWeatherType;
  weatherAmount?: number;
  weatherColor?: string;
  ambientParticleType?: TreeAmbientParticleType;
  ambientParticleAmount?: number;
  ambientParticleColor?: string;
  snowflakeAmount?: number;
  snowflakeColor?: string;
}

/** The renderer-ready form returned by `resolveTreeTheme`. */
export interface ResolvedTreeTheme extends TreeTheme {
  foliageHighlightColor: string;
  foliageShadowColor: string;
  foliageMidtoneColor: string;
  foliageShape: TreeFoliageShape;
  foliagePaletteColors: TreePaletteColors5;
  foliagePaletteStops: TreePaletteStops4;
  foliageColorVariation: number;
  foliageVerticalLift: number;
  qrFoliageColor: string;
  qrFoliageHighlightColor: string;
  qrFoliageShadowColor: string;
  qrFoliageMidtoneColor: string;
  qrFoliagePaletteColors: TreePaletteColors4;
  qrFoliagePaletteStops: TreePaletteStops3;
  qrFoliageColorVariation: number;
  blossomCenterColor: string;
  branchColor: string;
  branchHighlightColor: string;
  branchShadowColor: string;
  branchTipColor: string;
  branchStyle: TreeBranchStyle;
  groundShadowColor: string;
  groundSurfaceColor: string;
  groundSurfaceShadowColor: string;
  groundSurfaceVariation: number;
  groundSurfaceShadowVariation: number;
  pedestalColor: string;
  groundFeature: TreeGroundFeature;
  groundFeatureColor: string;
  groundFeatureHighlightColor: string;
  groundFeatureShadowColor: string;
  groundFeaturePaletteStartColors: TreePaletteColors4;
  groundFeaturePaletteEndColors: TreePaletteColors4;
  groundFeaturePaletteStops: TreePaletteStops3;
  groundFeaturePaletteVariations: TreePaletteVariations4;
  qrFinderColor: string;
  qrFinderHighlightColor: string;
  qrFinderShadowColor: string;
  qrFinderEyeColor: string;
  qrFinderPaletteColors: TreePaletteColors4;
  qrFinderPaletteStops: TreePaletteStops3;
  qrFinderColorVariation: number;
  titleColor: string;
  canopyDensity: number;
  particleAmount: number;
  groundLeavesAmount: number;
  groundLeavesSeed: number;
  weatherType: TreeWeatherType;
  weatherAmount: number;
  weatherColor: string;
  ambientParticleType: TreeAmbientParticleType;
  ambientParticleAmount: number;
  ambientParticleColor: string;
  snowflakeAmount: number;
  snowflakeColor: string;
}

export interface DesignQRDetailsOptions {
  /** Optional title rendered below the QR. */
  title?: string;
  /** Shows `value` below the title. */
  showValue?: boolean;
  /** Groups QR, title, and value in one padded border; `false` removes it. */
  border?: false | {
    /** Space between the border and its grouped contents, in CSS pixels. */
    padding?: number;
  };
}

export interface DesignQRInteractionOptions {
  /** Allows pointer dragging in 3D. */
  dragToRotate?: boolean;
  /** Allows tapping the artwork to toggle between views. */
  tapToToggleView?: boolean;
  /** Rotates the 3D view automatically. */
  autoRotate?: boolean;
  /** Direction used only by automatic rotation. */
  autoRotateDirection?: AutoRotateDirection;
  /** Multiplier applied to the animated 3D/2D view transition. */
  transitionSpeed?: number;
  /** Adds presentation blur during the 3D/2D turn. */
  motionBlur?: boolean;
}

/** Optional raster artwork that travels with the tree-to-QR transition. */
export interface DesignQRLogoOptions {
  /** Browser-fetchable raster path, imported asset URL, HTTPS URL, or data URL. */
  src: string;
  /** Accessible description used when the component has no explicit ariaLabel. */
  alt?: string;
  /** Longest logo edge as a fraction of the QR width. Values use a safe range. */
  size?: number;
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
  logo?: false | DesignQRLogoOptions;
  /** Removes the full-stage seasonal backdrop while preserving the artwork. */
  transparentBackground?: boolean;
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
  logo: false | Required<DesignQRLogoOptions>;
  /** Removes the package-owned stage background; canonical encoders omit `false`. */
  transparentBackground?: boolean;
}

export type DesignQRErrorCode =
  | 'INVALID_CONFIG'
  | 'UNSUPPORTED_DESIGN'
  | 'QR_GENERATION_FAILED'
  | 'LOGO_LOAD_FAILED'
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
