import { contentVariation } from '../content-variation.ts';

/** Shared Shibuya/Osaka content rules. Every encoded bit influences a building;
 * its own QR neighborhood controls density without changing the encoded grid. */
export function cityBuildingVariation(modules: readonly (readonly boolean[])[], index: number, x: number, z: number) {
  const grid = modules.length;
  if (!grid || modules.some(row => row.length !== grid)) throw new Error('City requires a square QR matrix.');
  const seed = contentVariation(modules), noise = (salt: number) => cityNoise(index * 23 + salt, seed);
  const row = Math.floor((z + .5) * grid), col = Math.floor((x + .5) * grid), radius = Math.max(1, Math.floor(grid / 8));
  let dark = 0, count = 0;
  for (let r = Math.max(0, row - radius); r <= Math.min(grid - 1, row + radius); r++) {
    for (let c = Math.max(0, col - radius); c <= Math.min(grid - 1, col + radius); c++) {
      dark += Number(modules[r][c]); count++;
    }
  }
  return { seed, heightScale: .73 + .47 * (.25 * dark / Math.max(1, count) + .75 * noise(5)),
    floorMetres: 3.2 + noise(17) * 1.4,
    facade: (['glass', 'concrete', 'stone'] as const)[Math.floor(noise(6) * 3)], sign: Math.floor(noise(9) * 14) };
}

export function cityFacadeVariation(edge: number, seed: number) {
  const rhythm = cityNoise(edge * 43 + 19, seed);
  return { bayMetres: 2.1 + rhythm * 1.8, inset: .08 + rhythm * .16,
    sill: .16 + cityNoise(edge * 43 + 23, seed) * .22 };
}

export function cityNoise(index: number, seed: number): number {
  const value = Math.sin(index * 127.1 + seed * 7919) * 43758.5453;
  return value - Math.floor(value);
}
