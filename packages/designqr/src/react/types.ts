import type { CSSProperties } from 'react';

import type {
  DesignQRDesignName,
  DesignQRError,
  DesignQRDetailsOptions,
  DesignQRInteractionOptions,
  DesignQRQuality,
  DesignQRThemePreset,
  DesignQRView,
  TreeDesignOptions,
  TreeTheme,
} from '../config/types.ts';

export interface DesignQRHandle {
  setView(view: DesignQRView): void;
  resetRotation(): void;
  pause(): void;
  resume(): void;
  exportImage(): Promise<Blob>;
}

export interface DesignQRProps {
  value: string;
  design?: DesignQRDesignName;
  tree?: TreeDesignOptions;
  theme?: DesignQRThemePreset | TreeTheme;
  view?: DesignQRView;
  defaultView?: DesignQRView;
  details?: DesignQRDetailsOptions;
  interaction?: DesignQRInteractionOptions;
  quality?: DesignQRQuality;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onReady?: () => void;
  onViewChange?: (view: DesignQRView) => void;
  onError?: (error: DesignQRError) => void;
}
