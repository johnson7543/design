import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOWLING_DURATION, BOWLING_PINS, createBowlingRoll, sampleBowlingBall, sampleBowlingPins, sampleBowlingPull } from '../src/bowling-model.ts';

test('bowling preserves the held pose and rolls in the opposite aiming direction', () => {
  for (const power of [0, 0.12, 0.5, 0.68, 1, -1, 2, NaN, Infinity]) {
    for (const direction of [-1, -0.3, 0, 0.3, 1, NaN]) {
      const held = sampleBowlingPull(power, direction);
      const released = sampleBowlingBall(power, 0, direction);
      for (const key of ['x', 'y', 'rotation', 'scale'] as const) assert.equal(released[key], held[key]);
      let previousY = held.y;
      for (let time = 0; time <= BOWLING_DURATION; time += 5) {
        const ball = sampleBowlingBall(power, time, direction);
        assert.ok([ball.x, ball.y, ball.rotation, ball.scale, ball.opacity].every(Number.isFinite));
        assert.ok(ball.y >= 14 && ball.y <= 110, 'The ball stays within the reveal vertically');
        assert.ok(ball.y <= previousY, 'The ball keeps rolling away');
        assert.ok(ball.scale >= 0.52 && ball.scale <= 1);
        previousY = ball.y;
      }
      assert.equal(sampleBowlingBall(power, BOWLING_DURATION, direction).opacity, 0);
    }
  }
  for (const direction of [-0.5, 0.5]) {
    const held = sampleBowlingPull(0.68, direction);
    const rolling = sampleBowlingBall(0.68, 100, direction);
    assert.ok((held.x - 80) * direction > 0);
    assert.ok((rolling.x - held.x) * direction < 0);
    assert.ok(rolling.scale < held.scale, 'The ball shrinks as it rolls away');
    assert.ok(rolling.rotation > held.rotation, 'The finger holes rotate with the roll');
  }
});

const fallenCount = (power: number, direction = 0) =>
  sampleBowlingPins(createBowlingRoll(power, direction), BOWLING_DURATION).filter(pin => pin.tilt > 1.4).length;

test('the ball fades while rolling and is gone before any stationary ending', () => {
  for (const power of [0.02, 0.12, 0.22, 0.68, 1]) for (const direction of [-1, 0, 1]) {
    let previous = sampleBowlingBall(power, 0, direction);
    let fadingFrames = 0;
    for (let time = 5; time <= BOWLING_DURATION; time += 5) {
      const ball = sampleBowlingBall(power, time, direction);
      assert.ok(ball.opacity <= previous.opacity, 'An exiting ball never reappears');
      if (ball.opacity > 0) {
        assert.ok(ball.y < previous.y, 'A visible ball keeps moving until it disappears');
        assert.ok(ball.rotation > previous.rotation, 'The ball keeps rolling through its fade');
        if (ball.opacity < 1) fadingFrames++;
      }
      previous = ball;
    }
    assert.ok(fadingFrames >= 20, 'The exit fades smoothly rather than popping off');
    assert.equal(sampleBowlingBall(power, 830, direction).opacity, 0, 'The ball is gone before the demo action completes');
  }
});

test('power and aim produce short rolls, partial racks, strikes, and wide misses', () => {
  assert.equal(fallenCount(0), 0);
  assert.equal(fallenCount(0.12), 0, 'A light roll stops before the pins');
  assert.ok(fallenCount(0.22) > 0 && fallenCount(0.22) < 10, 'A weak contact leaves pins standing');
  assert.equal(fallenCount(0.68), 10, 'A strong centered roll can clear the rack');
  assert.equal(fallenCount(1), 10);
  assert.ok(fallenCount(0.68, 0.3) > 0 && fallenCount(0.68, 0.3) < 10);
  for (const direction of [-1, 1]) {
    assert.equal(createBowlingRoll(1, direction).contacts.filter(Boolean).length, 0, 'Wide misses pass clear of the rack');
    assert.equal(fallenCount(1, direction), 0);
  }
  const head = BOWLING_PINS.findIndex(pin => pin.id === 1);
  assert.ok(createBowlingRoll(1).contacts[head]!.at < createBowlingRoll(0.5).contacts[head]!.at, 'Power increases roll speed');
});

test('wide rolls continue straight past the former lane edge without deflection', () => {
  for (const power of [0.35, 0.68, 1]) for (const direction of [-1, 1]) {
    const start = sampleBowlingPull(power, direction);
    const end = sampleBowlingBall(power, BOWLING_DURATION, direction);
    assert.ok(direction > 0 ? end.x < 0 : end.x > 160, 'The logical SVG edge does not stop a wide roll');
    let previousX = start.x;
    for (let time = 5; time <= BOWLING_DURATION; time += 5) {
      const ball = sampleBowlingBall(power, time, direction);
      assert.ok((ball.x - previousX) * direction <= 1e-9, 'No invisible side rail steers the ball back inward');
      const cross = (ball.x - start.x) * (end.y - start.y) - (ball.y - start.y) * (end.x - start.x);
      assert.ok(Math.abs(cross) < 1e-8, 'Every position follows the original aim line');
      previousX = ball.x;
    }
  }
});

