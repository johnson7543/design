import {
  BLOCK_SIZE,
  resolveQR2DLightDisplayRgb,
  resolveQRViewportProjection,
  QR_VISUAL_REFERENCE_GRID_SIZE,
} from '../designs/tree/constants.ts';
import {
  DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  DESIGN_QR_DETAIL_FONT_SCALE_MAX,
  DESIGN_QR_DETAIL_FONT_SCALE_MIN,
} from '../config/defaults.ts';
import { resolveDesignQRPresentationStyles } from './presentationStyles.ts';

export interface PresentationSurfaceState {
  backgroundTop: string;
  backgroundBottom: string;
  transparentBackground: boolean;
  qrGridSize: number;
  qrLightColor: string;
  showQrDetails: boolean;
  title: string;
  titleScale?: number;
  showValue: boolean;
  contentScale?: number;
  value: string;
  borderEnabled: boolean;
  borderPadding: number;
  titleColor: string;
  prefersReducedMotion: boolean;
  qrArtworkScale?: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const BACKGROUND_TRANSITION_MS = 800;
export const QR_QUIET_ZONE_MODULES = 4;
const QR_ARTWORK_FILL_FADE_START_PROGRESS = 0.82;
const QR_METADATA_TOP_GAP = 0;
const QR_TITLE_FONT_SIZE_MIN = 11.2;
const QR_TITLE_FONT_SIZE_MAX = 24;
const QR_TITLE_FONT_SIZE_RATIO = 0.05;
const QR_CONTENT_FONT_SIZE_MIN = 10;
const QR_CONTENT_FONT_SIZE_MAX = 20;
const QR_CONTENT_FONT_SIZE_RATIO = 0.042;
const QR_INFO_GAP_MIN = 4;
const QR_INFO_GAP_MAX = 8;
const QR_INFO_GAP_RATIO = 0.016;
const QR_ARTWORK_SCALE_MIN = 0.5;
const QR_ARTWORK_SCALE_MAX = 1;

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
  qrX: number;
  qrY: number;
  quietZoneSize: number;
  quietZoneX: number;
  quietZoneY: number;
}

export interface QRMatrixFillGeometry {
  size: number;
  x: number;
  y: number;
}

export interface QRDetailFrameGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
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
    qrX: (width - qrSize) * 0.5,
    qrY: (height - qrSize) * 0.5,
    quietZoneSize,
    quietZoneX: (width - quietZoneSize) * 0.5,
    quietZoneY: (height - quietZoneSize) * 0.5,
  };
}

export function resolveQRMatrixFillGeometry(
  geometry: QRPresentationGeometry
): QRMatrixFillGeometry {
  return {
    size: geometry.qrSize,
    x: geometry.qrX,
    y: geometry.qrY,
  };
}

export function resolveQRDetailFrameGeometry(
  geometry: QRPresentationGeometry,
  borderPadding: number,
  detailHeight = 0
): QRDetailFrameGeometry {
  const padding = Number.isFinite(borderPadding)
    ? Math.max(0, borderPadding)
    : 0;
  const safeDetailHeight = Number.isFinite(detailHeight)
    ? Math.max(0, detailHeight)
    : 0;

  return {
    x: geometry.quietZoneX - padding,
    y: geometry.quietZoneY - padding,
    width: geometry.quietZoneSize + padding * 2,
    height: geometry.quietZoneSize + padding * 2 + safeDetailHeight,
  };
}

export function resolveQRArtworkFillOpacity(progress: number): number {
  const normalized = Math.max(0, Math.min(
    1,
    (progress - QR_ARTWORK_FILL_FADE_START_PROGRESS)
      / (1 - QR_ARTWORK_FILL_FADE_START_PROGRESS)
  ));
  return normalized * normalized * (3 - 2 * normalized);
}

export function resolveQRArtworkScale(
  progress: number,
  settledScale = 1
): number {
  const normalizedProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0;
  const safeSettledScale = Number.isFinite(settledScale)
    ? Math.max(
        QR_ARTWORK_SCALE_MIN,
        Math.min(QR_ARTWORK_SCALE_MAX, settledScale)
      )
    : 1;

  return 1 + (safeSettledScale - 1) * normalizedProgress;
}

