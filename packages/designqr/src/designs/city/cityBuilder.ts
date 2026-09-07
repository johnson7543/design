import type { TreeData } from '../tree/treeBuilder.ts';
import { BLOCK_SIZE } from '../tree/constants.ts';

/** Keep the real QR matrix intact: the city never edits or masks modules. */
export function build3DCity(modules: boolean[][]): TreeData {
  if (modules.length === 0 || modules.some(row => row.length !== modules.length)) {
    throw new Error('A city requires a nonempty square QR matrix.');
  }
  return {
    city: { modules: modules.map(row => [...row]) },
    gridSize: modules.length,
    blocks: [], branches: [], flowers: [], grass: [],
    trunkHeight: modules.length * BLOCK_SIZE * 0.2,
  };
}
