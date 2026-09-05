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
  /** Stops renderer animation while preserving the current frame. */
  pause(): void;
  /** Resumes renderer animation after `pause()`. */
  resume(): void;
  /** Exports the exact presentation canvas currently shown to the user. */
  exportImage(): Promise<Blob>;
}

/** Public React component options for the interactive tree and QR player. */
export interface DesignQRProps {
  /** Text or URL encoded by the QR. */
  value: string;
  /** Visual design adapter. Only `tree` is currently available. */
  design?: DesignQRDesignName;
  /** Deterministic tree silhouette and seed. */
  tree?: TreeDesignOptions;
  /** Built-in preset name or a complete/partial custom tree theme. */
  theme?: DesignQRThemePreset | TreeTheme;
  /** Controlled view. Use `defaultView` for uncontrolled usage. */
  view?: DesignQRView;
  /** Initial view for an uncontrolled player. */
  defaultView?: DesignQRView;
  /** Optional title, visible value, responsive text scaling, and QR-card border. */
  details?: DesignQRDetailsOptions;
  /** Pointer, tap, automatic rotation, transition speed, and blur behavior. */
  interaction?: DesignQRInteractionOptions;
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
  /** Reports normalized configuration, WebGL, logo-loading, and export errors. */
  onError?: (error: DesignQRError) => void;
}
