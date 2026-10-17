import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPull, movePull } from '../src/gesture.ts';
import { BACKBOARD_IMPACT, classifyShot, pullDirection, pullPower, sampleBackboard, samplePull, sampleShot } from '../src/shot-model.ts';
import { DART_DURATION, DART_IMPACT, sampleDartPull, sampleDartShot } from '../src/dart-model.ts';
import { REST_NET, sampleNet } from '../src/net-model.ts';
import { createActionController, type ActionOptions, type ActionState } from '../src/action-controller.ts';
import type { PullContext } from '../src/types.ts';

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('dart launches continuously, lands at its tip, and responds to pull power', () => {
  for (const power of [0, 0.4, 0.68, 1, -1, 2, NaN, Infinity]) {
    const held = sampleDartPull(power);
    const released = sampleDartShot(power, 0);
    for (const key of ['x', 'y', 'rotation'] as const) assert.equal(released[key], held[key]);
    for (const time of [0, 180, DART_IMPACT - 1, DART_IMPACT, 440, 700, DART_DURATION]) {
      assert.ok(Object.values(sampleDartShot(power, time)).every(Number.isFinite));
    }
    assert.equal(sampleDartShot(power, DART_DURATION).opacity, 0);
  }
  const bullseye = sampleDartShot(0.68, DART_IMPACT);
  assert.equal(bullseye.x, 80);
  assert.equal(bullseye.y, 34);
  assert.ok(bullseye.pulse > 0);
  const embedded = sampleDartShot(0.68, DART_IMPACT + 24);
  assert.equal(embedded.x, bullseye.x);
  assert.equal(embedded.y, bullseye.y, 'Impact wobble keeps the dart tip anchored');
  assert.notEqual(embedded.rotation, bullseye.rotation);
  assert.equal(sampleDartShot(0.68, 700).rotation, 0, 'The wobble settles');
  assert.ok(sampleDartShot(1, DART_IMPACT).y < bullseye.y, 'Full power lands higher');
  assert.ok(sampleDartShot(1, DART_IMPACT).pulse > 0, 'Full power still contacts the target');
  assert.equal(sampleDartShot(0, DART_IMPACT).pulse, 0, 'A short throw misses without a hit effect');
  assert.ok(sampleDartShot(0, 700).y > sampleDartShot(0, DART_IMPACT).y, 'Misses fall away');
});

test('positive pulls include tiny and down-then-back gestures; canceled intent never revives', () => {
  const tiny = createPull(20, 40);
  assert.equal(movePull(tiny, 20, 44), true);
  assert.equal(tiny.maximum, 4);
  movePull(tiny, 20, 40);
  assert.equal(tiny.maximum, 4);
  assert.equal(pullPower(tiny.distance), 0);
  for (const [x, y] of [[20, 39], [28, 44]]) {
    const gesture = createPull(20, 40);
    assert.equal(movePull(gesture, x, y), false);
    assert.equal(movePull(gesture, 20, 100), false);
  }
  assert.equal(movePull(createPull(0, 0), 0, 0), false);
});

test('claimed pulls preserve signed lateral movement independently of power', () => {
  const pull = createPull(100, 20);
  assert.equal(movePull(pull, 110, 40), true, 'A downward diagonal can start a pull');
  assert.equal(pull.offsetX, 10);
  assert.equal(movePull(pull, 25, 40), true, 'A claimed pull can steer farther sideways');
  assert.equal(pull.offsetX, -75);
  assert.equal(pull.distance, 20, 'Steering does not add power');
  movePull(pull, 100, 20);
  assert.equal(pull.offsetX, 0);
  assert.equal(pull.distance, 0);
  assert.equal(pull.maximum, 20, 'Recentering still permits trigger');
  for (const [offset, direction] of [[-180, -1], [-45, -0.5], [0, 0], [45, 0.5], [180, 1], [NaN, 0], [Infinity, 0]]) {
    assert.equal(pullDirection(offset), direction);
  }
});

test('both games follow the pull while held and launch in the opposite direction', () => {
  for (const offset of [-45, 45]) {
    const direction = pullDirection(offset);
    for (const [pull, shot] of [[samplePull, sampleShot], [sampleDartPull, sampleDartShot]]) {
      const held = pull(0.68, direction);
      assert.ok((held.x - 80) * offset > 0, 'Held projectile follows the finger');
      assert.equal(shot(0.68, 0, direction).x, held.x, 'Release does not jump');
      assert.ok((shot(0.68, 16, direction).x - held.x) * offset < 0, 'Flight immediately opposes the pull');
      assert.ok((shot(0.68, 580, direction).x - 80) * offset < 0, 'Pulling right shoots left and pulling left shoots right');
    }
  }
});