test('pins react only after contact, and moving pins transfer momentum to the back row', () => {
  const roll = createBowlingRoll(0.68);
  const resting = sampleBowlingPins(null);
  const firstContact = Math.min(...roll.contacts.flatMap(contact => contact ? [contact.at] : []));
  assert.deepEqual(sampleBowlingPins(roll, firstContact), resting, 'No pin anticipates an impact');
  const early = sampleBowlingPins(roll, firstContact + 24);
  assert.ok(early.at(-1)!.tilt > 0, 'The head pin starts tipping when the ball arrives');
  assert.deepEqual(early[0], resting[0], 'The back row waits for an actual collision');
  assert.equal(early.at(-1)!.rotation, 0, 'A perfectly centered impact tips straight back without a forced side');
  for (const id of [7, 10]) {
    const contact = roll.contacts[BOWLING_PINS.findIndex(pin => pin.id === id)]!;
    assert.equal(typeof contact.source, 'number', 'The corner pins are reached by another pin');
    const source = roll.contacts[BOWLING_PINS.findIndex(pin => pin.id === contact.source)]!;
    assert.ok(contact.at > source.at, 'Momentum reaches a neighbor after its source is struck');
  }
  assert.ok(sampleBowlingPins(roll, 850).every(pin => pin.tilt > 1.4), 'The normal demo roll shows the chain reaction before completion');
});

test('the same pin can fall either way depending on the impact, including secondary collisions', () => {
  const pinFour = BOWLING_PINS.findIndex(pin => pin.id === 4);
  const fromNeighbor = createBowlingRoll(0.68, 0.12);
  const fromBall = createBowlingRoll(0.68, 0.32);
  assert.equal(typeof fromNeighbor.contacts[pinFour]!.source, 'number');
  assert.equal(fromBall.contacts[pinFour]!.source, 'ball');
  assert.ok(fromNeighbor.contacts[pinFour]!.impulseX < 0);
  assert.ok(fromBall.contacts[pinFour]!.impulseX > 0);
  assert.ok(sampleBowlingPins(fromNeighbor, 750)[pinFour].rotation < -50);
  assert.ok(sampleBowlingPins(fromBall, 750)[pinFour].rotation > 50,
    'A pin on the left of the rack can fall right when struck from its left');

  const head = BOWLING_PINS.findIndex(pin => pin.id === 1);
  for (const direction of [-0.03, 0.03]) {
    const roll = createBowlingRoll(0.68, direction);
    const contact = roll.contacts[head]!;
    assert.ok(contact.impulseX * direction > 0, 'Off-center contact pushes away from the ball');
    assert.ok(sampleBowlingPins(roll, contact.at + 30)[head].rotation * direction > 0);
  }
});

test('fixed-step snapshots remain deterministic, bounded, and smooth at arbitrary frame rates', () => {
  const resting = sampleBowlingPins(null);
  for (const power of [0, 0.22, 0.68, 1]) for (const direction of [-1, -0.3, -0.12, 0, 0.12, 0.3, 1]) {
    const roll = createBowlingRoll(power, direction);
    const end = sampleBowlingPins(roll, BOWLING_DURATION);
    assert.deepEqual(sampleBowlingPins(roll, BOWLING_DURATION + 500), end);
    assert.deepEqual(sampleBowlingPins(roll, -100), resting);
    for (const time of [700, 0, 500, 200, 900]) sampleBowlingPins(roll, time);
    assert.deepEqual(sampleBowlingPins(roll, BOWLING_DURATION), end, 'Sampling has no frame-history dependency');
    assert.deepEqual(createBowlingRoll(power, direction), roll, 'The same release repeats the same simulation');
    let previous = resting;
    for (let time = 1; time <= BOWLING_DURATION; time++) {
      const pins = sampleBowlingPins(roll, time);
      pins.forEach((pin, index) => {
        assert.ok(Object.values(pin).every(Number.isFinite));
        assert.ok(Math.hypot(pin.x - previous[index].x, pin.y - previous[index].y) < 0.2, 'Slides have no position jumps');
        const turn = ((pin.rotation - previous[index].rotation + 540) % 360) - 180;
        assert.ok(Math.abs(turn) < 1.5, 'Tipping and spin stay continuous');
        assert.ok(pin.x > 20 && pin.x < 140 && pin.y > 8 && pin.y < 60, 'Scatter stays inside the scene');
        assert.ok(pin.tilt >= 0 && pin.tilt <= Math.PI / 2 + 1e-10, 'The floor stops a falling pin');
        if (!roll.contacts[index]) assert.deepEqual(pin, resting[index], 'An untouched pin stays upright');
      });
      previous = pins;
    }
  }
});

test('mirrored impacts produce mirrored falls, without a preference from SVG pin order', () => {
  for (const direction of [0.03, 0.12, 0.3]) {
    const left = createBowlingRoll(0.68, direction);
    const right = createBowlingRoll(0.68, -direction);
    for (const time of [0, 200, 400, 600, 900, 1100]) {
      const a = sampleBowlingBall(0.68, time, direction);
      const b = sampleBowlingBall(0.68, time, -direction);
      assert.ok(Math.abs(a.x + b.x - 160) < 1e-9);
      assert.equal(a.y, b.y);
      const leftPins = sampleBowlingPins(left, time);
      const rightPins = sampleBowlingPins(right, time);
      BOWLING_PINS.forEach((pin, index) => {
        const mirror = BOWLING_PINS.findIndex(other => other.y === pin.y && other.x === 160 - pin.x);
        assert.equal(Boolean(left.contacts[index]), Boolean(right.contacts[mirror]));
        assert.ok(Math.abs(leftPins[index].x + rightPins[mirror].x - 160) < 1e-7);
        assert.ok(Math.abs(leftPins[index].y - rightPins[mirror].y) < 1e-7);
        assert.ok(Math.abs(leftPins[index].rotation + rightPins[mirror].rotation) < 1e-7);
        assert.ok(Math.abs(leftPins[index].tilt - rightPins[mirror].tilt) < 1e-7);
      });
    }
  }
});
