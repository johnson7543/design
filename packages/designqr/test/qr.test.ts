import assert from 'node:assert/strict';
import test from 'node:test';

import jsQR from 'jsqr';

import { DesignQRConfigError } from '../src/config/types.ts';
import {
  assertInteractiveQRMatrixSupported,
  generateInteractiveQRMatrix,
  generateQRMatrix,
  type QRMatrixData,
} from '../src/designs/tree/qr.ts';

function decodeMatrix(matrix: QRMatrixData): string | null {
  const quietZoneModules = 4;
  const pixelsPerModule = 5;
  const rasterSize = (
    matrix.size + quietZoneModules * 2
  ) * pixelsPerModule;
  const pixels = new Uint8ClampedArray(rasterSize * rasterSize * 4);
  pixels.fill(255);

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.modules[row][column]) continue;

      const startX = (column + quietZoneModules) * pixelsPerModule;
      const startY = (row + quietZoneModules) * pixelsPerModule;
      for (let y = startY; y < startY + pixelsPerModule; y += 1) {
        for (let x = startX; x < startX + pixelsPerModule; x += 1) {
          const index = (y * rasterSize + x) * 4;
          pixels[index] = 0;
          pixels[index + 1] = 0;
          pixels[index + 2] = 0;
        }
      }
    }
  }

  return jsQR(pixels, rasterSize, rasterSize, {
    inversionAttempts: 'dontInvert',
  })?.data ?? null;
}

test('encodes and decodes the exact supplied payload', () => {
  const value = 'https://example.com/designqr?x=春🌸';
  const matrix = generateQRMatrix(value, 'M');

  assert.equal(decodeMatrix(matrix), value);
});

test('encodes the exact high-error-correction byte-mode boundary', () => {
  const value = 'a'.repeat(1_273);
  const matrix = generateQRMatrix(value, 'H');

  assert.equal(matrix.size, 177);
  assert.equal(decodeMatrix(matrix), value);
});

test('fails closed on the first byte beyond high-error-correction capacity', () => {
  assert.throws(
    () => generateInteractiveQRMatrix('a'.repeat(1_274), true),
    (error) => (
      error instanceof DesignQRConfigError
      && error.code === 'QR_GENERATION_FAILED'
      && error.cause instanceof Error
    )
  );
});

test('low-level encoding preserves the maximum package-configured value at M', () => {
  const value = 'a'.repeat(2_048);
  const matrix = generateQRMatrix(value, 'M');

  assert.equal(decodeMatrix(matrix), value);
});

test('accepts a 57-module matrix and rejects a 61-module matrix', () => {
  assert.doesNotThrow(() => assertInteractiveQRMatrixSupported({ size: 57 }));
  assert.throws(
    () => assertInteractiveQRMatrixSupported({ size: 61 }),
    (error) => (
      error instanceof DesignQRConfigError
      && error.code === 'QR_GENERATION_FAILED'
      && error.message.includes('61×61')
      && error.message.includes('57×57')
    )
  );

  assert.equal(generateInteractiveQRMatrix('a'.repeat(200), false).size, 57);
  assert.throws(
    () => generateInteractiveQRMatrix('a'.repeat(220), false),
    (error) => (
      error instanceof DesignQRConfigError
      && error.code === 'QR_GENERATION_FAILED'
    )
  );
});
