import type {
  DesignQRThemePreset,
  TreeTheme,
} from '../../config/types.ts';

export const TREE_PRESET_TITLE_COLORS: Readonly<Record<DesignQRThemePreset, string>> = {
  spring: '#98596E',
  summer: '#00785E',
  autumn: '#BD3528',
  winter: '#577A9E',
};

export const TREE_NEUTRAL_TITLE_COLOR = '#3F352B';

export function resolveTreeTitleColor(
  theme: { type: 'preset'; preset: DesignQRThemePreset } | { type: 'custom'; value: TreeTheme }
): string {
  if (theme.type === 'preset') {
    return TREE_PRESET_TITLE_COLORS[theme.preset] ?? TREE_NEUTRAL_TITLE_COLOR;
  }

  return theme.value.titleColor
    ?? theme.value.foliageShadowColor
    ?? theme.value.foliageColor
    ?? TREE_NEUTRAL_TITLE_COLOR;
}
