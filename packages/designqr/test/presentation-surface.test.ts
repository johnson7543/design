import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveQR2DLightDisplayRgb } from '../src/designs/tree/constants.ts';
import {
  PresentationSurface,
  QR_QUIET_ZONE_MODULES,
  type PresentationSurfaceState,
  resolveQRArtworkFillOpacity,
  resolveQRArtworkScale,
  resolveQRDetailFrameGeometry,
  resolveQRDetailTypography,
  resolveQRMatrixFillGeometry,
  resolveQRPresentationGeometry,
} from '../src/renderer/PresentationSurface.ts';

function createPresentationState(
  transparentBackground: boolean,
  borderEnabled = false
): PresentationSurfaceState {
  return {
    backgroundTop: '#f6e2d5',
    backgroundBottom: '#f1cdbd',
    transparentBackground,
    qrGridSize: 25,
    qrLightColor: '#f1cdbd',
    showQrDetails: borderEnabled,
    title: '',
    showValue: false,
    value: 'https://example.com',
    borderEnabled,
    borderPadding: 16,
    titleColor: '#98596e',
    prefersReducedMotion: true,
  };
}

test('keeps the local fill exactly within the projected QR matrix footprint', () => {
  for (const [width, height] of [[1_440, 900], [390, 844], [320, 568]]) {
    const geometry = resolveQRPresentationGeometry(width, height, 25);
    const fill = resolveQRMatrixFillGeometry(geometry);

    assert.equal(fill.size, geometry.qrSize);
    assert.equal(fill.x, geometry.qrX);
    assert.equal(fill.y, geometry.qrY);
    assert.equal(fill.x, (width - fill.size) * 0.5);
    assert.equal(fill.y, (height - fill.size) * 0.5);
    assert.ok(fill.size <= width);
    assert.ok(fill.size <= height);
  }
});

test('reserves four QR modules inside the optional detail border', () => {
  for (const gridSize of [21, 25, 41, 57]) {
    const geometry = resolveQRPresentationGeometry(390, 844, gridSize);
    const moduleSize = geometry.qrSize / gridSize;
    const quietZoneMargin = (geometry.quietZoneSize - geometry.qrSize) * 0.5;

    assert.ok(
      Math.abs(quietZoneMargin / moduleSize - QR_QUIET_ZONE_MODULES) < 1e-9
    );

    for (const padding of [4, 16, 32]) {
      const frame = resolveQRDetailFrameGeometry(geometry, padding);
      assert.equal(geometry.quietZoneX - frame.x, padding);
      assert.equal(geometry.quietZoneY - frame.y, padding);
      assert.ok(geometry.qrX - frame.x >= QR_QUIET_ZONE_MODULES * moduleSize);
      assert.ok(geometry.qrY - frame.y >= QR_QUIET_ZONE_MODULES * moduleSize);
    }
  }
});

test('anchors the decorative frame and metadata region outside the quiet zone', () => {
  const geometry = resolveQRPresentationGeometry(390, 844, 25);

  for (const padding of [4, 16, 32]) {
    const frame = resolveQRDetailFrameGeometry(geometry, padding, 40);

    assert.equal(geometry.quietZoneX - frame.x, padding);
    assert.equal(geometry.quietZoneY - frame.y, padding);
    assert.equal(
      frame.x + frame.width - (geometry.quietZoneX + geometry.quietZoneSize),
      padding
    );
    assert.equal(
      frame.y + frame.height - (geometry.quietZoneY + geometry.quietZoneSize),
      padding + 40
    );
  }
});

test('fades the local artwork fill only near the settled 2D view', () => {
  assert.equal(resolveQRArtworkFillOpacity(0), 0);
  assert.equal(resolveQRArtworkFillOpacity(0.82), 0);
  assert.ok(resolveQRArtworkFillOpacity(0.9) > 0);
  assert.ok(resolveQRArtworkFillOpacity(0.9) < 1);
  assert.equal(resolveQRArtworkFillOpacity(1), 1);
  assert.equal(resolveQRArtworkFillOpacity(2), 1);
});