export interface QRDetailTypography {
  titleFontSize: number;
  contentFontSize: number;
  infoGap: number;
}

export function resolveQRDetailTypography(
  qrSize: number,
  titleScale = DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  contentScale = DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT
): QRDetailTypography {
  const safeQrSize = Number.isFinite(qrSize) ? Math.max(0, qrSize) : 0;
  const clamp = (value: number, minimum: number, maximum: number) => (
    Math.min(maximum, Math.max(minimum, value))
  );
  const safeTitleScale = Number.isFinite(titleScale)
    ? clamp(
        titleScale,
        DESIGN_QR_DETAIL_FONT_SCALE_MIN,
        DESIGN_QR_DETAIL_FONT_SCALE_MAX
      )
    : DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT;
  const safeContentScale = Number.isFinite(contentScale)
    ? clamp(
        contentScale,
        DESIGN_QR_DETAIL_FONT_SCALE_MIN,
        DESIGN_QR_DETAIL_FONT_SCALE_MAX
      )
    : DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT;

  return {
    titleFontSize: safeTitleScale * clamp(
      safeQrSize * QR_TITLE_FONT_SIZE_RATIO,
      QR_TITLE_FONT_SIZE_MIN,
      QR_TITLE_FONT_SIZE_MAX
    ),
    contentFontSize: safeContentScale * clamp(
      safeQrSize * QR_CONTENT_FONT_SIZE_RATIO,
      QR_CONTENT_FONT_SIZE_MIN,
      QR_CONTENT_FONT_SIZE_MAX
    ),
    infoGap: clamp(
      safeQrSize * QR_INFO_GAP_RATIO,
      QR_INFO_GAP_MIN,
      QR_INFO_GAP_MAX
    ),
  };
}

