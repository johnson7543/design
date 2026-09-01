import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PresentationSurface,
  QR_QUIET_ZONE_MODULES,
  type PresentationSurfaceState,
  resolveQRBackgroundPlateGeometry,
  resolveQRPresentationGeometry,
  resolveQRQuietZoneOpacity,
} from '../src/renderer/PresentationSurface.ts';

function createPresentationState(
  transparentBackground: boolean
): PresentationSurfaceState {
  return {
    backgroundTop: '#f6e2d5',
    backgroundBottom: '#f1cdbd',
    transparentBackground,
    qrGridSize: 25,
    qrLightColor: '#f1cdbd',
    showQrDetails: false,
    title: '',
    showValue: false,
    value: 'https://example.com',
    borderEnabled: false,
    borderPadding: 16,
    titleColor: '#98596e',
    prefersReducedMotion: true,
  };
}

test('adds an exact four-module quiet zone around the projected QR', () => {
  for (const gridSize of [21, 25, 41]) {
    const geometry = resolveQRPresentationGeometry(390, 844, gridSize);
    const moduleSize = geometry.qrSize / gridSize;
    const margin = (geometry.quietZoneSize - geometry.qrSize) * 0.5;

    assert.ok(Math.abs(margin / moduleSize - QR_QUIET_ZONE_MODULES) < 1e-9);
    assert.equal(geometry.quietZoneX, (390 - geometry.quietZoneSize) * 0.5);
    assert.equal(geometry.quietZoneY, (844 - geometry.quietZoneSize) * 0.5);
  }
});

test('keeps the ideal transparent quiet-zone target inside supported viewports', () => {
  for (const [width, height] of [[1_440, 900], [390, 844], [320, 568]]) {
    const geometry = resolveQRPresentationGeometry(width, height, 21);
    assert.ok(geometry.quietZoneSize <= width);
    assert.ok(geometry.quietZoneSize <= height);
  }
});

test('caps the transparent 2D plate inside the established QR border footprint', () => {
  for (const [width, height] of [[1_440, 900], [390, 844], [320, 568]]) {
    for (const gridSize of [21, 29, 41]) {
      const geometry = resolveQRPresentationGeometry(width, height, gridSize);
      const fullQuietZonePadding = (
        geometry.quietZoneSize - geometry.qrSize
      ) * 0.5;
      const withoutBorder = resolveQRBackgroundPlateGeometry(
        width,
        height,
        geometry,
        false,
        16
      );
      assert.equal(withoutBorder.size, geometry.qrSize);
      assert.equal(withoutBorder.x, (width - geometry.qrSize) * 0.5);
      assert.equal(withoutBorder.y, (height - geometry.qrSize) * 0.5);

      for (const borderPadding of [4, 16, 32]) {
        const bordered = resolveQRBackgroundPlateGeometry(
          width,
          height,
          geometry,
          true,
          borderPadding
        );
        const expectedPlatePadding = Math.min(
          borderPadding,
          fullQuietZonePadding
        );
        const frameX = (width - geometry.qrSize) * 0.5 - borderPadding;
        const frameY = (height - geometry.qrSize) * 0.5 - borderPadding;
        const frameSize = geometry.qrSize + borderPadding * 2;

        assert.equal(
          bordered.size,
          geometry.qrSize + expectedPlatePadding * 2
        );
        assert.ok(bordered.x >= frameX);
        assert.ok(bordered.y >= frameY);
        assert.ok(bordered.x + bordered.size <= frameX + frameSize);
        assert.ok(bordered.y + bordered.size <= frameY + frameSize);
      }

      const spaciousBorder = resolveQRBackgroundPlateGeometry(
        width,
        height,
        geometry,
        true,
        100
      );
      assert.equal(spaciousBorder.size, geometry.quietZoneSize);
      assert.equal(spaciousBorder.x, geometry.quietZoneX);
      assert.equal(spaciousBorder.y, geometry.quietZoneY);
    }
  }
});

test('fades the quiet-zone plate only near the settled 2D view', () => {
  assert.equal(resolveQRQuietZoneOpacity(0), 0);
  assert.equal(resolveQRQuietZoneOpacity(0.82), 0);
  assert.ok(resolveQRQuietZoneOpacity(0.9) > 0);
  assert.ok(resolveQRQuietZoneOpacity(0.9) < 1);
  assert.equal(resolveQRQuietZoneOpacity(1), 1);
  assert.equal(resolveQRQuietZoneOpacity(2), 1);
});

test('clears to alpha immediately and draws only the scan-safe plate', () => {
  const originalDOMMatrix = globalThis.DOMMatrix;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const fills: Array<{ alpha: number; width: number; height: number }> = [];
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
    fillStyle: '',
    setTransform() {},
    clearRect() { clearCount += 1; },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillRect(_x: number, _y: number, width: number, height: number) {
      fills.push({ alpha: this.globalAlpha, width, height });
    },
    save() {},
    restore() { this.globalAlpha = 1; },
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
    value: () => ({ transform: 'none' }),
  });

  try {
    const surface = new PresentationSurface(
      sourceCanvas as HTMLCanvasElement,
      presentationCanvas as unknown as HTMLCanvasElement,
      host as HTMLElement,
      {} as HTMLElement,
      createPresentationState(false)
    );

    surface.draw();
    assert.equal(clearCount, 1);
    assert.equal(fills.length, 1, 'opaque mode should paint the full background');
    assert.deepEqual(fills[0], { alpha: 1, width: 100, height: 100 });

    fills.length = 0;
    clearCount = 0;
    surface.setState(createPresentationState(true));
    assert.equal(clearCount, 1, 'the toggle should redraw without a renderer frame');
    assert.equal(fills.length, 0, '3D transparent mode should retain cleared alpha');

    fills.length = 0;
    surface.setViewProgress(1);
    surface.draw();
    assert.equal(fills.length, 1, 'settled 2D should add one local quiet-zone plate');
    assert.equal(fills[0].alpha, 1);
    assert.ok(fills[0].width < 100);
    assert.equal(fills[0].width, fills[0].height);
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
