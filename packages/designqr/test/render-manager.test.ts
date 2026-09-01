import assert from 'node:assert/strict';
import test from 'node:test';

import { RenderManager } from '../src/renderer/RenderManager.ts';

test('dragging preserves an enabled turntable while updating rotation', () => {
  let resetCancelled = false;
  const renderer = {
    yaw: 1,
    pitch: -0.5,
    isTurntable: true,
    cancelRotationReset() {
      resetCancelled = true;
    },
  };
  const manager = new RenderManager({} as HTMLCanvasElement);
  (manager as unknown as { renderer: typeof renderer }).renderer = renderer;

  manager.handleDrag(12, -10);

  assert.equal(resetCancelled, true);
  assert.equal(renderer.yaw, 1 + 12 * 0.006);
  assert.equal(renderer.pitch, -0.5 - 10 * 0.006);
  assert.equal(renderer.isTurntable, true);
});

test('forwards the configured transition speed to the renderer', () => {
  let configuredSpeed = 0;
  const renderer = {
    setTransitionSpeed(speed: number) {
      configuredSpeed = speed;
    },
  };
  const manager = new RenderManager({} as HTMLCanvasElement);
  (manager as unknown as { renderer: typeof renderer }).renderer = renderer;

  manager.setTransitionSpeed(1.75);

  assert.equal(configuredSpeed, 1.75);
});
