import type { DesignQRCityPreset } from '../../config/types.ts';
import type { TreeData } from '../tree/treeBuilder.ts';
import { BLOCK_SIZE } from '../tree/constants.ts';

/** Keep the real QR matrix intact: the city never edits or masks modules. */
export function build3DCity(modules: boolean[][], preset: DesignQRCityPreset = 'shibuya'): TreeData {
  if (modules.length === 0 || modules.some(row => row.length !== modules.length)) {
    throw new Error('A city requires a nonempty square QR matrix.');
  }
  return {
    city: { preset, modules: modules.map(row => [...row]) },
    gridSize: modules.length,
    blocks: [], branches: [], flowers: [], grass: [],
    trunkHeight: modules.length * BLOCK_SIZE * 0.2,
  };
}
