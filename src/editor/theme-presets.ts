import type { DesignQRThemePreset } from 'designqr/config';

export const THEME_PRESET_OPTIONS = [
  { id: 0, name: 'spring', label: 'Spring' },
  { id: 1, name: 'summer', label: 'Summer' },
  { id: 2, name: 'autumn', label: 'Autumn' },
  { id: 3, name: 'winter', label: 'Winter' },
] as const satisfies ReadonlyArray<{
  id: number;
  name: DesignQRThemePreset;
  label: string;
}>;

/** City presets stay separate from Tree's seasonal/custom-theme selection. */
export const CITY_THEME_PRESET_OPTIONS = [
  { id: 'shibuya', name: 'shibuya', label: '渋谷' },
  { id: 'dotonbori', name: 'dotonbori', label: '道頓堀' },
  { id: 'tokyo-tower', name: 'tokyo-tower', label: '東京タワー' },
] as const satisfies ReadonlyArray<{
  id: DesignQRThemePreset;
  name: DesignQRThemePreset;
  label: string;
}>;
