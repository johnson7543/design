import { DESIGN_QR_DEFAULTS } from '../../config/defaults.ts';
import type { TreeDesignOptions } from '../../config/types.ts';

export interface TreeDesignAdapter {
  readonly type: 'tree';
  readonly defaultOptions: Required<TreeDesignOptions>;
  normalizeOptions(input: unknown): Required<TreeDesignOptions>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const treeDesignAdapter: TreeDesignAdapter = {
  type: 'tree',
  defaultOptions: DESIGN_QR_DEFAULTS.design.options,
  normalizeOptions(input) {
    const options = isRecord(input) ? input : {};
    const shape = options.shape === 'wide' || options.shape === 'pine'
      ? options.shape
      : DESIGN_QR_DEFAULTS.design.options.shape;

    return { shape };
  },
};
