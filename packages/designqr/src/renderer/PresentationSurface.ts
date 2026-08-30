import {
  BLOCK_SIZE,
  QR_SCAN_DESKTOP_DISTANCE,
  QR_SCAN_DESKTOP_VERTICAL_FOV,
  QR_SCAN_MOBILE_DISTANCE,
  QR_SCAN_MOBILE_HORIZONTAL_FOV,
  QR_VISUAL_REFERENCE_GRID_SIZE,
} from '../designs/tree/constants.ts';

export interface PresentationSurfaceState {
  backgroundTop: string;
  backgroundBottom: string;
  showQrDetails: boolean;
  title: string;
  showValue: boolean;
  value: string;
  borderEnabled: boolean;
  borderPadding: number;
  titleColor: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const BACKGROUND_TRANSITION_MS = 800;

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
  private state: PresentationSurfaceState;
  private blurIntensity = 0;
  private backgroundFromTop: RgbColor;
  private backgroundFromBottom: RgbColor;
  private backgroundToTop: RgbColor;
  private backgroundToBottom: RgbColor;
  private backgroundTransitionStartedAt = 0;

  constructor(
    private readonly sourceCanvas: HTMLCanvasElement,
    private readonly presentationCanvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly transformProbe: HTMLElement,
    initialState: PresentationSurfaceState
  ) {
    const context = presentationCanvas.getContext('2d');
    if (!context) {
      throw new Error('A 2D canvas context is required for the DesignQR presentation.');
    }

    this.context = context;
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
      const current = this.currentBackground(performance.now());
      this.backgroundFromTop = current.top;
      this.backgroundFromBottom = current.bottom;
      this.backgroundToTop = parseHexColor(nextState.backgroundTop);
      this.backgroundToBottom = parseHexColor(nextState.backgroundBottom);
      this.backgroundTransitionStartedAt = performance.now();
    }

    this.state = nextState;
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
    this.drawBackground(width, height);

    context.save();
    this.applyStageTransform(width, height);
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
    const isPortrait = width < height;
    const qrSize = isPortrait
      ? projectedQrViewportSize(
          QR_VISUAL_REFERENCE_GRID_SIZE,
          QR_SCAN_MOBILE_DISTANCE,
          QR_SCAN_MOBILE_HORIZONTAL_FOV
        ) * width / 100
      : projectedQrViewportSize(
          QR_VISUAL_REFERENCE_GRID_SIZE,
          QR_SCAN_DESKTOP_DISTANCE,
          QR_SCAN_DESKTOP_VERTICAL_FOV
        ) * height / 100;
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
    const computedStyle = getComputedStyle(this.presentationCanvas);
    const titleFont = computedStyle.getPropertyValue('--font-sans').trim() || 'sans-serif';
    const bodyFont = computedStyle.getPropertyValue('--font-body').trim() || 'sans-serif';
    const mutedColor = computedStyle.getPropertyValue('--qr-ink-muted').trim();

    if (this.state.borderEnabled) {
      const frameX = centerX - qrSize * 0.5 - padding;
      const frameY = centerY - qrSize * 0.5 - padding;
      const frameWidth = qrSize + padding * 2;
      const frameHeight = qrSize + padding * 2 + (hasInfo ? infoTopGap + infoHeight : 0);
      const radius = Math.min(26, 15 + padding * 0.35);
      const borderColor = computedStyle.getPropertyValue('--qr-border-hover').trim();
      const highlightColor = computedStyle.getPropertyValue('--qr-surface-subtle').trim();

      this.context.save();
      this.context.strokeStyle = borderColor;
      this.context.lineWidth = 1;
      this.context.shadowColor = borderColor;
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
      this.context.strokeStyle = highlightColor;
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

    let lineCenterY = centerY + qrSize * 0.5 + infoTopGap;
    const maxTextWidth = this.state.borderEnabled
      ? qrSize
      : Math.min(isMobile ? 260 : 320, width - (isMobile ? 80 : 40));
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    if (title) {
      this.context.save();
      this.context.fillStyle = this.state.titleColor;
      this.context.font = `700 ${titleFontSize}px ${titleFont}`;
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
      this.context.fillStyle = mutedColor;
      this.context.font = `500 ${contentFontSize}px ${bodyFont}`;
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
