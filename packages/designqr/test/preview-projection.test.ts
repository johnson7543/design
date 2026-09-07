import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePreviewProjection } from '../src/renderer/previewProjection.ts';
import { normalizePreviewScale } from '../src/interaction/previewZoom.ts';
import { ThreeFallbackRenderer } from '../src/renderer/webgl/ThreeFallbackRenderer.ts';

test('clip projection reproduces the CSS affine transform without a bigger buffer', () => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    for (const matrix of [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      { a: 3, b: 0, c: 0, d: 3, e: -width + 30, f: -height - 60 },
      { a: 10, b: 0, c: 0, d: 10, e: -width * 4.5 + 130, f: -height * 4.5 - 270 },
      { a: 1.3, b: .2, c: -.1, d: 1.5, e: 14, f: -45 },
    ]) {
      const p = resolvePreviewProjection(matrix, width, height)!;
      for (const [x, y] of [[0, 0], [-1, 1], [1, -1], [.23, -.76]]) {
        const px = (x + 1) * width / 2, py = (1 - y) * height / 2;
        const expectedX = (matrix.a * px + matrix.c * py + matrix.e) * 2 / width - 1;
        const expectedY = 1 - (matrix.b * px + matrix.d * py + matrix.f) * 2 / height;
        assert.ok(Math.abs(p.xx * x + p.xy * y + p.x - expectedX) < 1e-10);
        assert.ok(Math.abs(p.yx * x + p.yy * y + p.y - expectedY) < 1e-10);
      }
    }
  }
  assert.equal(resolvePreviewProjection({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 0, 200), null);
});

test('imperative zoom clamps its range and rejects non-finite scales', () => {
  for (const value of [NaN, Infinity, -Infinity, -4, 0]) assert.equal(normalizePreviewScale(value), 1);
  assert.equal(normalizePreviewScale(1.75), 1.75);
  assert.equal(normalizePreviewScale(99), 3);
  assert.equal(normalizePreviewScale(99, 10), 10);
  assert.equal(normalizePreviewScale(6.25, 10), 6.25);
});

test('unzoomed exports do not render again, and zoomed snapshots restore before returning', () => {
  const calls: string[] = [];
  const shell = {
    sourceIsPreview: false,
    isDestroyed: false,
    renderScene(preview: boolean) { calls.push(preview ? 'preview' : 'canonical'); },
    onAfterRender() { calls.push('paint'); },
  };
  const renderer = shell as unknown as ThreeFallbackRenderer;
  const capture = () => { calls.push('snapshot'); return Promise.resolve('png'); };
  const snapshot = ThreeFallbackRenderer.prototype.withBaseFrame.call(renderer, capture);
  assert.ok(snapshot instanceof Promise);
  assert.deepEqual(calls, ['snapshot']);
  calls.length = 0;
  shell.sourceIsPreview = true;
  ThreeFallbackRenderer.prototype.withBaseFrame.call(renderer, capture);
  assert.deepEqual(calls, ['canonical', 'snapshot', 'preview', 'paint']);
  calls.length = 0;
  assert.throws(() => ThreeFallbackRenderer.prototype.withBaseFrame.call(renderer, () => {
    calls.push('failed snapshot'); throw new Error('Export failed');
  }), /Export failed/);
  assert.deepEqual(calls, ['canonical', 'failed snapshot', 'preview', 'paint']);
});
