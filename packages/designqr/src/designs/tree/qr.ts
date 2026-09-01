import QRCode from 'qrcode';

const FALLBACK_QR_VALUE = 'https://design.johnson7543.com';

export interface QRMatrixData {
  modules: boolean[][];
  size: number;
  errorCorrectionLevel: string;
}

export function resolveQRErrorCorrectionLevel(
  hasLogo: boolean
): 'M' | 'H' {
  return hasLogo ? 'H' : 'M';
}

export function generateQRMatrix(
  text: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): QRMatrixData {
  try {
    const qr = QRCode.create(text || FALLBACK_QR_VALUE, {
      errorCorrectionLevel,
    });
    const size = qr.modules.size;
    const modules: boolean[][] = [];

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(qr.modules.get(c, r) === 1);
      }
      modules.push(row);
    }

    return {
      modules,
      size,
      errorCorrectionLevel,
    };
  } catch (err) {
    console.error('QR generation failed, falling back to default:', err);
    return generateQRMatrix(FALLBACK_QR_VALUE, errorCorrectionLevel);
  }
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
