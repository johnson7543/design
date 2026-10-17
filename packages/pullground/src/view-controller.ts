import { attachInput } from './input.ts';
import { createActionController, type ActionState } from './action-controller.ts';
import { BACKBOARD_FRAGMENTS, classifyShot, pullDirection, pullPower, sampleBackboard, samplePull, sampleShot, shotTargetX, SHOT_DURATION, SMASH_DURATION } from './shot-model.ts';
import { DART_DURATION, sampleDartPull, sampleDartShot } from './dart-model.ts';
import { REST_NET, sampleNet } from './net-model.ts';
import { BOWLING_DURATION, createBowlingRoll, sampleBowlingBall, sampleBowlingPins, sampleBowlingPull, type BowlingRoll } from './bowling-model.ts';
import { createStoneThrow, sampleStonePull, sampleStoneShot, sampleStoneRipples, type StoneThrow } from './stone-model.ts';
import type { PullgroundProps, PullSource } from './types.ts';

export interface ViewState {
  action: ActionState;
  pulling: boolean;
  shooting: boolean;
  reduced: boolean;
}
export const initialViewState: ViewState = {
  action: 'idle', pulling: false, shooting: false, reduced: false,
};
export interface ViewElements {
  viewport: HTMLDivElement;
  reveal: HTMLDivElement;
  content: HTMLDivElement;
  status: HTMLDivElement;
  ball: SVGGElement;
  net: SVGPathElement;
  netBack: SVGPathElement;
  netUnder: SVGPathElement;
  pulse: SVGCircleElement;
  backboard: SVGGElement;
  panel: SVGGElement;
  fragments: SVGGElement;
  impact: SVGGElement;
  dart: SVGGElement;
  dartPulse: SVGCircleElement;
  bowlingBall: SVGGElement;
  bowlingPins: SVGGElement;
  stone: SVGGElement;
  stoneShadow: SVGEllipseElement;
  stoneRipples: SVGGElement;
  aim: SVGPathElement;
}