test('blends an opt-in QR artwork scale without changing the 3D endpoint', () => {
  assert.equal(resolveQRArtworkScale(0, 0.88), 1);
  assert.ok(Math.abs(resolveQRArtworkScale(0.5, 0.88) - 0.94) < 1e-9);
  assert.equal(resolveQRArtworkScale(1, 0.88), 0.88);
  assert.equal(resolveQRArtworkScale(-1, 0.88), 1);
  assert.equal(resolveQRArtworkScale(2, 0.88), 0.88);
  assert.equal(resolveQRArtworkScale(1, 0), 0.5);
  assert.equal(resolveQRArtworkScale(1, 2), 1);
  assert.equal(resolveQRArtworkScale(Number.NaN, 0.88), 1);
  assert.equal(resolveQRArtworkScale(1, Number.NaN), 1);
});

test('scales QR metadata typography with the projected artwork size', () => {
  const smallMobileGeometry = resolveQRPresentationGeometry(320, 568, 25);
  const packageFixtureGeometry = resolveQRPresentationGeometry(480, 480, 25);
  const desktopGeometry = resolveQRPresentationGeometry(1_440, 900, 25);
  const largeArtworkGeometry = resolveQRPresentationGeometry(2_560, 1_600, 25);
  const smallMobile = resolveQRDetailTypography(smallMobileGeometry.qrSize);
  const packageFixture = resolveQRDetailTypography(packageFixtureGeometry.qrSize);
  const desktop = resolveQRDetailTypography(desktopGeometry.qrSize);
  const largeArtwork = resolveQRDetailTypography(largeArtworkGeometry.qrSize);

  assert.deepEqual(smallMobile, {
    titleFontSize: 11.2,
    contentFontSize: 10,
    infoGap: 4,
  });
  assert.ok(packageFixture.titleFontSize > smallMobile.titleFontSize);
  assert.ok(desktop.titleFontSize > packageFixture.titleFontSize);
  assert.ok(desktop.contentFontSize > packageFixture.contentFontSize);
  assert.deepEqual(largeArtwork, {
    titleFontSize: 24,
    contentFontSize: 20,
    infoGap: 8,
  });
  assert.deepEqual(resolveQRDetailTypography(Number.NaN), smallMobile);
  assert.ok(smallMobile.contentFontSize < smallMobile.titleFontSize);
  assert.ok(desktop.contentFontSize < desktop.titleFontSize);
});

test('applies bounded independent title and content scale multipliers', () => {
  const qrSize = 400;
  const defaults = resolveQRDetailTypography(qrSize);
  const minimum = resolveQRDetailTypography(qrSize, 0, 0);
  const maximum = resolveQRDetailTypography(qrSize, 10, 10);

  assert.equal(minimum.titleFontSize, defaults.titleFontSize * 0.75);
  assert.equal(minimum.contentFontSize, defaults.contentFontSize * 0.75);
  assert.equal(maximum.titleFontSize, defaults.titleFontSize * 1.5);
  assert.equal(maximum.contentFontSize, defaults.contentFontSize * 1.5);
  assert.deepEqual(
    resolveQRDetailTypography(qrSize, Number.NaN, Number.NaN),
    defaults
  );
});

test('uses desktop artwork proportions for a wide portrait host', () => {
  const geometry = resolveQRPresentationGeometry(1_059, 1_273, 25);
  const typography = resolveQRDetailTypography(geometry.qrSize);
  const detailHeight = typography.titleFontSize * 1.2
    + typography.contentFontSize * 1.2
    + typography.infoGap;
  const frame = resolveQRDetailFrameGeometry(geometry, 16, detailHeight);

  assert.ok(geometry.qrSize / 1_059 < 0.41);
  assert.ok(geometry.quietZoneSize / 1_059 < 0.54);
  assert.ok(frame.y > 300);
  assert.ok(frame.y + frame.height < 1_000);
});

