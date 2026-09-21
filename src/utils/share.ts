import {
  DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  decodeDesignQRConfig,
  isCityPreset,
  encodeDesignQRConfig,
  normalizeDesignQRConfig,
  type DesignQRConfigV1,
  type DesignQRInteractionOptions,
  type DesignQRLogoOptions,
  type DesignQRThemePreset,
  type DesignQRCityPreset,
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
  design?: 'tree' | 'city';
  cityPreset?: DesignQRCityPreset;
  season: number;
  viewMode?: '3d' | 'scan';
  title?: string;
  titleScale?: number;
  showContent?: boolean;
  contentScale?: number;
  borderEnabled?: boolean;
  borderPadding?: number;
  transparentBackground?: boolean;
  customTheme?: TreeTheme;
  treeShape?: TreeDesignOptions['shape'];
  interaction?: DesignQRInteractionOptions;
  logo?: false | DesignQRLogoOptions;
}

function presetForSeason(season: number): DesignQRThemePreset {
  const index = Number.isFinite(season)
    ? Math.min(PRESET_BY_SEASON.length - 1, Math.max(0, Math.trunc(season)))
    : 0;
  return PRESET_BY_SEASON[index];
}

function seasonForPreset(preset: DesignQRThemePreset): number {
  const index = PRESET_BY_SEASON.findIndex(name => name === preset);
  return index < 0 ? 0 : index;
}

export function createDesignQRConfig(config: ShareConfig): DesignQRConfigV1 {
  return normalizeDesignQRConfig({
    value: config.url,
    design: config.design === 'city'
      ? { type: 'city' }
      : { type: 'tree', options: { shape: config.treeShape } },
    theme: config.design === 'city' ? config.cityPreset ?? 'shibuya' : config.customTheme
      ? { type: 'custom', value: config.customTheme }
      : presetForSeason(config.season),
    view: config.viewMode === 'scan' ? 'qr' : 'design',
    details: {
      title: config.title,
      titleScale: config.titleScale,
      showValue: config.showContent,
      contentScale: config.contentScale,
      border: config.borderEnabled
        ? { padding: config.borderPadding }
        : false,
    },
    interaction: config.interaction,
    logo: config.logo,
    transparentBackground: config.transparentBackground,
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
  const decoded = decodeDesignQRConfig(encoded);
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
    design: config.design.type,
    ...(config.design.type === 'city' ? { cityPreset: config.theme.type === 'preset'
      && isCityPreset(config.theme.preset) ? config.theme.preset : 'shibuya' as const } : {}),
    season,
    viewMode: config.view.initial === 'qr' ? 'scan' : '3d',
    title: config.details.title,
    titleScale: config.details.titleScale ?? DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
    showContent: config.details.showValue,
    contentScale: config.details.contentScale ?? DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
    borderEnabled: config.details.border !== false,
    borderPadding: config.details.border === false
      ? QR_BORDER_PADDING_DEFAULT
      : config.details.border.padding,
    customTheme,
    treeShape: config.design.type === 'tree' ? config.design.options.shape : undefined,
    interaction: config.interaction,
    logo: config.logo,
    ...(config.transparentBackground === true
      ? { transparentBackground: true }
      : {}),
  };
}
