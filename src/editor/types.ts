import type { TreeTheme } from 'designqr/config';
import type { TreeShapeStyle } from 'designqr/editor';

/** Saved-theme metadata owned by the editor, never by the public renderer config. */
export interface CustomTheme extends TreeTheme {
  id: string;
  label: string;
  isCustom: true;
  treeShape?: TreeShapeStyle;
}
