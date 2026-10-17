import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REST_NET, sampleNet } from '../src/net-model.ts';

const center = (ring: typeof REST_NET.rings[number]) => ({
  x: ring.reduce((sum, point) => sum + point.x, 0) / ring.length,
  y: ring.reduce((sum, point) => sum + point.y, 0) / ring.length,
});
const width = (ring: typeof REST_NET.rings[number]) => Math.max(...ring.map(p => p.x)) - Math.min(...ring.map(p => p.x));

test('net stays attached to the rim through a swish, angled make, and board impact', () => {
  for (const [power, direction] of [[0.68, 0], [0.6, 0.15], [1, -0.4]]) {
    for (let elapsed = 0; elapsed <= 1200; elapsed += 8) {
      const net = sampleNet(power, elapsed, direction);
      assert.deepEqual(net.rings[0], REST_NET.rings[0]);
      assert.ok(net.rings.flat().every(point => Object.values(point).every(Number.isFinite)));
      assert.ok(net.rings.every(ring => width(ring) > 0), 'The mesh never folds inside out');
    }
    assert.deepEqual(sampleNet(power, 1200, direction).rings, REST_NET.rings, 'The net returns exactly to rest');
  }
});

test('the net opens around a descending ball, stretches down, and recoils after exit', () => {
  const rest = REST_NET.rings.at(-1)!;
  assert.deepEqual(sampleNet(0.68, 500).rings, REST_NET.rings, 'The net waits for the ball');
  assert.equal(sampleNet(0.68, 200).threaded, false, 'Ascending balls pass in front of the mesh');
  assert.equal(sampleNet(0.68, 580).threaded, true, 'Descending makes pass behind the front cords');
  const loaded = sampleNet(0.68, 735).rings.at(-1)!;
  assert.ok(center(loaded).y > center(rest).y + 5, 'Ball weight stretches the free end');
  assert.ok(width(loaded) > width(rest) + 2, 'The narrow throat opens for the ball');
  const recoil = sampleNet(0.68, 850).rings.at(-1)!;
  assert.ok(center(recoil).y < center(rest).y, 'The released mesh springs upward');
  const later = sampleNet(0.68, 1000).rings.at(-1)!;
  assert.ok(Math.abs(center(later).y - center(rest).y) < Math.abs(center(recoil).y - center(rest).y), 'The rebound damps');
});

test('off-center makes pull the flexible net toward the ball and misses leave it still', () => {
  const left = sampleNet(0.68, 735, 0.12).rings.at(-1)!;
  const right = sampleNet(0.68, 735, -0.12).rings.at(-1)!;
  assert.ok(center(left).x < 76 && center(right).x > 84);
  assert.ok(Math.abs(center(left).x + center(right).x - 160) < 1e-10);
  assert.ok(Math.abs(width(left) - width(right)) < 1e-10);
  for (const [power, direction] of [[0, 0], [0.98, 0], [0.68, 0.5], [1, 0.8]]) {
    for (const elapsed of [0, 300, 580, 650, 735, 850, 1100]) {
      assert.deepEqual(sampleNet(power, elapsed, direction).rings, REST_NET.rings);
      assert.equal(sampleNet(power, elapsed, direction).threaded, false);
    }
  }
});

test('net motion is continuous and independent of previously sampled frames', () => {
  const reference = sampleNet(0.68, 735, 0.12);
  for (const elapsed of [1100, 0, 850, 530, 300]) sampleNet(1, elapsed, -0.4);
  assert.deepEqual(sampleNet(0.68, 735, 0.12), reference);
  let previous = sampleNet(0.68, 580, 0.12);
  for (let elapsed = 581; elapsed <= 1200; elapsed++) {
    const next = sampleNet(0.68, elapsed, 0.12);
    next.rings.forEach((ring, row) => ring.forEach((point, index) => {
      const before = previous.rings[row][index];
      assert.ok(Math.hypot(point.x - before.x, point.y - before.y) < 1, 'No one-unit jump within a millisecond');
    }));
    previous = next;
  }
});
