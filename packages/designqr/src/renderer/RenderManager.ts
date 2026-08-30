import type { DesignQRQuality, TreeTheme } from '../config/types.ts';
import type { TreeData } from '../designs/tree/treeBuilder.ts';
import { ThreeFallbackRenderer } from './webgl/ThreeFallbackRenderer.ts';

export class RenderManager {
  private readonly canvas: HTMLCanvasElement;
  private renderer: ThreeFallbackRenderer | null = null;
  public onProgressUpdate?: (progress: number, blurIntensity: number) => void;
  public onAfterRender?: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    private quality: DesignQRQuality = 'high'
  ) {
    this.canvas = canvas;
  }

  public init(): boolean {
    try {
      this.renderer = new ThreeFallbackRenderer(this.canvas, this.quality);
      this.renderer.onProgressUpdate = (progress, blurIntensity) => {
        this.onProgressUpdate?.(progress, blurIntensity);
      };
      this.renderer.onAfterRender = () => {
        this.onAfterRender?.();
      };
      return true;
    } catch (error) {
      console.error('WebGL renderer initialization failed:', error);
      return false;
    }
  }

  public setTreeData(data: TreeData) {
    this.renderer?.setTreeData(data);
  }

  public setSeason(season: number) {
    this.renderer?.setSeason(season);
  }

  public setCustomTheme(theme: TreeTheme | null) {
    this.renderer?.setCustomTheme(theme);
  }

  public setCustomColor(rgb: [number, number, number], strength: number = 1.0) {
    this.renderer?.setCustomColor(rgb, strength);
  }

  public setTargetProgress(progress: number) {
    if (this.renderer) {
      this.renderer.targetProgress = progress;
    }
  }

  public setProgressImmediate(progress: number) {
    this.renderer?.setProgressImmediate(progress);
  }

  public setTransitionSpeed(speed: number) {
    this.renderer?.setTransitionSpeed(speed);
  }

  public setQuality(quality: DesignQRQuality) {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  public handleDrag(deltaX: number, deltaY: number) {
    if (!this.renderer) return;

    this.renderer.cancelRotationReset();
    this.renderer.yaw += deltaX * 0.006;
    this.renderer.pitch = Math.max(
      -1.45,
      Math.min(-0.1, this.renderer.pitch + deltaY * 0.006)
    );
    this.renderer.isTurntable = false;
  }

  public setMousePosition(ndcX: number, ndcY: number, isHovering: boolean) {
    this.renderer?.setMousePosition(ndcX, ndcY, isHovering);
  }

  public toggleTurntable(enabled?: boolean) {
    if (!this.renderer) return;

    this.renderer.cancelRotationReset();
    this.renderer.isTurntable = enabled ?? !this.renderer.isTurntable;
  }

  public resetRotation() {
    this.renderer?.resetRotation();
  }

  public pause() {
    this.renderer?.pause();
  }

  public resume() {
    this.renderer?.resume();
  }

  public renderOnce() {
    this.renderer?.renderOnce();
  }

  public resize(width: number, height: number) {
    this.renderer?.resize(width, height);
  }

  public destroy() {
    this.renderer?.destroy();
    this.renderer = null;
    this.onProgressUpdate = undefined;
    this.onAfterRender = undefined;
  }
}
