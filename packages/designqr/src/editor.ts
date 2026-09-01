export {
  DesignQRCanvas,
  type DesignQRCanvasHandle,
  type DesignQRCanvasProps,
} from './react/DesignQRCanvas.tsx';
export { RenderManager } from './renderer/RenderManager.ts';
export { PresentationSurface } from './renderer/PresentationSurface.ts';
export {
  generateQRMatrix,
  resolveQRErrorCorrectionLevel,
  type QRMatrixData,
} from './designs/tree/qr.ts';
export {
  build3DTree,
  type TreeData,
  type VoxelBlock,
} from './designs/tree/treeBuilder.ts';
export * from './designs/tree/constants.ts';
export {
  createTreeTheme,
  createTreeParticleOverrides,
  resolveTreeTheme,
  TREE_THEME_PRESETS,
  type TreeThemeOverrides,
} from './designs/tree/themes.ts';
