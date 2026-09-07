import type { CSSProperties } from 'react';

import type {
  DesignQRDesignName,
  DesignQRError,
  DesignQRDetailsOptions,
  DesignQRInteractionOptions,
  DesignQRLogoOptions,
  DesignQRThemePreset,
  DesignQRView,
  TreeDesignOptions,
  TreeTheme,
} from '../config/types.ts';

export interface DesignQRHandle {
  /** Changes the live view without remounting the player. */
  setView(view: DesignQRView): void;
  /** Restores the default 3D camera angle and stops automatic rotation. */
  resetRotation(): void;
  /** Sets transient viewing scale (1–3). Requires the `zoom` prop; exports stay at 1x. */
  setZoom(scale: number): void;
  /** Restores the original viewing scale and pan. */
  resetZoom(): void;
  /** Stops renderer animation while preserving the current frame. */
  pause(): void;
  /** Resumes renderer animation after `pause()`. */
  resume(): void;
  /** Exports the current artwork at its original framing, without viewing zoom/pan. */
  exportImage(): Promise<Blob>;
}

export interface DesignQRZoomOptions {
  /** Two-finger touch/trackpad pinch. Defaults to true when zoom is enabled. */
  pinch?: boolean;
  /** Ordinary mouse-wheel/trackpad scrolling zoom. Defaults to false. */
  wheel?: boolean;
}

/** Public React component options for the interactive tree and QR player. */
export interface DesignQRProps {
  /** Text or URL encoded by the QR. */
  value: string;
  /** Visual design adapter. Choose `tree` or the Shibuya `city`. */
  design?: DesignQRDesignName;
  /** Deterministic tree silhouette. */
  tree?: TreeDesignOptions;
  /** Tree preset/custom theme, or `shibuya` for City (custom city themes are not supported). */
  theme?: DesignQRThemePreset | TreeTheme;
  /** Controlled view. Use `defaultView` for uncontrolled usage. */
  view?: DesignQRView;
  /** Initial view for an uncontrolled player. */
  defaultView?: DesignQRView;
  /** Optional title, visible value, responsive text scaling, and QR-card border. */
  details?: DesignQRDetailsOptions;
  /** Pointer, tap, automatic rotation, transition speed, and blur behavior. */
  interaction?: DesignQRInteractionOptions;
  /** Opt-in, toolbar-free viewing zoom (1–3x). Disabled by default; never serialized or exported. */
  zoom?: boolean | DesignQRZoomOptions;
  /** Optional raster artwork that moves from the 3D canopy to QR center. */
  logo?: false | DesignQRLogoOptions;
  /** Removes the full-stage seasonal backdrop while preserving the artwork. */
  transparentBackground?: boolean;
  /** Class applied to the responsive root player. */
  className?: string;
  /** Inline sizing or host-specific visual overrides for the root player. */
  style?: CSSProperties;
  /** Accessible name for the rendered viewer. */
  ariaLabel?: string;
  /** Called when the renderer is ready for interaction. */
  onReady?: () => void;
  /** Called after a user or imperative action requests another view. */
  onViewChange?: (view: DesignQRView) => void;
  /** Reports transient viewing scale changes, including resets. */
  onZoomChange?: (scale: number) => void;
  /** Reports normalized configuration, WebGL, logo-loading, and export errors. */
  onError?: (error: DesignQRError) => void;
}
