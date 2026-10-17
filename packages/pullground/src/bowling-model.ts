import { clamp, shotDirection, shotTargetX } from './shot-model.ts';

export const BOWLING_DURATION = 1100;
// Back to front for SVG depth order. Each pin rotates around its foot.
export const BOWLING_PINS = [
  { id: 7, x: 59, y: 25, scale: 0.76 },
  { id: 8, x: 73, y: 25, scale: 0.76 },
  { id: 9, x: 87, y: 25, scale: 0.76 },
  { id: 10, x: 101, y: 25, scale: 0.76 },
  { id: 4, x: 66, y: 34, scale: 0.84 },
  { id: 5, x: 80, y: 34, scale: 0.84 },
  { id: 6, x: 94, y: 34, scale: 0.84 },
  { id: 2, x: 73, y: 43, scale: 0.92 },
  { id: 3, x: 87, y: 43, scale: 0.92 },
  { id: 1, x: 80, y: 52, scale: 1 },
] as const;

const powerValue = (power: number) => clamp(Number.isFinite(power) ? power : 0);
const rollDuration = (power: number) => 820 - power * 200;
const BALL_FADE_DURATION = 140;
const rollDistance = (power: number) => (sampleBowlingPull(power).y - 14) * clamp(power / 0.3);

export function sampleBowlingPull(power: number, direction = 0) {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  return { x: 80 + aim * 12, y: 96 + p * 14, rotation: p * 60 + aim * 14, scale: 1 };
}

/** Roll freely along the aimed line, shrinking with depth; light rolls stop short. */
export function sampleBowlingBall(power: number, elapsedMs: number, direction = 0) {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  const start = sampleBowlingPull(p, aim);
  const time = Math.max(0, elapsedMs);
  const duration = rollDuration(p);
  const progress = 1 - (1 - clamp(time / duration)) ** 1.25;
  const distance = rollDistance(p) * progress;
  const y = start.y - distance;
  const scale = 1 - 0.48 * distance / (start.y - 14);
  const x = start.x + (shotTargetX(aim) - start.x) * distance / (start.y - 52);
  return {
    x, y, scale,
    rotation: start.rotation + distance * 9,
    // Disappear while still rolling; pin motion can finish after the ball exits.
    opacity: clamp((duration - time) / BALL_FADE_DURATION),
  };
}

const STEP_MS = 1000 / 240;
const STEP = STEP_MS / 1000;
const FLOOR_TILT = Math.PI / 2;

interface PinContact { at: number; source: 'ball' | number; impulseX: number; impulseY: number }
interface PinBody {
  x: number; y: number;
  vx: number; vy: number;
  leanX: number; leanY: number;
  spinX: number; spinY: number;
  scale: number;
}
interface PinPose {
  x: number; y: number;
  rotation: number;
  scaleX: number; scaleY: number;
  tilt: number;
}
export interface BowlingRoll {
  power: number;
  direction: number;
  contacts: (PinContact | null)[];
  frames: PinPose[][];
}

function pinPose(pin: PinBody): PinPose {
  const tilt = Math.hypot(pin.leanX, pin.leanY);
  const spread = Math.sin(tilt);
  const nx = tilt ? pin.leanX / tilt : 0;
  const ny = tilt ? pin.leanY / tilt : 0;
  // Project an upright pin onto the lane as it tips in the impulse direction.
  const topX = nx * spread;
  const topY = -Math.cos(tilt) + ny * spread * 0.4;
  return {
    x: pin.x - nx * spread * 4 * pin.scale,
    y: pin.y - ny * spread * 4 * pin.scale,
    rotation: Math.atan2(topX, -topY) * 180 / Math.PI,
    scaleX: pin.scale,
    scaleY: Math.hypot(topX, topY) * pin.scale,
    tilt,
  };
}

function contactPoints(pin: PinBody) {
  const tilt = Math.hypot(pin.leanX, pin.leanY);
  const nx = tilt ? pin.leanX / tilt : 0;
  const ny = tilt ? pin.leanY / tilt : 0;
  const speed = pin.spinX * nx + pin.spinY * ny;
  const spread = Math.sin(tilt);
  const dx = tilt ? (pin.spinX - nx * speed) * spread / tilt + nx * Math.cos(tilt) * speed : pin.spinX;
  const dy = tilt ? (pin.spinY - ny * speed) * spread / tilt + ny * Math.cos(tilt) * speed : pin.spinY;
  // Two circles approximate the body and the head of the fallen pin. The head
  // sweeps into neighbors as it tips, carrying its angular velocity into contact.
  return [{ offset: 0, radius: 3.6 }, { offset: 7.5, radius: 2.1 }].map(({ offset, radius }) => ({
    x: pin.x + nx * spread * offset * pin.scale,
    y: pin.y + ny * spread * offset * pin.scale,
    vx: pin.vx + dx * offset * pin.scale,
    vy: pin.vy + dy * offset * pin.scale,
    radius: radius * pin.scale,
  }));
}

