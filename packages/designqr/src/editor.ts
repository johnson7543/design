export {
  DesignQRCanvas,
  type DesignQRCanvasHandle,
  type DesignQRCanvasProps,
} from './react/DesignQRCanvas.tsx';
export { RenderManager } from './renderer/RenderManager.ts';
export { PresentationSurface } from './renderer/PresentationSurface.ts';
export {
  assertInteractiveQRMatrixSupported,
  generateInteractiveQRMatrix,
  generateQRMatrix,
  resolveQRErrorCorrectionLevel,
  type QRMatrixData,
  type QRErrorCorrectionLevel,
} from './designs/tree/qr.ts';
export { build3DCity } from './designs/city/cityBuilder.ts';
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
  DESIGN_QR_THEME_PRESETS,
  type TreeThemeOverrides,
} from './designs/tree/themes.ts';
export { PREVIEW_ZOOM_MIN, PREVIEW_ZOOM_MAX, PREVIEW_ZOOM_STEP } from './interaction/previewZoom.ts';
