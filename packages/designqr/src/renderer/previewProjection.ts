/** A 2D affine transform in clip/NDC space; z and w remain untouched. */
export interface PreviewProjection {
  xx: number;
  xy: number;
  yx: number;
  yy: number;
  x: number;
  y: number;
}

/** Convert the presentation's CSS-pixel transform into a camera crop. */
export function resolvePreviewProjection(
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
  width: number, height: number,
): PreviewProjection | null {
  if (width <= 0 || height <= 0) return null;
  const xy = -matrix.c * height / width;
  const yx = -matrix.b * width / height;
  return {
    xx: matrix.a, xy, yx, yy: matrix.d,
    x: matrix.a - xy + 2 * matrix.e / width - 1,
    y: 1 + yx - matrix.d - 2 * matrix.f / height,
  };
}
