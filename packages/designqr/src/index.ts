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
  createTreeTheme,
  createTreeParticleOverrides,
  resolveTreeTheme,
  TREE_THEME_PRESETS,
  type TreeThemeOverrides,
} from './designs/tree/themes.ts';
