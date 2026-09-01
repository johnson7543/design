import {
  BLOCK_SIZE,
  resolveQR2DLightDisplayRgb,
  resolveQRViewportProjection,
  QR_VISUAL_REFERENCE_GRID_SIZE,
} from '../designs/tree/constants.ts';
import { resolveDesignQRPresentationStyles } from './presentationStyles.ts';

export interface PresentationSurfaceState {
  backgroundTop: string;
  backgroundBottom: string;
  transparentBackground: boolean;
  qrGridSize: number;
  qrLightColor: string;
  showQrDetails: boolean;
  title: string;
  showValue: boolean;
  value: string;
  borderEnabled: boolean;
  borderPadding: number;
  titleColor: string;
  prefersReducedMotion: boolean;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const BACKGROUND_TRANSITION_MS = 800;
export const QR_QUIET_ZONE_MODULES = 4;
const QR_QUIET_ZONE_FADE_START_PROGRESS = 0.82;

function parseHexColor(value: string): RgbColor {
  const normalized = value.trim().replace('#', '');
  const expanded = normalized.length === 3
    ? Array.from(normalized, (digit) => `${digit}${digit}`).join('')
    : normalized;
  const parsed = Number.parseInt(expanded, 16);

  if (!Number.isFinite(parsed) || expanded.length !== 6) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function mixColor(from: RgbColor, to: RgbColor, progress: number): RgbColor {
  return {
    r: from.r + (to.r - from.r) * progress,
    g: from.g + (to.g - from.g) * progress,
    b: from.b + (to.b - from.b) * progress,
  };
}

function colorString(color: RgbColor): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

function projectedQrViewportSize(
  gridSize: number,
  distance: number,
  fieldOfView: number
): number {
  const qrWorldSize = gridSize * BLOCK_SIZE * 1.002;
  const visibleWorldSize = 2 * distance * Math.tan((fieldOfView * Math.PI) / 360);
  return (qrWorldSize / visibleWorldSize) * 100;
}

export interface QRPresentationGeometry {
  qrSize: number;
  quietZoneSize: number;
  quietZoneX: number;
  quietZoneY: number;
}

export interface QRBackgroundPlateGeometry {
  size: number;
  x: number;
  y: number;
}

export function resolveQRPresentationGeometry(
  width: number,
  height: number,
  gridSize: number
): QRPresentationGeometry {
  const viewportProjection = resolveQRViewportProjection(width, height);
  const qrSize = projectedQrViewportSize(
    QR_VISUAL_REFERENCE_GRID_SIZE,
    viewportProjection.scanDistance,
    viewportProjection.verticalFov
  ) * height / 100;
  const safeGridSize = Number.isFinite(gridSize) && gridSize > 0
    ? gridSize
    : QR_VISUAL_REFERENCE_GRID_SIZE;
  const quietZoneSize = qrSize * (
    (safeGridSize + QR_QUIET_ZONE_MODULES * 2) / safeGridSize
  );

  return {
    qrSize,
    quietZoneSize,
    quietZoneX: (width - quietZoneSize) * 0.5,
    quietZoneY: (height - quietZoneSize) * 0.5,
  };
}

export function resolveQRBackgroundPlateGeometry(
  width: number,
  height: number,
  geometry: QRPresentationGeometry,
  borderEnabled: boolean,
  borderPadding: number
): QRBackgroundPlateGeometry {
  const availablePadding = Math.max(
    0,
    (geometry.quietZoneSize - geometry.qrSize) * 0.5
  );
  const requestedPadding = borderEnabled && Number.isFinite(borderPadding)
    ? Math.max(0, borderPadding)
    : 0;
  const platePadding = Math.min(availablePadding, requestedPadding);
  const size = geometry.qrSize + platePadding * 2;

  return {
    size,
    x: (width - size) * 0.5,
    y: (height - size) * 0.5,
  };
}

export function resolveQRQuietZoneOpacity(progress: number): number {
  const normalized = Math.max(0, Math.min(
    1,
    (progress - QR_QUIET_ZONE_FADE_START_PROGRESS)
      / (1 - QR_QUIET_ZONE_FADE_START_PROGRESS)
  ));
  return normalized * normalized * (3 - 2 * normalized);
}

function qrLightColorString(color: string): string {
  const [r, g, b] = resolveQR2DLightDisplayRgb(color);
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (context.measureText(text).width <= maxWidth) return text;

  const ellipsis = '…';
  let fitted = text;
  while (
    fitted.length > 0
    && context.measureText(`${fitted}${ellipsis}`).width > maxWidth
  ) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}${ellipsis}`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('The DesignQR presentation could not be encoded as PNG.'));
      }
    }, 'image/png');
  });
}

export class PresentationSurface {
  private readonly context: CanvasRenderingContext2D;
  private readonly sourceCanvas: HTMLCanvasElement;
  private readonly presentationCanvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private readonly transformProbe: HTMLElement;
  private state: PresentationSurfaceState;
  private blurIntensity = 0;
  private backgroundFromTop: RgbColor;
  private backgroundFromBottom: RgbColor;
  private backgroundToTop: RgbColor;
  private backgroundToBottom: RgbColor;
  private backgroundTransitionStartedAt = 0;
  private viewProgress = 0;

  constructor(
    sourceCanvas: HTMLCanvasElement,
    presentationCanvas: HTMLCanvasElement,
    host: HTMLElement,
    transformProbe: HTMLElement,
    initialState: PresentationSurfaceState
  ) {
    const context = presentationCanvas.getContext('2d');
    if (!context) {
      throw new Error('A 2D canvas context is required for the DesignQR presentation.');
    }

    this.context = context;
    this.sourceCanvas = sourceCanvas;
    this.presentationCanvas = presentationCanvas;
    this.host = host;
    this.transformProbe = transformProbe;
    this.state = initialState;
    this.backgroundFromTop = parseHexColor(initialState.backgroundTop);
    this.backgroundFromBottom = parseHexColor(initialState.backgroundBottom);
    this.backgroundToTop = this.backgroundFromTop;
    this.backgroundToBottom = this.backgroundFromBottom;
  }

  setState(nextState: PresentationSurfaceState): void {
    if (
      nextState.backgroundTop !== this.state.backgroundTop
      || nextState.backgroundBottom !== this.state.backgroundBottom
    ) {
      const nextTop = parseHexColor(nextState.backgroundTop);
      const nextBottom = parseHexColor(nextState.backgroundBottom);
      if (nextState.prefersReducedMotion) {
        this.backgroundFromTop = nextTop;
        this.backgroundFromBottom = nextBottom;
        this.backgroundToTop = nextTop;
        this.backgroundToBottom = nextBottom;
        this.backgroundTransitionStartedAt = 0;
      } else {
        const current = this.currentBackground(performance.now());
        this.backgroundFromTop = current.top;
        this.backgroundFromBottom = current.bottom;
        this.backgroundToTop = nextTop;
        this.backgroundToBottom = nextBottom;
        this.backgroundTransitionStartedAt = performance.now();
      }
    } else if (nextState.prefersReducedMotion && !this.state.prefersReducedMotion) {
      this.backgroundFromTop = this.backgroundToTop;
      this.backgroundFromBottom = this.backgroundToBottom;
      this.backgroundTransitionStartedAt = 0;
    }

    this.state = nextState;
    // Configuration can change while the renderer is manually paused, outside
    // the viewport, or in a hidden document. Redraw the presentation directly
    // so background alpha and exported pixels never wait for a WebGL frame.
    this.draw();
  }

  setViewProgress(progress: number): void {
    this.viewProgress = Math.max(0, Math.min(1, progress));
  }

  setBlurIntensity(intensity: number): void {
    this.blurIntensity = Math.max(0, intensity);
  }

  resize(): void {
    if (
      this.presentationCanvas.width !== this.sourceCanvas.width
      || this.presentationCanvas.height !== this.sourceCanvas.height
    ) {
      this.presentationCanvas.width = this.sourceCanvas.width;
      this.presentationCanvas.height = this.sourceCanvas.height;
    }
    this.draw();
  }

  draw(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width <= 0 || height <= 0 || this.sourceCanvas.width <= 0) return;

    if (
      this.presentationCanvas.width !== this.sourceCanvas.width
      || this.presentationCanvas.height !== this.sourceCanvas.height
    ) {
      this.presentationCanvas.width = this.sourceCanvas.width;
      this.presentationCanvas.height = this.sourceCanvas.height;
    }

    const scaleX = this.presentationCanvas.width / width;
    const scaleY = this.presentationCanvas.height / height;
    const context = this.context;
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!this.state.transparentBackground) {
      this.drawBackground(width, height);
    }

    context.save();
    this.applyStageTransform(width, height);
    this.drawQrQuietZone(width, height);
    context.filter = this.blurIntensity > 0.01
      ? `blur(${this.blurIntensity * 2.2}px)`
      : 'none';
    context.drawImage(this.sourceCanvas, 0, 0, width, height);
    context.filter = 'none';
    if (this.state.showQrDetails) {
      this.drawQrDetails(width, height);
    }
    context.restore();
  }

  async exportImage(): Promise<Blob> {
    this.draw();
    return canvasToBlob(this.presentationCanvas);
  }

  clientPointToNdc(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.host.getBoundingClientRect();
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const point = new DOMPoint(
      clientX - bounds.left,
      clientY - bounds.top
    ).matrixTransform(this.stageMatrix(width, height).inverse());

    return {
      x: (point.x / width) * 2 - 1,
      y: -((point.y / height) * 2 - 1),
    };
  }

  private currentBackground(now: number): { top: RgbColor; bottom: RgbColor } {
    if (this.backgroundTransitionStartedAt === 0) {
      return { top: this.backgroundToTop, bottom: this.backgroundToBottom };
    }

    const progress = Math.min(
      1,
      Math.max(0, (now - this.backgroundTransitionStartedAt) / BACKGROUND_TRANSITION_MS)
    );
    const eased = progress * progress * (3 - 2 * progress);
    return {
      top: mixColor(this.backgroundFromTop, this.backgroundToTop, eased),
      bottom: mixColor(this.backgroundFromBottom, this.backgroundToBottom, eased),
    };
  }

  private drawBackground(width: number, height: number): void {
    const background = this.currentBackground(performance.now());
    const centerX = width * 0.5;
    const centerY = height * 0.3;
    const radius = Math.max(
      Math.hypot(centerX, centerY),
      Math.hypot(width - centerX, centerY),
      Math.hypot(centerX, height - centerY),
      Math.hypot(width - centerX, height - centerY)
    );
    const gradient = this.context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius
    );
    gradient.addColorStop(0, colorString(background.top));
    gradient.addColorStop(1, colorString(background.bottom));
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);
  }

  private drawQrQuietZone(width: number, height: number): void {
    if (!this.state.transparentBackground) return;

    const opacity = resolveQRQuietZoneOpacity(this.viewProgress);
    if (opacity <= 0) return;

    const geometry = resolveQRPresentationGeometry(
      width,
      height,
      this.state.qrGridSize
    );
    const plate = resolveQRBackgroundPlateGeometry(
      width,
      height,
      geometry,
      this.state.borderEnabled,
      this.state.borderPadding
    );
    this.context.save();
    this.context.globalAlpha = opacity;
    this.context.fillStyle = qrLightColorString(this.state.qrLightColor);
    if (this.state.borderEnabled) {
      const padding = Number.isFinite(this.state.borderPadding)
        ? Math.max(0, this.state.borderPadding)
        : 0;
      const frameSize = geometry.qrSize + padding * 2;
      const frameRadius = Math.min(26, 15 + padding * 0.35);
      const plateInset = Math.max(0, (frameSize - plate.size) * 0.5);
      this.context.beginPath();
      this.context.roundRect(
        plate.x,
        plate.y,
        plate.size,
        plate.size,
        Math.max(0, frameRadius - plateInset)
      );
      this.context.fill();
    } else {
      this.context.fillRect(
        plate.x,
        plate.y,
        plate.size,
        plate.size
      );
    }
    this.context.restore();
  }

  private applyStageTransform(width: number, height: number): void {
    const matrix = this.stageMatrix(width, height);
    this.context.transform(
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f
    );
  }

  private stageMatrix(width: number, height: number): DOMMatrix {
    const transform = getComputedStyle(this.transformProbe).transform;
    if (!transform || transform === 'none') return new DOMMatrix();

    const cssMatrix = new DOMMatrix(transform);
    return new DOMMatrix()
      .translate(width * 0.5, height * 0.5)
      .multiply(cssMatrix)
      .translate(width * -0.5, height * -0.5);
  }

  private drawQrDetails(width: number, height: number): void {
    const isMobile = width <= 640;
    const geometry = resolveQRPresentationGeometry(
      width,
      height,
      this.state.qrGridSize
    );
    const qrSize = geometry.qrSize;
    // Transparent mode must not enlarge the established border footprint.
    // Its local background plate is independently capped inside this frame.
    const artworkSize = qrSize;
    const detailAnchorSize = this.state.transparentBackground
      ? resolveQRBackgroundPlateGeometry(
          width,
          height,
          geometry,
          this.state.borderEnabled,
          this.state.borderPadding
        ).size
      : qrSize;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const title = this.state.title.trim().toUpperCase();
    const content = this.state.showValue ? this.state.value : '';
    const hasInfo = title.length > 0 || content.length > 0;
    const titleFontSize = isMobile ? 11.2 : 12;
    const contentFontSize = isMobile ? 12 : 13.12;
    const titleLineHeight = titleFontSize * 1.2;
    const contentLineHeight = contentFontSize * 1.2;
    const infoGap = title && content ? 4 : 0;
    const infoHeight = (title ? titleLineHeight : 0)
      + (content ? contentLineHeight : 0)
      + infoGap;
    const padding = this.state.borderEnabled ? this.state.borderPadding : 0;
    const infoTopGap = this.state.borderEnabled ? 12 : (isMobile ? 18 : 30);
    const presentationStyles = resolveDesignQRPresentationStyles(
      getComputedStyle(this.presentationCanvas)
    );

    if (this.state.borderEnabled) {
      const frameX = centerX - artworkSize * 0.5 - padding;
      const frameY = centerY - artworkSize * 0.5 - padding;
      const frameWidth = artworkSize + padding * 2;
      const frameHeight = artworkSize + padding * 2 + (hasInfo ? infoTopGap + infoHeight : 0);
      const radius = Math.min(26, 15 + padding * 0.35);
      this.context.save();
      this.context.strokeStyle = presentationStyles.borderColor;
      this.context.lineWidth = 1;
      this.context.shadowColor = presentationStyles.borderColor;
      this.context.shadowBlur = 24;
      this.context.shadowOffsetY = 10;
      this.context.beginPath();
      this.context.roundRect(
        frameX + 0.5,
        frameY + 0.5,
        frameWidth - 1,
        frameHeight - 1,
        radius
      );
      this.context.stroke();

      this.context.shadowColor = 'transparent';
      this.context.strokeStyle = presentationStyles.borderHighlightColor;
      this.context.lineWidth = 2;
      this.context.beginPath();
      this.context.roundRect(
        frameX + 2,
        frameY + 2,
        frameWidth - 4,
        frameHeight - 4,
        Math.max(0, radius - 2)
      );
      this.context.stroke();
      this.context.restore();
    }

    if (!hasInfo) return;

    let lineCenterY = centerY + detailAnchorSize * 0.5 + infoTopGap;
    const maxTextWidth = this.state.borderEnabled
      ? artworkSize
      : Math.min(isMobile ? 260 : 320, width - (isMobile ? 80 : 40));
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    if (title) {
      this.context.save();
      this.context.fillStyle = this.state.titleColor;
      this.context.font = `700 ${titleFontSize}px ${presentationStyles.titleFontFamily}`;
      const letterSpacingContext = this.context as CanvasRenderingContext2D & {
        letterSpacing?: string;
      };
      if (letterSpacingContext.letterSpacing !== undefined) {
        letterSpacingContext.letterSpacing = '0.05em';
      }
      lineCenterY += titleLineHeight * 0.5;
      this.context.fillText(
        fitText(this.context, title, maxTextWidth),
        centerX,
        lineCenterY,
        maxTextWidth
      );
      this.context.restore();
      lineCenterY += titleLineHeight * 0.5 + infoGap;
    }

    if (content) {
      const contentMaxWidth = this.state.borderEnabled
        ? maxTextWidth
        : Math.min(isMobile ? 260 : 280, width - (isMobile ? 80 : 40));
      this.context.save();
      this.context.fillStyle = presentationStyles.contentColor;
      this.context.font = `500 ${contentFontSize}px ${presentationStyles.bodyFontFamily}`;
      lineCenterY += contentLineHeight * 0.5;
      this.context.fillText(
        fitText(this.context, content, contentMaxWidth),
        centerX,
        lineCenterY,
        contentMaxWidth
      );
      this.context.restore();
    }
  }
}