test('keeps the QR details card proportional in a narrow portrait desktop', () => {
  const geometry = resolveQRPresentationGeometry(707, 1_157, 25);
  const typography = resolveQRDetailTypography(geometry.qrSize);
  const detailHeight = typography.titleFontSize * 1.2
    + typography.contentFontSize * 1.2
    + typography.infoGap;
  const frame = resolveQRDetailFrameGeometry(geometry, 16, detailHeight);

  assert.ok(geometry.qrSize / 707 < 0.62);
  assert.ok(geometry.quietZoneSize / 707 < 0.82);
  assert.ok(frame.x > 50);
  assert.ok(frame.x + frame.width < 657);
});

interface RecordedFill {
  alpha: number;
  fillStyle: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
}

function alphaAt(fills: RecordedFill[], x: number, y: number): number {
  let alpha = 0;
  for (const fill of fills) {
    if (
      x >= fill.x
      && x < fill.x + fill.width
      && y >= fill.y
      && y < fill.y + fill.height
    ) {
      alpha = fill.alpha + alpha * (1 - fill.alpha);
    }
  }
  return alpha;
}

test('fills only the matrix in transparent mode and preserves opaque artwork', () => {
  const originalDOMMatrix = globalThis.DOMMatrix;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const fills: RecordedFill[] = [];
  const pathFills: RecordedFill[] = [];
  const textDraws: Array<{
    text: string;
    x: number;
    y: number;
    maxWidth: number | undefined;
    font: string;
  }> = [];
  const stateStack: Array<{ alpha: number; fillStyle: unknown }> = [];
  let pathRect: Omit<RecordedFill, 'alpha' | 'fillStyle'> | null = null;
  let clearCount = 0;

  class IdentityDOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    translate() { return this; }
    multiply() { return this; }
    inverse() { return this; }
  }

  const context = {
    globalAlpha: 1,
    filter: 'none',
    font: '',
    fillStyle: '' as unknown,
    setTransform() {},
    clearRect() { clearCount += 1; },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    beginPath() { pathRect = null; },
    roundRect(x: number, y: number, width: number, height: number) {
      pathRect = { x, y, width, height };
    },
    fill() {
      if (!pathRect) return;
      pathFills.push({
        alpha: this.globalAlpha,
        fillStyle: this.fillStyle,
        ...pathRect,
      });
    },
    stroke() {},
    measureText(text: string) { return { width: text.length * 6 }; },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      textDraws.push({ text, x, y, maxWidth, font: this.font });
    },
    fillRect(x: number, y: number, width: number, height: number) {
      fills.push({
        alpha: this.globalAlpha,
        fillStyle: this.fillStyle,
        x,
        y,
        width,
        height,
      });
    },
    save() {
      stateStack.push({ alpha: this.globalAlpha, fillStyle: this.fillStyle });
    },
    restore() {
      const state = stateStack.pop();
      if (!state) return;
      this.globalAlpha = state.alpha;
      this.fillStyle = state.fillStyle;
    },
    transform() {},
    drawImage() {},
  };
  const sourceCanvas = { width: 200, height: 200 };
  const presentationCanvas = {
    width: 200,
    height: 200,
    getContext: () => context,
  };
  const host = { clientWidth: 100, clientHeight: 100 };

  Object.defineProperty(globalThis, 'DOMMatrix', {
    configurable: true,
    value: IdentityDOMMatrix,
  });
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value: () => ({
      transform: 'none',
      getPropertyValue: () => '',
    }),
  });

  try {
    const expectedLightColor = `rgb(${resolveQR2DLightDisplayRgb('#f1cdbd')
      .map((channel) => Math.round(channel * 255))
      .join(', ')})`;
    const surface = new PresentationSurface(
      sourceCanvas as HTMLCanvasElement,
      presentationCanvas as unknown as HTMLCanvasElement,
      host as HTMLElement,
      {} as HTMLElement,
      createPresentationState(true)
    );

    surface.draw();
    assert.equal(clearCount, 1);
    assert.equal(fills.length, 0, '3D transparent mode should retain cleared alpha');

    fills.length = 0;
    surface.setViewProgress(1);
    surface.draw();
    assert.equal(fills.length, 1, 'settled transparent mode should draw one matrix fill');
    const matrixFill = fills[0];
    const expectedGeometry = resolveQRMatrixFillGeometry(
      resolveQRPresentationGeometry(100, 100, 25)
    );
    assert.equal(matrixFill.alpha, 1);
    assert.equal(matrixFill.fillStyle, expectedLightColor);
    assert.equal(matrixFill.x, expectedGeometry.x);
    assert.equal(matrixFill.y, expectedGeometry.y);
    assert.equal(matrixFill.width, expectedGeometry.size);
    assert.equal(matrixFill.height, expectedGeometry.size);
    assert.equal(alphaAt(fills, 50, 50), 1, 'the QR matrix should be opaque');
    assert.equal(
      alphaAt(fills, Math.max(0, Math.floor(matrixFill.x) - 1), 50),
      0,
      'pixels beside the QR matrix should stay clear'
    );
    assert.equal(alphaAt(fills, 0, 0), 0, 'the top-left corner should stay clear');
    assert.equal(alphaAt(fills, 99, 99), 0, 'the bottom-right corner should stay clear');

    fills.length = 0;
    surface.setState(createPresentationState(false));
    assert.equal(fills.length, 1, 'opaque settled mode should draw only the background');
    assert.equal(fills[0].width, 100);
    assert.equal(fills[0].height, 100);
    assert.equal(alphaAt(fills, 0, 0), 1, 'the seasonal background should stay opaque');

    fills.length = 0;
    pathFills.length = 0;
    surface.setState(createPresentationState(true, true));
    assert.equal(fills.length, 0, 'the transparent bordered view should not add a matrix-only fill');
    assert.equal(pathFills.length, 1, 'the transparent bordered view should fill its card');
    const expectedFrame = resolveQRDetailFrameGeometry(
      resolveQRPresentationGeometry(100, 100, 25),
      16
    );
    assert.deepEqual(pathFills[0], {
      alpha: 1,
      fillStyle: expectedLightColor,
      ...expectedFrame,
    });

    fills.length = 0;
    pathFills.length = 0;
    surface.setState(createPresentationState(false, true));
    assert.equal(fills.length, 1, 'the opaque bordered view should retain its background');
    assert.equal(pathFills.length, 1, 'the opaque bordered view should fill its card');

    const metadataState = (borderEnabled: boolean): PresentationSurfaceState => ({
      ...createPresentationState(true, borderEnabled),
      showQrDetails: true,
      title: 'Stable title',
      showValue: true,
    });
    textDraws.length = 0;
    surface.setState(metadataState(false));
    const borderlessTextDraws = textDraws.map((draw) => ({ ...draw }));
    textDraws.length = 0;
    surface.setState(metadataState(true));
    const borderedTextDraws = textDraws.map((draw) => ({ ...draw }));
    const geometry = resolveQRPresentationGeometry(100, 100, 25);

    assert.deepEqual(
      borderedTextDraws,
      borderlessTextDraws,
      'toggling the border should not change title/value layout or truncation'
    );
    assert.ok(borderlessTextDraws.length > 0);
    assert.ok(
      borderlessTextDraws.every(({ maxWidth }) => maxWidth === geometry.quietZoneSize),
      'title and value should share the border-independent quiet-zone width'
    );
    const mobileTitleLineHeight = resolveQRDetailTypography(
      geometry.qrSize
    ).titleFontSize * 1.2;
    assert.ok(
      Math.abs(
        borderlessTextDraws[0].y
          - mobileTitleLineHeight * 0.5
          - (geometry.quietZoneY + geometry.quietZoneSize)
      ) < 1e-9,
      'the title line should begin directly after the four-module clearance'
    );
    assert.ok(
      borderlessTextDraws.every(({ y }) => (
        y > geometry.quietZoneY + geometry.quietZoneSize
      )),
      'metadata should remain below the virtual four-module clearance'
    );
  } finally {
    Object.defineProperty(globalThis, 'DOMMatrix', {
      configurable: true,
      value: originalDOMMatrix,
    });
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: originalGetComputedStyle,
    });
  }
});
