import { clamp, shotDirection, shotTargetX } from './shot-model.ts';

export const DART_IMPACT = 360;
export const DART_DURATION = 1100;
const powerValue = (power: number) => clamp(Number.isFinite(power) ? power : 0);

/** The dart rotates around its tip, including when embedded in the target. */
export function sampleDartPull(power: number, direction = 0) {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  const x = 80 + aim * 12;
  const y = 84 + p * 16;
  const rotation = Math.atan2(shotTargetX(aim) - x, y - (34 - (p - 0.68) * 56)) * 180 / Math.PI;
  return { x, y, rotation };
}

/** A medium pull hits the bullseye; weaker throws fall short, stronger ones land high. */
export function sampleDartShot(power: number, elapsedMs: number, direction = 0) {
  const p = powerValue(power);
  const aim = shotDirection(direction);
  const start = sampleDartPull(p, aim);
  const delta = p - 0.68;
  const hitX = shotTargetX(aim);
  const hitY = 34 - delta * 56;
  const landed = Math.hypot(hitX - 80, hitY - 34) <= 23;
  const perfect = Math.hypot(hitX - 80, hitY - 34) <= 3;
  const time = Math.max(0, elapsedMs);
  const flight = clamp(time / DART_IMPACT);
  const travel = 0.55 * flight + 0.45 * flight ** 2;
  const contact = Math.max(0, time - DART_IMPACT) / 1000;
  const wobble = landed ? Math.sin(contact * 70) * 9 * (1 - clamp(contact / 0.28)) ** 2 : 0;
  return {
    x: start.x + (hitX - start.x) * travel - (landed ? 0 : aim * 30 * contact),
    y: start.y + (hitY - start.y) * travel + (landed ? 0 : 180 * contact ** 2),
    rotation: start.rotation + wobble + (landed ? 0 : (aim > 0 ? -1 : 1) * contact * 120),
    opacity: clamp((DART_DURATION - time) / 180),
    pulse: landed && time >= DART_IMPACT ? (perfect ? 0.65 : 0.4) * (1 - clamp(contact / 0.28)) : 0,
    pulseRadius: 5 + clamp(contact / 0.28) * (perfect ? 16 : 7),
    hitX, hitY,
  };
}