test('both games preserve the aimed release pose and mirror left/right flight', () => {
  for (const power of [0, 0.68, 1]) {
    for (const direction of [-2, -1, -0.4, 0, 0.4, 1, 2, NaN, Infinity]) {
      for (const [pull, shot] of [[samplePull, sampleShot], [sampleDartPull, sampleDartShot]]) {
        const held = pull(power, direction);
        const released = shot(power, 0, direction);
        for (const key of ['x', 'y', 'rotation'] as const) assert.equal(released[key], held[key]);
        for (const time of [0, 180, 220, 360, 580, 900, 1200]) {
          assert.ok(Object.values(shot(power, time, direction)).every(Number.isFinite));
        }
      }
    }
    for (const time of [180, 220, 360, 580]) {
      for (const shot of [sampleShot, sampleDartShot]) {
        const left = shot(power, time, -0.8);
        const right = shot(power, time, 0.8);
        assert.ok(left.x > 80 && right.x < 80);
        assert.ok(Math.abs(left.x + right.x - 160) < 1e-10);
        assert.equal(left.y, right.y, 'Direction does not change vertical power');
      }
    }
  }
});

test('aim affects actual hits instead of only moving the artwork', () => {
  assert.equal(classifyShot(0.68, 0), 'perfect');
  assert.equal(classifyShot(0.68, 0.1), 'made');
  assert.equal(classifyShot(0.68, 0.5), 'wide');
  assert.deepEqual(sampleNet(0.68, 650, 0.5).rings, REST_NET.rings, 'A wide ball cannot shake the net');
  assert.equal(sampleShot(0.68, 650, 0.5).pulse, 0, 'A wide ball cannot celebrate');
  assert.equal(classifyShot(1, 0.4), 'smash');
  assert.equal(classifyShot(1, 0.8), 'wide');
  assert.equal(sampleShot(1, BACKBOARD_IMPACT, 0.8).scaleX, 1, 'A missed board cannot squash the ball');
  assert.deepEqual(sampleNet(1, BACKBOARD_IMPACT, 0.8).rings, REST_NET.rings);
  assert.ok(sampleShot(1, BACKBOARD_IMPACT, 0.8).x < 59 - 7.4);
  assert.ok(sampleDartShot(0.68, DART_IMPACT, 0.3).pulse > 0, 'An off-center dart can hit a ring');
  assert.equal(sampleDartShot(0.68, DART_IMPACT, 0.8).pulse, 0, 'A wide dart misses the target');
  const held = sampleDartPull(0.68, 0.3);
  const landed = sampleDartShot(0.68, DART_IMPACT, 0.3);
  assert.ok(Math.abs(Math.tan(held.rotation * Math.PI / 180) - (landed.x - held.x) / (held.y - landed.y)) < 1e-10, 'The dart points along its flight');
});

test('shot bands have inclusive boundaries with a 1e-10 arithmetic tolerance', () => {
  for (const [power, result] of [[0.1, 'short'], [0.56, 'made'], [0.635, 'perfect'], [0.68, 'perfect'], [0.725, 'perfect'], [0.8, 'made'], [0.98, 'long'], [1, 'smash'], [2, 'smash']] as const) {
    assert.equal(classifyShot(power), result);
  }
  assert.equal(classifyShot(0.56 - 1e-7), 'short');
  assert.equal(classifyShot(0.635 - 1e-7), 'made');
  assert.equal(classifyShot(0.725 + 1e-7), 'made');
  assert.equal(classifyShot(0.8 + 1e-7), 'long');
  for (const power of [0, 0.6, 0.68, 1]) {
    assert.equal(sampleShot(power, 0).x, 80);
    if (power < 1) assert.equal(sampleShot(power, 400).x, 80);
    assert.equal(sampleShot(power, 1200).opacity, 0);
    for (const time of [0, 300, 580, 581, 900, 1200]) {
      assert.ok(Object.values(sampleShot(power, time)).every(Number.isFinite));
    }
  }
  assert.ok(Math.abs(sampleShot(0.68, 580).y - 34) < 1e-10);
  assert.ok(sampleShot(0, 300).y > 34);
  assert.ok(sampleShot(1, 900).x > 80);
});

test('full power strikes and shatters the board before a hard rebound', () => {
  assert.equal(classifyShot(1 - 1e-7), 'long', 'Only full charge smashes the board');
  assert.equal(classifyShot(1 - 1e-11), 'smash', 'Scaled input tolerates floating-point rounding at full charge');
  const before = sampleShot(1, BACKBOARD_IMPACT - 1);
  const hit = sampleShot(1, BACKBOARD_IMPACT);
  const held = sampleShot(1, BACKBOARD_IMPACT + 30);
  const rebound = sampleShot(1, BACKBOARD_IMPACT + 180);
  assert.ok(before.y > 23 && before.y - hit.y < 1);
  assert.equal(hit.x, 80);
  assert.equal(hit.y, 23, 'Contact happens on the board face');
  assert.ok(hit.scaleX > 1.3 && hit.scaleY < 0.7, 'The ball visibly compresses at impact');
  assert.equal(held.x, hit.x);
  assert.equal(held.y, hit.y);
  assert.equal(held.rotation, hit.rotation, 'The short impact hold includes spin');
  assert.ok(rebound.x > hit.x && rebound.y > hit.y, 'The ball rebounds down and away');
  assert.equal(sampleShot(1, 900).opacity, 0);
  assert.equal(sampleBackboard(BACKBOARD_IMPACT - 1).fragments, 0);
  assert.equal(sampleBackboard(BACKBOARD_IMPACT).panel, 0);
  assert.equal(sampleBackboard(BACKBOARD_IMPACT).fragments, 1, 'Fragments replace the board at contact');
  assert.ok(sampleBackboard(BACKBOARD_IMPACT + 60).spread > 0);
  assert.ok(Math.abs(sampleBackboard(BACKBOARD_IMPACT + 20).shakeX) > 1, 'The board absorbs the hit');
  assert.equal(sampleBackboard(900).impact, 0);
  assert.equal(sampleBackboard(900).fragments, 0, 'The impact clears before the shot ends');
  for (const time of [0, 120, 219, 220, 240, 255, 400, 760, 1200]) {
    assert.ok(Object.values(sampleBackboard(time)).every(Number.isFinite));
    assert.ok(Object.values(sampleShot(1, time)).every(Number.isFinite));
  }
});

