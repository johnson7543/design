export * from './config/index.ts';
export * from './embed/index.ts';
export { DesignQR } from './react/DesignQR.tsx';
export type { DesignQRHandle, DesignQRProps } from './react/types.ts';
export {
  designRegistry,
  getDesignAdapter,
  type DesignRegistry,
  type RegisteredDesignName,
} from './designs/registry.ts';
export {
  resolveTreeTitleColor,
  TREE_NEUTRAL_TITLE_COLOR,
  TREE_PRESET_TITLE_COLORS,
} from './designs/tree/themes.ts';
