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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const treeDesignAdapter: TreeDesignAdapter = {
  type: 'tree',
  defaultOptions: DESIGN_QR_DEFAULTS.design.options,
  normalizeOptions(input) {
    const options = isRecord(input) ? input : {};
    const shape = options.shape === 'wide' || options.shape === 'pine'
      ? options.shape
      : DESIGN_QR_DEFAULTS.design.options.shape;
    const seed = typeof options.seed === 'number' && Number.isFinite(options.seed)
      ? clamp(options.seed, 0, 1)
      : DESIGN_QR_DEFAULTS.design.options.seed;

    return { shape, seed };
  },
};
