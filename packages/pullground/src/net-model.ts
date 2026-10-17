import { BACKBOARD_IMPACT, clamp, classifyShot, sampleShot, shotTargetX } from './shot-model.ts';

const CORDS = 12;
const ROWS = [
  { y: 34, radius: 15 },
  { y: 39, radius: 12.3 },
  { y: 44, radius: 9.1 },
  { y: 49, radius: 6.3 },
  { y: 54, radius: 5.5 },
];
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
type Knot = { x: number; y: number; depth: number };

/** A diamond mesh with fixed rim attachments and a ball-driven, flexible throat. */
export function sampleNet(power: number, elapsedMs: number, direction = 0) {
  const result = classifyShot(power, direction);
  const made = result === 'made' || result === 'perfect';
  const ball = sampleShot(power, elapsedMs, direction);
  const descending = made && elapsedMs >= 300;
  const load = descending ? smooth((ball.y - 38) / 16) : 0;
  const release = descending ? smooth((ball.y - 61) / 11) : 0;
  const grip = load * (1 - release);
  const carry = descending ? smooth((ball.y - 30) / 16) * (1 - release) : 0;
  const impact = Math.max(0, elapsedMs - BACKBOARD_IMPACT) / 1000;
  const jolt = result === 'smash' ? Math.sin(impact * 65) * 3 * (1 - clamp(impact / 0.3)) ** 2 : 0;

  const rings = ROWS.map((row, rowIndex) => {
    const level = rowIndex / (ROWS.length - 1);
    const flex = level ** 1.5;
    // The free end recoils first, then the ripple travels toward the fixed rim.
    const rebound = Math.max(0, elapsedMs - 804 - (1 - level) * 28) / 1000;
    const decay = Math.exp(-rebound * 9) * (1 - clamp(rebound / 0.36)) ** 2;
    const recoil = made ? Math.sin(rebound * 32) * decay : 0;
    const stretch = 6.5 * grip - 4 * recoil + jolt;
    const centerX = 80 + ((ball.x - 80) * carry + (shotTargetX(direction) - 80) * recoil * 0.25) * flex;
    const centerY = row.y + stretch * flex;
    // Open each row around the passing ball, instead of scaling the whole net.
    const section = 7.8 * (1 - smooth((Math.abs(ball.y - centerY) - 2) / 8));
    const clearance = section * (1 + Math.abs(ball.x - centerX) / 7.8);
    const radius = row.radius + (descending && rowIndex > 0 ? Math.max(0, clearance - row.radius) : 0)
      - recoil * level * 0.8;
    return Array.from({ length: CORDS }, (_, index): Knot => {
      const angle = (index + (rowIndex % 2) * 0.5) * Math.PI * 2 / CORDS;
      const depth = Math.sin(angle);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + depth * (3.8 - level * 2),
        depth,
      };
    });
  });

  const front: string[] = [];
  const back: string[] = [];
  function cord(from: Knot, to: Knot) {
    const path = (from.depth + to.depth) / 2 >= -1e-10 ? front : back;
    path.push(`M${from.x.toFixed(3)} ${from.y.toFixed(3)}L${to.x.toFixed(3)} ${to.y.toFixed(3)}`);
  }
  rings.forEach((ring, row) => {
    if (row < rings.length - 1) {
      ring.forEach((point, index) => {
        cord(point, rings[row + 1][index]);
        cord(point, rings[row + 1][(index + (row % 2 ? 1 : -1) + CORDS) % CORDS]);
      });
    } else {
      ring.forEach((point, index) => cord(point, ring[(index + 1) % CORDS]));
    }
  });
  return { front: front.join(' '), back: back.join(' '), rings, threaded: descending };
}

export const REST_NET = sampleNet(0, 0);