/** Resolve a small planar pin simulation once; painting only interpolates snapshots. */
export function createBowlingRoll(power: number, direction = 0): BowlingRoll {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  const pins: PinBody[] = BOWLING_PINS.map(pin => ({ ...pin, vx: 0, vy: 0, leanX: 0, leanY: 0, spinX: 0, spinY: 0 }));
  const contacts: BowlingRoll['contacts'] = pins.map(() => null);
  const ballContacts = new Set<number>();
  const frames = [pins.map(pinPose)];
  for (let frame = 0; frame < Math.ceil(BOWLING_DURATION / STEP_MS); frame++) {
    const time = frame * STEP_MS;
    const ball = sampleBowlingBall(p, time, aim);
    const nextBall = sampleBowlingBall(p, time + STEP_MS, aim);
    const ballVx = (nextBall.x - ball.x) / STEP;
    const ballVy = (nextBall.y - ball.y) / STEP;
    // Collect impulses before applying them: simultaneous contacts don't prefer
    // either side of the rack because of the array's drawing order.
    const impulses = pins.map(() => ({ x: 0, y: 0 }));
    const points = pins.map(contactPoints);
    const push = (index: number, x: number, y: number, source: PinContact['source']) => {
      if (Math.hypot(x, y) < 0.01) return;
      impulses[index].x += x;
      impulses[index].y += y;
      contacts[index] ??= { at: time, source, impulseX: x, impulseY: y };
    };
    for (let index = 0; index < pins.length; index++) {
      const pin = pins[index];
      const dx = pin.x - ball.x;
      const dy = pin.y - ball.y;
      const distance = Math.hypot(dx, dy);
      if (ball.opacity > 0 && !ballContacts.has(index) && distance > 0 && distance < 8 * ball.scale + points[index][0].radius) {
        const nx = dx / distance;
        const ny = dy / distance;
        const closing = (ballVx - pin.vx) * nx + (ballVy - pin.vy) * ny;
        // A six-to-one ball/pin mass ratio, with a small amount of restitution.
        const impulse = Math.max(0, closing) * 1.28 / (1 + 1 / 6);
        push(index, nx * impulse, ny * impulse, 'ball');
        if (impulse > 0) ballContacts.add(index);
      }
      for (let other = index + 1; other < pins.length; other++) {
        let contact = { depth: 0, nx: 0, ny: 0, closing: 0 };
        for (const a of points[index]) for (const b of points[other]) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          const depth = a.radius + b.radius - distance;
          if (!distance || depth <= contact.depth) continue;
          const nx = dx / distance;
          const ny = dy / distance;
          contact = { depth, nx, ny, closing: (a.vx - b.vx) * nx + (a.vy - b.vy) * ny };
        }
        const impulse = Math.max(0, contact.closing) * 1.22 / 2;
        push(index, -contact.nx * impulse, -contact.ny * impulse, BOWLING_PINS[other].id);
        push(other, contact.nx * impulse, contact.ny * impulse, BOWLING_PINS[index].id);
      }
    }
    pins.forEach((pin, index) => {
      const impulse = impulses[index];
      pin.vx += impulse.x;
      pin.vy += impulse.y;
      pin.spinX += impulse.x * 0.14;
      pin.spinY += impulse.y * 0.14;
      const tilt = Math.hypot(pin.leanX, pin.leanY);
      const gravity = tilt ? 55 * Math.sin(tilt) / tilt : 0;
      pin.spinX += pin.leanX * gravity * STEP;
      pin.spinY += pin.leanY * gravity * STEP;
      pin.leanX += pin.spinX * STEP;
      pin.leanY += pin.spinY * STEP;
      const nextTilt = Math.hypot(pin.leanX, pin.leanY);
      if (nextTilt > FLOOR_TILT) {
        const nx = pin.leanX / nextTilt;
        const ny = pin.leanY / nextTilt;
        pin.leanX = nx * FLOOR_TILT;
        pin.leanY = ny * FLOOR_TILT;
        const downward = pin.spinX * nx + pin.spinY * ny;
        if (downward > 0) {
          // A small floor bounce; tangential spin can still redirect a fallen pin.
          const bounce = downward > 0.8 ? 1.12 : 1;
          pin.spinX -= nx * downward * bounce;
          pin.spinY -= ny * downward * bounce;
        }
      }
      const friction = Math.exp(-(2.5 + 6 * Math.sin(Math.min(nextTilt, FLOOR_TILT))) * STEP);
      pin.vx *= friction;
      pin.vy *= friction;
      if (Math.hypot(pin.vx, pin.vy) < 1) pin.vx = pin.vy = 0;
      pin.x += pin.vx * STEP;
      pin.y += pin.vy * STEP;
      // The rear of the pin deck catches sliding pins with a soft rebound.
      if (pin.y < 15) { pin.y = 15; pin.vy = Math.abs(pin.vy) * 0.18; }
      pin.spinX *= Math.exp(-2.4 * STEP);
      pin.spinY *= Math.exp(-2.4 * STEP);
    });
    frames.push(pins.map(pinPose));
  }
  return { power: p, direction: aim, contacts, frames };
}

export function sampleBowlingPins(roll: BowlingRoll | null, elapsedMs = 0): PinPose[] {
  if (!roll) return BOWLING_PINS.map(pin => ({ x: pin.x, y: pin.y, rotation: 0, scaleX: pin.scale, scaleY: pin.scale, tilt: 0 }));
  const frame = clamp(elapsedMs / STEP_MS, 0, roll.frames.length - 1);
  const before = roll.frames[Math.floor(frame)];
  const after = roll.frames[Math.ceil(frame)];
  const mix = frame % 1;
  return before.map((pin, index) => {
    const next = after[index];
    const rotation = ((next.rotation - pin.rotation + 540) % 360) - 180;
    return {
      x: pin.x + (next.x - pin.x) * mix,
      y: pin.y + (next.y - pin.y) * mix,
      rotation: pin.rotation + rotation * mix,
      scaleX: pin.scaleX,
      scaleY: pin.scaleY + (next.scaleY - pin.scaleY) * mix,
      tilt: pin.tilt + (next.tilt - pin.tilt) * mix,
    };
  });
}
