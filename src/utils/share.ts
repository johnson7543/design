import {
  decodeCompatibleDesignQRConfig,
  encodeDesignQRConfig,
  normalizeDesignQRConfig,
  type DesignQRConfigV1,
  type DesignQRInteractionOptions,
  type DesignQRQuality,
  type DesignQRThemePreset,
  type TreeDesignOptions,
  type TreeTheme,
} from 'designqr/config';
import { QR_BORDER_PADDING_DEFAULT } from 'designqr/editor';

const PRESET_BY_SEASON = [
  'spring',
  'summer',
  'autumn',
  'winter',
] as const satisfies ReadonlyArray<DesignQRThemePreset>;

export interface ShareConfig {
  url: string;
  season: number;
  palette: number;
  viewMode?: '3d' | 'scan';
  /** Legacy master-details flag; retained only while decoding older links. */
  detailsEnabled?: boolean;
  title?: string;
  showContent?: boolean;
  borderEnabled?: boolean;
  borderPadding?: number;
  customTheme?: TreeTheme;
  treeShape?: TreeDesignOptions['shape'];
  interaction?: DesignQRInteractionOptions;
  quality?: DesignQRQuality;
}

function presetForSeason(season: number): DesignQRThemePreset {
  const index = Number.isFinite(season)
    ? Math.min(PRESET_BY_SEASON.length - 1, Math.max(0, Math.trunc(season)))
    : 0;
  return PRESET_BY_SEASON[index];
}

function seasonForPreset(preset: DesignQRThemePreset): number {
  const index = PRESET_BY_SEASON.indexOf(preset);
  return index < 0 ? 0 : index;
}

export function createDesignQRConfig(config: ShareConfig): DesignQRConfigV1 {
  return normalizeDesignQRConfig({
    value: config.url,
    design: {
      type: 'tree',
      options: {
        shape: config.treeShape,
      },
    },
    theme: config.customTheme
      ? { type: 'custom', value: config.customTheme }
      : presetForSeason(config.season),
    view: config.viewMode === 'scan' ? 'qr' : 'design',
    details: {
      title: config.title,
      showValue: config.showContent,
      border: config.borderEnabled
        ? { padding: config.borderPadding }
        : false,
    },
    interaction: config.interaction,
    quality: config.quality,
  });
}

export function encodeShareConfig(config: ShareConfig): string {
  try {
    return encodeDesignQRConfig(createDesignQRConfig(config));
  } catch {
    return '';
  }
}

export function decodeShareConfig(encoded: string): ShareConfig | null {
  const decoded = decodeCompatibleDesignQRConfig(encoded);
  if (!decoded.ok) return null;

  const config = decoded.value;
  const customTheme = config.theme.type === 'custom'
    ? config.theme.value
    : undefined;
  const season = config.theme.type === 'preset'
    ? seasonForPreset(config.theme.preset)
    : 0;

  return {
    url: config.value,
    season,
    palette: 0,
    viewMode: config.view.initial === 'qr' ? 'scan' : '3d',
    detailsEnabled: false,
    title: config.details.title,
    showContent: config.details.showValue,
    borderEnabled: config.details.border !== false,
    borderPadding: config.details.border === false
      ? QR_BORDER_PADDING_DEFAULT
      : config.details.border.padding,
    customTheme,
    treeShape: config.design.options.shape,
    interaction: config.interaction,
    quality: config.quality,
  };
}
