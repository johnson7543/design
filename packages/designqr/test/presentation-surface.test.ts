import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveQR2DLightDisplayRgb } from '../src/designs/tree/constants.ts';
import {
  PresentationSurface,
  QR_QUIET_ZONE_MODULES,
  type PresentationSurfaceState,
  resolveQRArtworkFillOpacity,
  resolveQRDetailFrameGeometry,
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
  const textDraws: Array<{ text: string; x: number; y: number }> = [];
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
    fillText(text: string, x: number, y: number) {
      textDraws.push({ text, x, y });
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
    const borderlessTextPositions = textDraws.map(({ x, y }) => ({ x, y }));
    textDraws.length = 0;
    surface.setState(metadataState(true));
    const borderedTextPositions = textDraws.map(({ x, y }) => ({ x, y }));
    const geometry = resolveQRPresentationGeometry(100, 100, 25);

    assert.deepEqual(
      borderedTextPositions,
      borderlessTextPositions,
      'toggling the border should not reposition the title or value'
    );
    assert.ok(borderlessTextPositions.length > 0);
    const mobileTitleLineHeight = 11.2 * 1.2;
    assert.ok(
      Math.abs(
        borderlessTextPositions[0].y
          - mobileTitleLineHeight * 0.5
          - (geometry.quietZoneY + geometry.quietZoneSize)
      ) < 1e-9,
      'the title line should begin directly after the four-module clearance'
    );
    assert.ok(
      borderlessTextPositions.every(({ y }) => (
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
