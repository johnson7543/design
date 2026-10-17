import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStoneThrow, sampleStonePull, sampleStoneShot, sampleStoneRipples } from '../src/stone-model.ts';

test('a stone releases from the held pose and launches opposite the pull direction', () => {
  for (const power of [0, 0.12, 0.5, 0.68, 1, -1, 2, NaN, Infinity]) {
    for (const direction of [-1, -0.3, 0, 0.3, 1, NaN]) {
      const held = sampleStonePull(power, direction);
      const throwing = createStoneThrow(power, direction);
      const released = sampleStoneShot(throwing, 0);
      for (const key of ['x', 'y', 'rotation', 'scale'] as const) assert.equal(released[key], held[key]);
      for (let time = 0; time <= throwing.duration; time += 5) {
        const pose = sampleStoneShot(throwing, time);
        assert.ok(Object.values(pose).every(Number.isFinite));
        assert.ok(pose.x > 15 && pose.x < 145 && pose.y > 8 && pose.y < 125, 'The throw stays within the logical scene');
        assert.ok(pose.scale > 0 && pose.scale <= 1 && pose.opacity >= 0 && pose.opacity <= 1);
      }
      if (direction && Number.isFinite(direction)) {
        const flying = sampleStoneShot(throwing, 100);
        assert.ok((held.x - 80) * direction > 0);
        assert.ok((flying.x - held.x) * direction < 0);
      }
    }
  }
});

test('stronger throws travel farther and skip more times, shedding speed and height on contact', () => {
  const throws = [0, 0.35, 0.68, 1].map(power => createStoneThrow(power));
  assert.deepEqual(throws.map(throwing => throwing.contacts.length), [1, 2, 4, 5]);
  for (let index = 1; index < throws.length; index++) {
    const a = throws[index - 1];
    const b = throws[index];
    assert.ok(b.contacts.at(-1)!.y < a.contacts.at(-1)!.y);
    assert.ok(b.contacts[0].at < a.contacts[0].at, 'A stronger throw reaches the water sooner');
  }
  for (const throwing of throws) {
    let previousHeight = Infinity;
    throwing.flights.forEach((flight, index) => {
      if (!index) return;
      const peak = sampleStoneShot(throwing, flight.at + flight.duration / 2);
      assert.ok(peak.height > 0 && peak.height < previousHeight, 'Each hop loses vertical energy');
      assert.ok(flight.speed < throwing.flights[index - 1].speed, 'Water contact reduces forward speed');
      previousHeight = peak.height;
    });
  }
});

test('stone contacts are continuous and create ripples only where the stone touches water', () => {
  const throwing = createStoneThrow(1, 0.5);
  throwing.contacts.forEach((contact, index) => {
    const before = sampleStoneShot(throwing, contact.at - 0.001);
    const at = sampleStoneShot(throwing, contact.at);
    const after = sampleStoneShot(throwing, contact.at + 0.001);
    assert.ok(Math.abs(at.height) < 1e-8);
    assert.ok(Math.abs(at.x - contact.x) < 1e-8 && Math.abs(at.y - contact.y) < 1e-8);
    for (const adjacent of [before, after]) assert.ok(Math.hypot(adjacent.x - at.x, adjacent.y - at.y) < 0.002);
    const hidden = sampleStoneRipples(throwing, contact.at - 0.001)[index * 2];
    const start = sampleStoneRipples(throwing, contact.at)[index * 2];
    const later = sampleStoneRipples(throwing, contact.at + 150)[index * 2];
    assert.equal(hidden.opacity, 0);
    assert.ok(start.opacity > later.opacity && later.opacity > 0);
    assert.ok(later.rx > start.rx && later.ry < later.rx, 'Ripples expand across a flattened water surface');
    assert.equal(start.x, contact.x);
    assert.equal(start.y, contact.y);
    assert.equal(later.x, contact.x);
    assert.equal(later.y, contact.y);
  });
  assert.ok(sampleStoneRipples(throwing, throwing.duration).every(ripple => ripple.opacity === 0));
  assert.ok(sampleStoneRipples(null, 500).every(ripple => ripple.opacity === 0));
});

test('a normal skip visibly descends into its next contact after accounting for depth', () => {
  for (const power of [0.68, 1]) {
    const throwing = createStoneThrow(power);
    const hop = throwing.flights[1];
    let highest = Infinity;
    for (let elapsed = 0; elapsed < hop.duration; elapsed += 1) {
      highest = Math.min(highest, sampleStoneShot(throwing, hop.at + elapsed).y);
    }
    assert.ok(throwing.contacts[1].y - highest > 2, 'The projected bounce reads as a hop rather than a straight flight');
  }
});

test('the stone sinks while still moving and disappears before the demo action completes', () => {
  for (const power of [0, 0.35, 0.68, 1]) {
    const throwing = createStoneThrow(power, 0.5);
    let previous = sampleStoneShot(throwing, throwing.sink.at);
    for (let time = throwing.sink.at + 5; time < throwing.sink.at + 120; time += 5) {
      const pose = sampleStoneShot(throwing, time);
      assert.ok(pose.opacity < previous.opacity && pose.opacity > 0);
      assert.ok(pose.x < previous.x && pose.groundY < previous.groundY, 'The stone drifts forward as it sinks');
      assert.ok(pose.scale < previous.scale);
      previous = pose;
    }
    assert.equal(sampleStoneShot(throwing, 830).opacity, 0);
    assert.equal(sampleStoneShot(throwing, throwing.duration + 1000).opacity, 0);
  }
});

test('aims mirror exactly and timestamp sampling is independent of frame order', () => {
  for (const power of [0, 0.35, 0.68, 1]) for (const direction of [0.2, 0.5, 1]) {
    const left = createStoneThrow(power, direction);
    const right = createStoneThrow(power, -direction);
    const end = sampleStoneShot(left, left.duration);
    for (const time of [700, 0, 500, 200, 900]) {
      const a = sampleStoneShot(left, time);
      const b = sampleStoneShot(right, time);
      assert.ok(Math.abs(a.x + b.x - 160) < 1e-8);
      assert.equal(a.y, b.y);
      assert.equal(a.opacity, b.opacity);
      const mirrored = sampleStoneRipples(right, time);
      sampleStoneRipples(left, time).forEach((ripple, index) => {
        assert.ok(Math.abs(ripple.x + mirrored[index].x - 160) < 1e-8);
        assert.equal(ripple.y, mirrored[index].y);
        assert.equal(ripple.opacity, mirrored[index].opacity);
      });
    }
    assert.deepEqual(sampleStoneShot(left, left.duration), end);
    assert.deepEqual(createStoneThrow(power, direction), left);
  }
});
