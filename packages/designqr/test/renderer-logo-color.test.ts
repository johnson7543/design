import assert from 'node:assert/strict';
import test from 'node:test';

import { Color, PerspectiveCamera, Scene, Texture } from 'three';

import { TreeBlockType } from '../src/designs/tree/constants.ts';
import type { VoxelBlock } from '../src/designs/tree/treeBuilder.ts';
import { TREE_THEME_PRESETS } from '../src/designs/tree/themes.ts';
import { ThreeFallbackRenderer } from '../src/renderer/webgl/ThreeFallbackRenderer.ts';

function createBlock(col: number, row: number, type: VoxelBlock['type']): VoxelBlock {
  return { col, row, x: 0, y: 0, z: 0, type, layer: 0 };
}

function sampleSettledColors(
  renderer: Record<string, unknown>,
  blocks: readonly VoxelBlock[],
  logoEnabled: boolean
): string[] {
  Reflect.set(renderer, 'logoConfig', logoEnabled
    ? { src: '/fixture-logo.png', alt: 'Fixture logo', size: 0.16 }
    : false);
  const getColor = Reflect.get(renderer, 'getGroundTileColorWithProgress') as (
    block: VoxelBlock,
    target: Color,
    progress: number
  ) => void;

  return blocks.map((block) => {
    const target = new Color();
    getColor.call(renderer, block, target, 1);
    return target.getHexString();
  });
}

test('keeps settled multitone QR colors identical when a logo is configured', () => {
  const renderer = Object.create(
    ThreeFallbackRenderer.prototype
  ) as Record<string, unknown>;
  Reflect.set(renderer, 'activeTheme', TREE_THEME_PRESETS.spring);
  Reflect.set(renderer, 'treeData', { gridSize: 29 });
  Reflect.set(renderer, 'qrDepthHsl', { h: 0, s: 0, l: 0 });

  const foliageBlocks = Array.from({ length: 17 }, (_, rowOffset) => (
    Array.from({ length: 17 }, (_, colOffset) => createBlock(
      colOffset + 6,
      rowOffset + 6,
      TreeBlockType.FallenPetals
    ))
  )).flat();
  const finderBlocks = Array.from({ length: 7 }, (_, row) => (
    Array.from({ length: 7 }, (_, col) => createBlock(
      col,
      row,
      TreeBlockType.Grass
    ))
  )).flat();

  for (const blocks of [foliageBlocks, finderBlocks]) {
    const withoutLogo = sampleSettledColors(renderer, blocks, false);
    const withLogo = sampleSettledColors(renderer, blocks, true);

    assert.ok(
      new Set(withLogo).size > 4,
      'logo-enabled QR modules should retain the theme palette distribution'
    );
    assert.deepEqual(withLogo, withoutLogo);
  }
});

test('does not invalidate settled QR colors when the logo-enabled state changes', () => {
  const renderer = Object.create(
    ThreeFallbackRenderer.prototype
  ) as Record<string, unknown>;
  let renderCount = 0;
  let loadCount = 0;
  const logo = {
    src: '/fixture-logo.png',
    alt: 'Fixture logo',
    size: 0.16,
  };

  Reflect.set(renderer, 'logoConfig', false);
  Reflect.set(renderer, 'logoGroup', null);
  Reflect.set(renderer, 'logoLoadController', null);
  Reflect.set(renderer, 'logoLoadVersion', 0);
  Reflect.set(renderer, 'lastGroundProgress', 1);
  Reflect.set(renderer, 'isDestroyed', false);
  Reflect.set(renderer, 'renderOnce', () => { renderCount += 1; });
  Reflect.set(renderer, 'loadLogoTexture', async () => { loadCount += 1; });

  const setLogo = Reflect.get(renderer, 'setLogo') as (
    nextLogo: false | typeof logo
  ) => void;
  setLogo.call(renderer, logo);

  assert.equal(Reflect.get(renderer, 'lastGroundProgress'), 1);
  assert.equal(renderCount, 0);
  assert.equal(loadCount, 1);

  setLogo.call(renderer, false);

  assert.equal(Reflect.get(renderer, 'lastGroundProgress'), 1);
  assert.equal(renderCount, 1);
});

test('renders the logo image without a generated frame or backplate', () => {
  const renderer = Object.create(
    ThreeFallbackRenderer.prototype
  ) as Record<string, unknown>;
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.position.set(1.5, 1.8, 1.5);

  Reflect.set(renderer, 'scene', scene);
  Reflect.set(renderer, 'camera', camera);
  Reflect.set(renderer, 'treeData', { gridSize: 29, trunkHeight: 1 });
  Reflect.set(renderer, 'currentProgress', 1);
  Reflect.set(renderer, 'logoConfig', {
    src: '/fixture-logo.png',
    alt: 'Fixture logo',
    size: 0.16,
  });

  const createLogo = Reflect.get(renderer, 'createLogoVisual') as (
    texture: Texture,
    aspectRatio: number
  ) => void;
  createLogo.call(renderer, new Texture(), 1);

  assert.deepEqual(
    scene.getObjectByName('designqr-logo')?.children.map((child) => child.name),
    ['designqr-logo-image']
  );
  assert.equal(scene.getObjectByName('designqr-logo-backplate'), undefined);

  const disposeLogo = Reflect.get(renderer, 'disposeLogoVisual') as () => void;
  disposeLogo.call(renderer);
});
