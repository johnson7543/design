export interface PullGesture {
  x: number;
  y: number;
  distance: number;
  offsetX: number;
  maximum: number;
  claimed: boolean;
  canceled: boolean;
}
export const createPull = (x: number, y: number): PullGesture => ({
  x, y, distance: 0, offsetX: 0, maximum: 0, claimed: false, canceled: false,
});

export function movePull(pull: PullGesture, x: number, y: number): boolean {
  if (pull.canceled) return false;
  const dx = Math.abs(x - pull.x);
  const dy = y - pull.y;
  if (!pull.claimed) {
    if (dy < 0 || dx > Math.max(5, Math.abs(dy))) {
      pull.canceled = true;
      return false;
    }
    if (dy <= 0 || dy < dx) return false;
    pull.claimed = true;
  }
  pull.distance = Math.max(0, dy);
  pull.offsetX = x - pull.x;
  pull.maximum = Math.max(pull.maximum, pull.distance);
  return true;
}