test('release preserves the held ball pose and its stretch settles during launch', () => {
  for (const power of [0, 0.02, 0.4, 0.68, 1, -1, 2, NaN, Infinity]) {
    const held = samplePull(power);
    const released = sampleShot(power, 0);
    for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const) {
      assert.equal(released[key], held[key], `${key} stays continuous at release`);
      assert.ok(Number.isFinite(released[key]));
    }
    const rising = sampleShot(power, 60);
    const settled = sampleShot(power, 120);
    assert.ok(rising.y < held.y, 'The ball starts moving toward the hoop');
    assert.ok(rising.scaleX <= held.scaleX && rising.scaleX >= 1);
    assert.ok(rising.scaleY >= held.scaleY && rising.scaleY <= 1);
    assert.equal(settled.scaleX, 1);
    assert.equal(settled.scaleY, 1);
  }
});

test('onPull runs synchronous actions once and settles for each activation source', async () => {
  let card = 0;
  const sources: string[] = [];
  const states: ActionState[] = [];
  const controller = createActionController(() => ({
    onPull: ({ source, signal }) => {
      assert.equal(signal.aborted, false);
      card = (card + 1) % 4;
      sources.push(source);
    },
  }), state => states.push(state));
  for (const source of ['pull', 'keyboard', 'imperative'] as const) {
    const outcome = controller.trigger(source);
    assert.equal(controller.trigger('imperative'), outcome, 'Concurrent activation joins even synchronous work');
    assert.deepEqual(await outcome, { status: 'success' });
    assert.equal(controller.isPending(), false);
  }
  assert.equal(card, 3, 'A local state action runs once per accepted activation');
  assert.deepEqual(sources, ['pull', 'keyboard', 'imperative']);
  assert.deepEqual(states, ['pending', 'success', 'pending', 'success', 'pending', 'success']);
});

test('concurrent calls share the exact Promise, including disabled joins; options update next action', async () => {
  const work = deferred();
  const states: ActionState[] = [];
  let calls = 0;
  let context: PullContext | undefined;
  let options: ActionOptions = { onPull: ctx => { calls++; context = ctx; return work.promise; } };
  const controller = createActionController(() => options, state => states.push(state));
  const first = controller.trigger('pull');
  options = { ...options, disabled: true };
  assert.equal(controller.trigger('imperative'), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(context?.source, 'pull');
  work.resolve();
  assert.deepEqual(await first, { status: 'success' });
  assert.deepEqual(states, ['pending', 'success']);
  assert.deepEqual(await controller.trigger('imperative'), { status: 'skipped', reason: 'disabled' });
  options = { onPull: async () => { calls += 10; } };
  await controller.trigger('imperative');
  assert.equal(calls, 11);
});

test('sync throws and rejection are error outcomes with exactly one notification; retry succeeds', async () => {
  const failure = new Error('offline');
  let errors = 0;
  let options: ActionOptions = { onPull: () => { throw failure; }, onPullError: error => { assert.equal(error, failure); errors++; } };
  const controller = createActionController(() => options, () => {});
  assert.deepEqual(await controller.trigger('pull'), { status: 'error', error: failure });
  options = { ...options, onPull: () => Promise.reject(failure) };
  assert.deepEqual(await controller.trigger('keyboard'), { status: 'error', error: failure });
  assert.equal(errors, 2);
  options = { onPull: async () => {} };
  assert.deepEqual(await controller.trigger('imperative'), { status: 'success' });
});

test('disposal aborts and settles immediately even when the host ignores the signal; late rejection is consumed', async () => {
  const work = deferred();
  let signal: AbortSignal | undefined;
  const states: ActionState[] = [];
  let errors = 0;
  const controller = createActionController(() => ({
    onPull: context => { signal = context.signal; return work.promise; },
    onPullError: () => { errors++; },
  }), state => states.push(state));
  const outcome = controller.trigger('imperative');
  await Promise.resolve();
  controller.dispose();
  assert.equal(signal?.aborted, true);
  assert.deepEqual(await outcome, { status: 'aborted' });
  work.reject(new Error('late failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(states, ['pending']);
  assert.equal(errors, 0);
  assert.deepEqual(await controller.trigger('imperative'), { status: 'skipped', reason: 'unmounted' });
});
