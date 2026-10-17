import { clamp, shotDirection } from './shot-model.ts';

export const STONE_MAX_CONTACTS = 5;
export const STONE_RIPPLE_COUNT = STONE_MAX_CONTACTS * 2;
const GRAVITY = 4000;
const RIPPLE_DURATION = 360;
const SINK_DURATION = 120;
const powerValue = (power: number) => clamp(Number.isFinite(power) ? power : 0);
const depthScale = (distance: number) => clamp(1 - distance * 0.0045, 0.48, 1);

interface Flight {
  at: number;
  duration: number;
  x: number;
  groundY: number;
  vx: number;
  speed: number;
  height: number;
  lift: number;
}
interface Contact { at: number; x: number; y: number; scale: number }
export interface StoneThrow {
  power: number;
  start: ReturnType<typeof sampleStonePull>;
  flights: Flight[];
  contacts: Contact[];
  sink: { at: number; x: number; groundY: number; vx: number; speed: number };
  duration: number;
}

export function sampleStonePull(power: number, direction = 0) {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  return { x: 80 + aim * 12, y: 98 + p * 12, rotation: -12 + p * 10 + aim * 8, scale: 1 };
}

/** A shallow throw followed by diminishing ballistic hops, computed once at release. */
export function createStoneThrow(power: number, direction = 0): StoneThrow {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  const start = sampleStonePull(p, aim);
  const flights: Flight[] = [];
  const contacts: Contact[] = [];
  let x = start.x;
  let groundY = start.y + 14;
  let speed = 95 + p * 90;
  let vx = -aim * speed * 0.7;
  let at = 0;
  let duration = 250 - p * 65;
  let height = 14;
  let lift = GRAVITY * duration / 2000 - height * 1000 / duration;
  let bounceLift = p * 400;
  for (let index = 0; index < STONE_MAX_CONTACTS; index++) {
    flights.push({ at, duration, x, groundY, vx, speed, height, lift });
    const seconds = duration / 1000;
    x += vx * seconds;
    groundY -= speed * seconds;
    at += duration;
    contacts.push({ at, x, y: groundY, scale: depthScale(start.y + 14 - groundY) });
    // Water contact sheds forward speed and vertical energy on every skip.
    speed *= 0.8;
    vx *= 0.8;
    duration = 2000 * bounceLift / GRAVITY;
    if (duration < 55) break;
    height = 0;
    lift = bounceLift;
    bounceLift *= 0.68;
  }
  return { power: p, start, flights, contacts, sink: { at, x, groundY, vx, speed }, duration: at + RIPPLE_DURATION };
}

/** Timestamp-only sampling keeps contact locations stable at any frame rate. */
export function sampleStoneShot(throwing: StoneThrow, elapsedMs: number) {
  const time = Math.max(0, Number.isNaN(elapsedMs) ? 0 : elapsedMs);
  const { start, sink } = throwing;
  const flight = throwing.flights.find(segment => time <= segment.at + segment.duration);
  let x: number;
  let groundY: number;
  let height: number;
  let opacity = 1;
  let immersion = 0;
  if (flight) {
    const seconds = Math.max(0, time - flight.at) / 1000;
    x = flight.x + flight.vx * seconds;
    groundY = flight.groundY - flight.speed * seconds;
    height = Math.max(0, flight.height + flight.lift * seconds - GRAVITY * seconds ** 2 / 2);
  } else {
    const seconds = clamp((time - sink.at) / SINK_DURATION) * SINK_DURATION / 1000;
    const drift = (1 - Math.exp(-12 * seconds)) / 12;
    x = sink.x + sink.vx * drift;
    groundY = sink.groundY - sink.speed * drift;
    immersion = clamp((time - sink.at) / SINK_DURATION);
    height = -4 * immersion;
    opacity = 1 - immersion;
  }
  const scale = depthScale(start.y + 14 - groundY);
  const spinTime = Math.min(time, sink.at + SINK_DURATION);
  return {
    x, y: groundY - height,
    rotation: start.rotation * (1 - clamp(time / 200)) + Math.sin(spinTime * (0.018 + throwing.power * 0.02)) * 5,
    scale: scale * (1 - immersion * 0.25), opacity,
    groundY, height, shadowScale: scale,
    shadowOpacity: 0.14 * (1 - clamp(height / 50)) * opacity,
  };
}

/** Paired, flattened rings start only at actual contact, then expand in place. */
export function sampleStoneRipples(throwing: StoneThrow | null, elapsedMs = 0) {
  return Array.from({ length: STONE_RIPPLE_COUNT }, (_, index) => {
    const contact = throwing?.contacts[Math.floor(index / 2)];
    const inner = index % 2 === 1;
    const age = elapsedMs - (contact?.at ?? 0) - (inner ? 60 : 0);
    const lifetime = RIPPLE_DURATION - (inner ? 60 : 0);
    const progress = clamp(age / lifetime);
    const radius = (3 + 15 * (1 - (1 - progress) ** 2)) * (contact?.scale ?? 1);
    return {
      x: contact?.x ?? 80, y: contact?.y ?? 88,
      rx: radius, ry: radius * 0.28,
      opacity: contact && age >= 0 && elapsedMs < contact.at + RIPPLE_DURATION
        ? (inner ? 0.3 : 0.55) * (1 - progress) ** 1.5 : 0,
    };
  });
}
