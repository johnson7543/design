import QRCode from 'qrcode';

import { DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE } from '../../config/defaults.ts';
import { DesignQRConfigError } from '../../config/types.ts';

export type QRErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QRMatrixData {
  modules: boolean[][];
  size: number;
  errorCorrectionLevel: QRErrorCorrectionLevel;
}

export function resolveQRErrorCorrectionLevel(
  hasLogo: boolean
): 'M' | 'H' {
  return hasLogo ? 'H' : 'M';
}

export function generateQRMatrix(
  text: string,
  errorCorrectionLevel: QRErrorCorrectionLevel = 'M'
): QRMatrixData {
  const qr = QRCode.create(text, {
    errorCorrectionLevel,
  });
  const modules: boolean[][] = [];

  for (let row = 0; row < qr.modules.size; row += 1) {
    const moduleRow: boolean[] = [];

    for (let column = 0; column < qr.modules.size; column += 1) {
      moduleRow.push(qr.modules.get(column, row) === 1);
    }

    modules.push(moduleRow);
  }

  return {
    modules,
    size: qr.modules.size,
    errorCorrectionLevel,
  };
}

export function assertInteractiveQRMatrixSupported(
  matrix: Pick<QRMatrixData, 'size'>
): void {
  if (matrix.size <= DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE) return;

  throw new DesignQRConfigError(
    'QR_GENERATION_FAILED',
    [
      `This value produces a ${matrix.size}×${matrix.size}`,
      'QR matrix, above DesignQR’s temporary',
      `${DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE}×${DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE}`,
      'interactive rendering limit.',
      'Shorten the value or remove the logo.',
    ].join(' ')
  );
}

export function generateInteractiveQRMatrix(
  value: string,
  hasLogo: boolean
): QRMatrixData {
  const errorCorrectionLevel = resolveQRErrorCorrectionLevel(hasLogo);
  let matrix: QRMatrixData;

  try {
    matrix = generateQRMatrix(value, errorCorrectionLevel);
  } catch (cause) {
    throw new DesignQRConfigError(
      'QR_GENERATION_FAILED',
      `DesignQR could not encode the supplied value at error correction level ${errorCorrectionLevel}.`,
      cause
    );
  }

  assertInteractiveQRMatrixSupported(matrix);
  return matrix;
}

/**
 * Checks if a coordinate (r, c) is inside one of the 3 finder pattern eyes
 */
export function isFinderPattern(r: number, c: number, size: number): boolean {
  // Top-left finder pattern (0..6, 0..6)
  if (r <= 6 && c <= 6) return true;
  // Top-right finder pattern (0..6, size-7..size-1)
  if (r <= 6 && c >= size - 7) return true;
  // Bottom-left finder pattern (size-7..size-1, 0..6)
  if (r >= size - 7 && c <= 6) return true;
  return false;
}
