import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  boundPreviewZoom, DEFAULT_PREVIEW_ZOOM, normalizePreviewScale, normalizePreviewZoomMax,
  pinchPreview, PREVIEW_ZOOM_MAX, wheelPreviewScale, zoomPreviewAt,
} from '../packages/designqr/src/interaction/previewZoom.ts';
import { EDITOR_PREVIEW_ZOOM_MAX } from '../src/editor/preview-zoom.ts';

const size = { width: 390, height: 844 };
const center = { x: 0, y: 0 };

test('public preview zoom still starts fitted and is bounded to 100–300%', () => {
  assert.deepEqual(DEFAULT_PREVIEW_ZOOM, { scale: 1, x: 0, y: 0 });
  assert.deepEqual(boundPreviewZoom({ scale: -1, x: 900, y: 100 }, size), DEFAULT_PREVIEW_ZOOM);
  assert.deepEqual(zoomPreviewAt(DEFAULT_PREVIEW_ZOOM, 20, center, size), { scale: 3, x: 0, y: 0 });
});

test('the editor ceiling is 1000% without changing the public default', () => {
  assert.equal(PREVIEW_ZOOM_MAX, 3);
  assert.equal(EDITOR_PREVIEW_ZOOM_MAX, 10);
  for (const scale of [3.25, 6, 10]) {
    assert.equal(normalizePreviewScale(scale, EDITOR_PREVIEW_ZOOM_MAX), scale);
    assert.equal(zoomPreviewAt(DEFAULT_PREVIEW_ZOOM, scale, center, size, EDITOR_PREVIEW_ZOOM_MAX).scale, scale);
    assert.equal(normalizePreviewScale(scale), 3);
  }
  for (const ceiling of [NaN, Infinity, -Infinity]) assert.equal(normalizePreviewZoomMax(ceiling), 3);
  assert.equal(normalizePreviewZoomMax(999), 10);
  assert.equal(normalizePreviewZoomMax(-1), 1);
  assert.equal(normalizePreviewScale(999, EDITOR_PREVIEW_ZOOM_MAX), 10);
  assert.equal(normalizePreviewScale(NaN, EDITOR_PREVIEW_ZOOM_MAX), 1);
});

test('editor focal zoom, wheel, pan bounds, resize and reset all preserve the 10x ceiling', () => {
  const max = EDITOR_PREVIEW_ZOOM_MAX;
  const view = { scale: 6, x: -80, y: 120 }, anchor = { x: 65, y: -100 };
  const zoomed = zoomPreviewAt(view, 20, anchor, size, max);
  assert.equal(zoomed.scale, 10);
  for (const axis of ['x', 'y']) {
    assert.ok(Math.abs((anchor[axis] - view[axis]) / view.scale - (anchor[axis] - zoomed[axis]) / zoomed.scale) < 1e-9);
  }
  assert.ok(wheelPreviewScale(3, -100, 0, 844, max) > 3);
  assert.equal(wheelPreviewScale(9, -10000, 0, 844, max), 10);
  const panned = boundPreviewZoom({ scale: 10, x: 9999, y: -9999 }, size, max);
  assert.deepEqual(panned, { scale: 10, x: 1755, y: -3798 });
  assert.deepEqual(boundPreviewZoom(panned, { width: 320, height: 568 }, max), { scale: 10, x: 1440, y: -2556 });
  assert.deepEqual(zoomPreviewAt(panned, 1, anchor, size, max), DEFAULT_PREVIEW_ZOOM);
});

test('editor pinches grow beyond 300% and can still translate at 1000%', () => {
  const max = EDITOR_PREVIEW_ZOOM_MAX;
  const start = [{ x: -50, y: 0 }, { x: 50, y: 0 }];
  const current = [{ x: -80, y: 25 }, { x: 120, y: 25 }];
  assert.deepEqual(pinchPreview({ scale: 3, x: 0, y: 0 }, start, current, size, max), { scale: 6, x: 20, y: 25 });
  for (const scale of [6, 10]) {
    assert.deepEqual(pinchPreview({ scale, x: 0, y: 0 }, start, current, size, max), { scale: 10, x: 20, y: 25 });
  }
});

test('wheel zoom preserves the content under its focal point', () => {
  const view = { scale: 1.4, x: 20, y: -50 };
  const anchor = { x: 50, y: -110 };
  const next = zoomPreviewAt(view, 2, anchor, size);
  assert.ok(Math.abs((anchor.x - view.x) / view.scale - (anchor.x - next.x) / next.scale) < 1e-9);
  assert.ok(Math.abs((anchor.y - view.y) / view.scale - (anchor.y - next.y) / next.scale) < 1e-9);
  assert.deepEqual(view, { scale: 1.4, x: 20, y: -50 }, 'Never mutate earlier view snapshots.');
});

test('two fingers use Euclidean distance, including vertical pinches', () => {
  const start = [{ x: 0, y: -50 }, { x: 0, y: 50 }];
  const current = [{ x: 0, y: -100 }, { x: 0, y: 100 }];
  assert.deepEqual(pinchPreview(DEFAULT_PREVIEW_ZOOM, start, current, size), { scale: 2, x: 0, y: 0 });
});

test('pinch can scale and pan simultaneously without moving its focal content', () => {
  const start = [{ x: -40, y: -60 }, { x: 60, y: -60 }];
  const current = [{ x: -70, y: -30 }, { x: 130, y: -30 }];
  assert.deepEqual(pinchPreview(DEFAULT_PREVIEW_ZOOM, start, current, size), { scale: 2, x: 10, y: 90 });
});

test('two-finger translation pans at the maximum scale too', () => {
  const start = [{ x: -50, y: 0 }, { x: 50, y: 0 }];
  const current = [{ x: -80, y: 25 }, { x: 120, y: 25 }];
  assert.deepEqual(pinchPreview({ scale: 3, x: 0, y: 0 }, start, current, size), { scale: 3, x: 20, y: 25 });
});

test('pan and resize never reveal edges or strand the enlarged bitmap', () => {
  const panned = boundPreviewZoom({ scale: 2, x: 9999, y: -9999 }, size);
  assert.deepEqual(panned, { scale: 2, x: 195, y: -422 });
  assert.deepEqual(boundPreviewZoom(panned, { width: 320, height: 568 }), { scale: 2, x: 160, y: -284 });
  assert.deepEqual(zoomPreviewAt(panned, 1, { x: 100, y: 100 }, size), DEFAULT_PREVIEW_ZOOM);
});

test('wheel pixel, line and page modes are normalized and limited', () => {
  assert.equal(wheelPreviewScale(1, -16, 0, 844), wheelPreviewScale(1, -1, 1, 844));
  assert.equal(wheelPreviewScale(1, -100, 0, 100), wheelPreviewScale(1, -1, 2, 100));
  assert.equal(wheelPreviewScale(3, -10000, 0, 844), 3);
  assert.equal(wheelPreviewScale(1, 10000, 0, 844), 1);
  assert.equal(wheelPreviewScale(2, 0, 0, 844), 2);
});

test('coincident fingers and a collapsed viewport stay finite', () => {
  const view = pinchPreview(DEFAULT_PREVIEW_ZOOM, [center, center], [center, center], size);
  assert.deepEqual(view, DEFAULT_PREVIEW_ZOOM);
  assert.deepEqual(boundPreviewZoom({ scale: 3, x: 200, y: 100 }, { width: 0, height: 0 }),
    { scale: 3, x: 0, y: 0 });
});
