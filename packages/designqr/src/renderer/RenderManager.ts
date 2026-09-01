import type {
  AutoRotateDirection,
  DesignQRLogoOptions,
  ResolvedTreeTheme,
} from '../config/types.ts';
import type { TreeData } from '../designs/tree/treeBuilder.ts';
import { ThreeFallbackRenderer } from './webgl/ThreeFallbackRenderer.ts';

export class RenderManager {
  private readonly canvas: HTMLCanvasElement;
  private renderer: ThreeFallbackRenderer | null = null;
  public onProgressUpdate?: (progress: number, blurIntensity: number) => void;
  public onAfterRender?: () => void;
  public onError?: (error: unknown) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public init(): boolean {
    try {
      this.renderer = new ThreeFallbackRenderer(this.canvas);
      this.renderer.onProgressUpdate = (progress, blurIntensity) => {
        this.onProgressUpdate?.(progress, blurIntensity);
      };
      this.renderer.onAfterRender = () => {
        this.onAfterRender?.();
      };
      this.renderer.onError = (error) => {
        this.onError?.(error);
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

  public setTheme(theme: ResolvedTreeTheme) {
    this.renderer?.setTheme(theme);
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

  public handleDrag(deltaX: number, deltaY: number) {
    if (!this.renderer) return;

    this.renderer.cancelRotationReset();
    this.renderer.yaw += deltaX * 0.006;
    this.renderer.pitch = Math.max(
      -1.45,
      Math.min(-0.1, this.renderer.pitch + deltaY * 0.006)
    );
  }

  public setMousePosition(ndcX: number, ndcY: number, isHovering: boolean) {
    this.renderer?.setMousePosition(ndcX, ndcY, isHovering);
  }

  public toggleTurntable(enabled?: boolean) {
    if (!this.renderer) return;

    this.renderer.cancelRotationReset();
    this.renderer.isTurntable = enabled ?? !this.renderer.isTurntable;
  }

  public setTurntableDirection(direction: AutoRotateDirection) {
    this.renderer?.setTurntableDirection(direction);
  }

  public setLogo(logo: false | Required<DesignQRLogoOptions>) {
    this.renderer?.setLogo(logo);
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
    this.onError = undefined;
  }
}