function qrLightColorString(color: string): string {
  const [r, g, b] = resolveQR2DLightDisplayRgb(color);
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

interface QRDetailMetrics {
  title: string;
  content: string;
  hasInfo: boolean;
  titleFontSize: number;
  contentFontSize: number;
  titleLineHeight: number;
  contentLineHeight: number;
  infoGap: number;
  infoHeight: number;
  padding: number;
  infoTopGap: number;
}

function resolveQRDetailMetrics(
  qrSize: number,
  state: PresentationSurfaceState
): QRDetailMetrics {
  const title = state.title.trim().toUpperCase();
  const content = state.showValue ? state.value : '';
  const typography = resolveQRDetailTypography(
    qrSize,
    state.titleScale,
    state.contentScale
  );
  const { titleFontSize, contentFontSize } = typography;
  const titleLineHeight = titleFontSize * 1.2;
  const contentLineHeight = contentFontSize * 1.2;
  const infoGap = title && content ? typography.infoGap : 0;
  const infoHeight = (title ? titleLineHeight : 0)
    + (content ? contentLineHeight : 0)
    + infoGap;
  const padding = state.borderEnabled && Number.isFinite(state.borderPadding)
    ? Math.max(0, state.borderPadding)
    : 0;

  return {
    title,
    content,
    hasInfo: title.length > 0 || content.length > 0,
    titleFontSize,
    contentFontSize,
    titleLineHeight,
    contentLineHeight,
    infoGap,
    infoHeight,
    padding,
    infoTopGap: QR_METADATA_TOP_GAP,
  };
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
    this.drawQrArtworkFill(width, height);
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

  private drawQrArtworkFill(width: number, height: number): void {
    const borderVisible = this.state.showQrDetails && this.state.borderEnabled;
    if (!this.state.transparentBackground && !borderVisible) return;

    const opacity = resolveQRArtworkFillOpacity(this.viewProgress);
    if (opacity <= 0) return;

    const geometry = resolveQRPresentationGeometry(
      width,
      height,
      this.state.qrGridSize
    );
    const fill = resolveQRMatrixFillGeometry(geometry);
    this.context.save();
    this.context.globalAlpha = opacity;
    this.context.fillStyle = qrLightColorString(this.state.qrLightColor);
    if (borderVisible) {
      const details = resolveQRDetailMetrics(geometry.qrSize, this.state);
      const frame = resolveQRDetailFrameGeometry(
        geometry,
        details.padding,
        details.hasInfo ? details.infoTopGap + details.infoHeight : 0
      );
      const radius = Math.min(26, 15 + details.padding * 0.35);
      this.context.beginPath();
      this.context.roundRect(
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        radius
      );
      this.context.fill();
    } else {
      this.context.fillRect(
        fill.x,
        fill.y,
        fill.size,
        fill.size
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
    const qrArtworkScale = resolveQRArtworkScale(
      this.viewProgress,
      this.state.qrArtworkScale
    );
    if (
      (!transform || transform === 'none')
      && qrArtworkScale === 1
    ) {
      return new DOMMatrix();
    }

    const cssMatrix = !transform || transform === 'none'
      ? new DOMMatrix()
      : new DOMMatrix(transform);
    return new DOMMatrix()
      .translate(width * 0.5, height * 0.5)
      .multiply(cssMatrix)
      .scale(qrArtworkScale)
      .translate(width * -0.5, height * -0.5);
  }

  private drawQrDetails(width: number, height: number): void {
    const geometry = resolveQRPresentationGeometry(
      width,
      height,
      this.state.qrGridSize
    );
    const details = resolveQRDetailMetrics(geometry.qrSize, this.state);
    const detailAnchorSize = geometry.quietZoneSize;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const presentationStyles = resolveDesignQRPresentationStyles(
      getComputedStyle(this.presentationCanvas)
    );

    if (this.state.borderEnabled) {
      const frame = resolveQRDetailFrameGeometry(
        geometry,
        details.padding,
        details.hasInfo ? details.infoTopGap + details.infoHeight : 0
      );
      const radius = Math.min(26, 15 + details.padding * 0.35);
      this.context.save();
      this.context.strokeStyle = presentationStyles.borderColor;
      this.context.lineWidth = 1;
      this.context.shadowColor = presentationStyles.borderColor;
      this.context.shadowBlur = 24;
      this.context.shadowOffsetY = 10;
      this.context.beginPath();
      this.context.roundRect(
        frame.x + 0.5,
        frame.y + 0.5,
        frame.width - 1,
        frame.height - 1,
        radius
      );
      this.context.stroke();

      this.context.shadowColor = 'transparent';
      this.context.strokeStyle = presentationStyles.borderHighlightColor;
      this.context.lineWidth = 2;
      this.context.beginPath();
      this.context.roundRect(
        frame.x + 2,
        frame.y + 2,
        frame.width - 4,
        frame.height - 4,
        Math.max(0, radius - 2)
      );
      this.context.stroke();
      this.context.restore();
    }

    if (!details.hasInfo) return;

    let lineCenterY = centerY + detailAnchorSize * 0.5 + details.infoTopGap;
    const maxTextWidth = detailAnchorSize;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    if (details.title) {
      this.context.save();
      this.context.fillStyle = this.state.titleColor;
      this.context.font = `700 ${details.titleFontSize}px ${presentationStyles.titleFontFamily}`;
      const letterSpacingContext = this.context as CanvasRenderingContext2D & {
        letterSpacing?: string;
      };
      if (letterSpacingContext.letterSpacing !== undefined) {
        letterSpacingContext.letterSpacing = '0.05em';
      }
      lineCenterY += details.titleLineHeight * 0.5;
      this.context.fillText(
        fitText(this.context, details.title, maxTextWidth),
        centerX,
        lineCenterY,
        maxTextWidth
      );
      this.context.restore();
      lineCenterY += details.titleLineHeight * 0.5 + details.infoGap;
    }

    if (details.content) {
      this.context.save();
      this.context.fillStyle = presentationStyles.contentColor;
      this.context.font = `500 ${details.contentFontSize}px ${presentationStyles.bodyFontFamily}`;
      lineCenterY += details.contentLineHeight * 0.5;
      this.context.fillText(
        fitText(this.context, details.content, maxTextWidth),
        centerX,
        lineCenterY,
        maxTextWidth
      );
      this.context.restore();
    }
  }
}