export function createViewController(
  elements: ViewElements,
  getOptions: () => PullgroundProps,
  onChange: (state: ViewState) => void,
) {
  const { viewport, reveal, content, status, ball, net, netBack, netUnder, pulse, backboard, panel, fragments, impact, dart, dartPulse, bowlingBall, bowlingPins, stone, stoneShadow, stoneRipples, aim } = elements;
  const fragmentNodes = Array.from(fragments.children);
  const pinNodes = Array.from(bowlingPins.children);
  const rippleNodes = Array.from(stoneRipples.children);
  let state = { ...initialViewState };
  let disposed = false;
  let frame = 0;
  let scale = 1;
  let inputZoom = 1;
  let distance = 0;
  let pullOffset = 0;
  let returnAnimation: Animation | null = null;
  let game = getOptions().game ?? 'basketball';
  let shot: { power: number; direction: number; started: number; smash: boolean; bowling: BowlingRoll | null; stone: StoneThrow | null } | null = null;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');

  function measureScale() {
    // One logical scene scales with the host's shorter side, including embeds.
    // Layout dimensions exclude CSS zoom/transform so those apply only once.
    scale = Math.min(viewport.clientWidth, viewport.clientHeight) / 384 || 1;
    viewport.style.setProperty('--pullground-scale', String(scale));
  }
  function change(patch: Partial<ViewState>) {
    const next = { ...state, ...patch };
    if (Object.keys(next).some(key => next[key as keyof ViewState] !== state[key as keyof ViewState])) {
      state = next;
      if (!disposed) onChange(state);
    }
  }
  function stopReturn(preservePosition = false) {
    if (!returnAnimation) return 0;
    const offset = preservePosition
      ? Math.max(0, new DOMMatrixReadOnly(getComputedStyle(content).transform).m42) : 0;
    returnAnimation.cancel();
    returnAnimation = null;
    delete content.dataset.returning;
    if (preservePosition) {
      // Transfer the current visual offset back into flow before another pull.
      reveal.dataset.following = 'true';
      reveal.style.setProperty('--pullground-reveal-height', `${offset}px`);
    }
    return offset;
  }
  function paintHeight() {
    // Height is written in layout pixels, so do not include host CSS zoom/scale.
    const compact = Math.max(44, status.offsetHeight);
    const height = state.pulling ? (state.reduced ? compact : Math.min(Math.max(168 * scale, pullOffset), pullOffset + distance * scale * 0.88))
      : state.shooting ? 144 * scale
      : state.action === 'pending' || state.action === 'error' ? compact : 0;
    const closing = height === 0 && parseFloat(reveal.style.getPropertyValue('--pullground-reveal-height')) > 0;
    const previousHeight = closing ? parseFloat(getComputedStyle(reveal).blockSize) : 0;
    const previousScroll = viewport.scrollTop;
    // Closing changes layout once. Only the owned content's transform animates,
    // avoiding a full consumer-layout pass on every frame of the return slide.
    reveal.dataset.following = String(state.pulling || state.reduced || height === 0);
    reveal.style.setProperty('--pullground-reveal-height', `${height}px`);
    if (closing && !state.reduced && !document.hidden) {
      const offset = previousHeight + viewport.scrollTop - previousScroll;
      if (offset > 0) {
        const animation = content.animate([
          { transform: `translate3d(0, ${offset}px, 0)` },
          { transform: 'none' },
        ], { duration: 180, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' });
        returnAnimation = animation;
        content.dataset.returning = 'true';
        animation.onfinish = () => { if (returnAnimation === animation) stopReturn(); };
      }
    }
  }
  function paintBall(pose: ReturnType<typeof samplePull>) {
    ball.setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scaleX} ${pose.scaleY})`);
  }
  function paintDart(pose: ReturnType<typeof sampleDartPull>) {
    dart.setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.rotation})`);
  }
  function paintBowlingBall(pose: ReturnType<typeof sampleBowlingPull>) {
    bowlingBall.setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scale})`);
  }
  function paintBowlingPins(roll: BowlingRoll | null, elapsed = 0) {
    sampleBowlingPins(roll, elapsed).forEach((pose, index) => {
      pinNodes[index].setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scaleX} ${pose.scaleY})`);
    });
  }
  function paintStone(pose: ReturnType<typeof sampleStonePull>) {
    stone.setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scale})`);
  }
  function paintStoneShadow(x: number, y: number, size = 1, opacity = 0.1) {
    stoneShadow.setAttribute('cx', String(x));
    stoneShadow.setAttribute('cy', String(y));
    stoneShadow.setAttribute('rx', String(7 * size));
    stoneShadow.setAttribute('ry', String(1.8 * size));
    stoneShadow.setAttribute('opacity', String(opacity));
  }
  function paintStoneRipples(throwing: StoneThrow | null, elapsed = 0) {
    sampleStoneRipples(throwing, elapsed).forEach((ripple, index) => {
      const node = rippleNodes[index];
      for (const [attribute, value] of Object.entries({ cx: ripple.x, cy: ripple.y, rx: ripple.rx, ry: ripple.ry, opacity: ripple.opacity })) {
        node.setAttribute(attribute, String(value));
      }
    });
  }
  function paintNet(sample = REST_NET) {
    netBack.setAttribute('d', sample.back);
    // The ball flies in front on ascent and behind the near cords on its way down.
    netUnder.setAttribute('d', sample.threaded ? '' : sample.front);
    net.setAttribute('d', sample.threaded ? sample.front : '');
  }
  function paintAim(power: number, direction: number) {
    // A short preview uses the same trajectory as the release, without another loop.
    const sample = game === 'bowling' ? sampleBowlingBall : game === 'dart' ? sampleDartShot : sampleShot;
    const throwing = game === 'stone' ? createStoneThrow(power, direction) : null;
    const start = game === 'basketball' ? 45 : 80;
    const end = game === 'stone' ? 160 : game === 'basketball' ? 150 : 260;
    aim.setAttribute('d', Array.from({ length: 7 }, (_, index) => {
      const time = start + (end - start) * index / 6;
      const pose = throwing ? sampleStoneShot(throwing, time) : sample(power, time, direction);
      return `${index ? 'L' : 'M'}${pose.x} ${pose.y}`;
    }).join(' '));
  }
  function paintBackboard(elapsed: number, hitX = 80) {
    const sample = sampleBackboard(elapsed);
    backboard.setAttribute('transform', `translate(${sample.shakeX} 0) rotate(${sample.rotation} 80 23)`);
    panel.setAttribute('opacity', String(sample.panel));
    fragments.setAttribute('opacity', String(sample.fragments));
    fragmentNodes.forEach((node, index) => {
      const fragment = BACKBOARD_FRAGMENTS[index];
      node.setAttribute('transform', `translate(${fragment.dx * sample.spread} ${fragment.dy * sample.spread + sample.fall}) rotate(${fragment.rotation * sample.spread} ${fragment.x} ${fragment.y})`);
    });
    impact.setAttribute('opacity', String(sample.impact * 0.85));
    impact.setAttribute('transform', `translate(${Math.max(59, Math.min(101, hitX))} 23) scale(${sample.impactScale}) translate(-80 -23)`);
  }
  function resetArt() {
    aim.removeAttribute('d');
    paintDart(sampleDartPull(0));
    dart.setAttribute('opacity', '1');
    dartPulse.setAttribute('opacity', '0');
    paintBowlingBall(sampleBowlingPull(0));
    bowlingBall.setAttribute('opacity', '1');
    paintBowlingPins(null);
    paintStone(sampleStonePull(0));
    stone.setAttribute('opacity', '1');
    paintStoneShadow(80, 112);
    paintStoneRipples(null);
    paintBall(samplePull(0));
    ball.setAttribute('opacity', '1');
    paintNet();
    pulse.setAttribute('opacity', '0');
    paintBackboard(0);
  }
  function stopArt() {
    pullOffset = 0;
    shot = null;
    cancelAnimationFrame(frame);
    frame = 0;
    change({ shooting: false, pulling: false });
    resetArt();
  }
  function move(nextDistance: number, offsetX = 0, keyboard = false) {
    if (!state.pulling) inputZoom = viewport.getBoundingClientRect().height / viewport.offsetHeight || 1;
    distance = keyboard ? nextDistance : nextDistance / inputZoom / scale;
    if (!state.pulling) {
      stopArt();
      pullOffset = stopReturn(true);
      change({ pulling: true });
    }
    const power = pullPower(distance);
    const direction = pullDirection(keyboard ? offsetX : offsetX / inputZoom / scale);
    if (game === 'bowling') paintBowlingBall(sampleBowlingPull(power, direction));
    else if (game === 'stone') {
      const pose = sampleStonePull(power, direction);
      paintStone(pose);
      paintStoneShadow(pose.x, pose.y + 14);
    } else if (game === 'dart') paintDart(sampleDartPull(power, direction));
    else paintBall(samplePull(power, direction));
    paintAim(power, direction);
    pulse.setAttribute('opacity', '0');
    paintHeight();
  }
  function tick(now: number) {
    frame = 0;
    if (disposed) return;
    if (input.isKeyboard()) {
      move(input.keyboardDistance(), input.keyboardOffsetX(), true);
    } else if (shot) {
      const elapsed = now - shot.started;
      if (elapsed >= (shot.stone?.duration ?? (game === 'bowling' ? BOWLING_DURATION : game === 'dart' ? DART_DURATION : shot.smash ? SMASH_DURATION : SHOT_DURATION))) {
        stopArt();
        paintHeight();
        return;
      }
      if (shot.stone) {
        const pose = sampleStoneShot(shot.stone, elapsed);
        paintStone(pose);
        stone.setAttribute('opacity', String(pose.opacity));
        paintStoneShadow(pose.x, pose.groundY, pose.shadowScale, pose.shadowOpacity);
        paintStoneRipples(shot.stone, elapsed);
      } else if (game === 'bowling') {
        const sample = sampleBowlingBall(shot.power, elapsed, shot.direction);
        paintBowlingBall(sample);
        bowlingBall.setAttribute('opacity', String(sample.opacity));
        paintBowlingPins(shot.bowling, elapsed);
      } else if (game === 'dart') {
        const sample = sampleDartShot(shot.power, elapsed, shot.direction);
        paintDart(sample);
        dart.setAttribute('opacity', String(sample.opacity));
        dartPulse.setAttribute('cx', String(sample.hitX));
        dartPulse.setAttribute('cy', String(sample.hitY));
        dartPulse.setAttribute('r', String(sample.pulseRadius));
        dartPulse.setAttribute('opacity', String(sample.pulse));
      } else {
        const sample = sampleShot(shot.power, elapsed, shot.direction);
        paintBall(sample);
        ball.setAttribute('opacity', String(sample.opacity));
        paintNet(sampleNet(shot.power, elapsed, shot.direction));
        pulse.setAttribute('cy', '34');
        pulse.setAttribute('r', String(16 + (1 - sample.pulse) * 8));
        pulse.setAttribute('opacity', String(sample.pulse * 0.45));
        if (shot.smash) paintBackboard(elapsed, shotTargetX(shot.direction));
      }
    } else return;
    frame = requestAnimationFrame(tick);
  }
  const actions = createActionController(getOptions, action => {
    if (action === 'pending') {
      input.cancel();
      stopReturn(true);
    }
    // Completion ends decoration immediately; the host operation owns the wait.
    stopArt();
    change({ action });
    paintHeight();
  });
  function trigger(source: PullSource, power?: number, direction = 0) {
    const joined = actions.isPending();
    const outcome = actions.trigger(source);
    if (!joined && actions.isPending() && power !== undefined && !state.reduced && !document.hidden) {
      shot = { power, direction, started: performance.now(), smash: classifyShot(power, direction) === 'smash',
        bowling: game === 'bowling' ? createBowlingRoll(power, direction) : null,
        stone: game === 'stone' ? createStoneThrow(power, direction) : null };
      if (game === 'bowling') paintBowlingBall(sampleBowlingPull(power, direction));
      else if (shot.stone) {
        const pose = sampleStoneShot(shot.stone, 0);
        paintStone(pose);
        paintStoneShadow(pose.x, pose.groundY, pose.shadowScale, pose.shadowOpacity);
      }
      else if (game === 'dart') paintDart(sampleDartShot(power, 0, direction));
      else paintBall(sampleShot(power, 0, direction));
      change({ shooting: true });
      paintHeight();
      frame = requestAnimationFrame(tick);
    }
    return outcome;
  }
  const input = attachInput(viewport, {
    canStart: () => !getOptions().disabled && !actions.isPending(),
    move,
    release: (value, offsetX, keyboard) => {
      const inputScale = keyboard ? 1 : inputZoom * scale;
      void trigger(keyboard ? 'keyboard' : 'pull', pullPower(value / inputScale), pullDirection(offsetX / inputScale));
    },
    cancel: () => { stopArt(); paintHeight(); },
    keyboardStart: () => { move(0, 0, true); frame = requestAnimationFrame(tick); },
  });

  function syncOptions() {
    const nextGame = getOptions().game ?? 'basketball';
    if (nextGame !== game) {
      // Switching decoration never remounts content or aborts accepted data work.
      input.cancel();
      stopArt();
      game = nextGame;
    }
    if (getOptions().disabled) input.cancel();
    const reduced = getOptions().motion === 'reduced' || media.matches;
    if (reduced !== state.reduced) {
      change({ reduced });
      if (reduced) {
        stopReturn();
        // Keep charging operable, but end any accepted decorative shot.
        if (shot) stopArt();
        pulse.setAttribute('opacity', '0');
      }
    }
    paintHeight();
  }
  const onVisibility = () => {
    if (document.hidden) { input.cancel(); stopArt(); stopReturn(); }
    paintHeight();
  };
  let previousSize = `${viewport.clientWidth}:${viewport.clientHeight}`;
  const resize = new ResizeObserver(() => {
    const size = `${viewport.clientWidth}:${viewport.clientHeight}`;
    if (size !== previousSize) {
      previousSize = size;
      input.cancel();
      stopReturn();
      measureScale();
    }
    paintHeight();
  });
  resize.observe(viewport);
  resize.observe(status);
  media.addEventListener('change', syncOptions);
  document.addEventListener('visibilitychange', onVisibility);
  measureScale();
  syncOptions();

  return {
    trigger: () => trigger('imperative'),
    syncOptions,
    dispose() {
      disposed = true;
      input.dispose();
      actions.dispose();
      stopReturn();
      cancelAnimationFrame(frame);
      resize.disconnect();
      media.removeEventListener('change', syncOptions);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
