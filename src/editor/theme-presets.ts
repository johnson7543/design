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
