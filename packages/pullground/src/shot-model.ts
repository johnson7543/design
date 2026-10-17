export type ShotResult = 'short' | 'made' | 'perfect' | 'long' | 'wide' | 'smash';
export const SHOT_DURATION = 1200;
export const SMASH_DURATION = 900;
export const BACKBOARD_IMPACT = 220;
export const BACKBOARD_FRAGMENTS = [
  { points: '59,9 80,9 80,23 59,21', x: 69, y: 16, dx: -28, dy: -9, rotation: -36 },
  { points: '80,9 101,9 101,21 80,23', x: 91, y: 16, dx: 28, dy: -7, rotation: 34 },
  { points: '101,21 101,37 89,37 80,23', x: 94, y: 29, dx: 30, dy: 14, rotation: 55 },
  { points: '89,37 71,37 80,23', x: 80, y: 32, dx: 2, dy: 28, rotation: 18 },
  { points: '71,37 59,37 59,21 80,23', x: 66, y: 29, dx: -30, dy: 14, rotation: -50 },
] as const;
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const pullPower = (distance: number) => clamp(Number.isFinite(distance) ? distance / 180 : 0);
export const pullDirection = (offsetX: number) => clamp(Number.isFinite(offsetX) ? offsetX / 90 : 0, -1, 1);
export const shotDirection = (direction: number) => clamp(Number.isFinite(direction) ? direction : 0, -1, 1);
// Direction describes the pull; release launches toward the opposite side.
export const shotTargetX = (direction: number) => 80 - shotDirection(direction) * 48;

/** Pull and flight share their initial pose, so release never resets the ball. */
export function samplePull(power: number, direction = 0) {
  const p = clamp(Number.isFinite(power) ? power : 0);
  const aim = shotDirection(direction);
  return { x: 80 + aim * 12, y: 90 + p * 16, rotation: p * 70 + aim * 18, scaleX: 1 + p * 0.08, scaleY: 1 - p * 0.1 };
}

export function classifyShot(power: number, direction = 0): ShotResult {
  const p = clamp(Number.isFinite(power) ? power : 0);
  const lateral = Math.abs(shotTargetX(direction) - 80);
  if (p >= 1 - 1e-10 && lateral <= 28.4) return 'smash';
  // A make must fit the ball inside the rim; the board includes the ball radius.
  if (lateral > 7.6) return 'wide';
  const delta = p - 0.68;
  const distance = Math.abs(delta);
  if (distance <= 0.045 + 1e-10 && lateral <= 3) return 'perfect';
  if (distance <= 0.12 + 1e-10) return 'made';
  return delta < 0 ? 'short' : 'long';
}

/** The five board pieces separate once; the ordinary reset restores the board. */
export function sampleBackboard(elapsedMs: number) {
  const broken = elapsedMs >= BACKBOARD_IMPACT;
  const t = Math.max(0, elapsedMs - BACKBOARD_IMPACT) / 1000;
  const progress = clamp(t / 0.44);
  const shake = (1 - clamp(t / 0.18)) ** 2;
  return {
    panel: broken ? 0 : 1,
    fragments: broken ? clamp((0.54 - t) / 0.16) : 0,
    spread: 1 - (1 - progress) ** 3,
    fall: 28 * progress ** 2,
    shakeX: Math.sin(t * 100) * 3.2 * shake,
    rotation: Math.sin(t * 80) * 6 * shake,
    impact: broken ? 1 - clamp(t / 0.22) : 0,
    impactScale: 0.65 + clamp(t / 0.22) * 0.75,
  };
}

/** Analytic, deterministic motion in a 160 × 132 viewBox, independent of frame rate. */
export function sampleShot(power: number, elapsedMs: number, direction = 0) {
  const aim = shotDirection(direction);
  const result = classifyShot(power, aim);
  const powerResult = classifyShot(power);
  const made = result === 'made' || result === 'perfect';
  const start = samplePull(power, aim);
  const targetX = shotTargetX(aim);
  const t = Math.max(0, elapsedMs) / 1000;
  const settle = (1 - clamp(t / 0.12)) ** 2;
  if (powerResult === 'smash') {
    const smash = result === 'smash';
    const hit = BACKBOARD_IMPACT / 1000;
    const launch = clamp(t / hit);
    const contact = Math.max(0, t - hit);
    // A 35 ms impact hold makes contact read before the hard downward rebound.
    const rebound = Math.max(0, contact - 0.035);
    const squash = smash && t >= hit ? 1 - clamp(contact / 0.1) : 0;
    const side = aim > 0 ? -1 : 1;
    return {
      x: start.x + (targetX - start.x) * (0.7 * launch + 0.3 * launch ** 2)
        + (smash ? side * 90 * rebound : -aim * 100 * contact),
      y: t < hit ? start.y + (23 - start.y) * (0.7 * launch + 0.3 * launch ** 2)
        : smash ? 23 + 45 * rebound + 205 * rebound ** 2 : 23 - 120 * contact + 220 * contact ** 2,
      rotation: start.rotation + side * (smash ? Math.min(t, hit) * 450 + rebound * 540 : t * 450),
      scaleX: 1 + (start.scaleX - 1) * settle + 0.4 * squash,
      scaleY: 1 + (start.scaleY - 1) * settle - 0.35 * squash,
      opacity: clamp(((smash ? 0.86 : 1.2) - t) / 0.16),
      pulse: 0,
    };
  }
  const short = powerResult === 'short';
  const long = powerResult === 'long';
  const apex = short ? 49 : long ? -8 : 12;
  // Horizontal velocity survives the rim crossing, including missed shots.
  let x = start.x + (targetX - start.x) * t / 0.58;
  let y: number;
  if (t < 0.3) {
    y = start.y + (apex - start.y) * (1 - (1 - t / 0.3) ** 2);
  } else if (t <= 0.58) {
    y = apex + ((short ? 64 : 34) - apex) * ((t - 0.3) / 0.28) ** 2;
  } else {
    const dt = t - 0.58;
    if (long) {
      x += (aim > 0 ? -1 : 1) * 65 * dt;
      y = 34 - 80 * dt + 300 * dt ** 2;
    } else {
      // A made ball keeps its downward momentum through the flexible net.
      y = (short ? 64 : 34) + (made ? 120 : 80) * dt + 225 * dt ** 2;
    }
  }
  const contact = t - 0.58;
  return {
    x, y,
    rotation: start.rotation + t * 180,
    scaleX: 1 + (start.scaleX - 1) * settle,
    scaleY: 1 + (start.scaleY - 1) * settle,
    opacity: clamp((1.2 - t) / 0.18),
    pulse: result === 'perfect' && contact >= 0 ? clamp(1 - contact / 0.5) : 0,
  };
}
