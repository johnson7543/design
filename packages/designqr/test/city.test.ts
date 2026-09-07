import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDesignQRConfig, decodeDesignQRConfig, normalizeDesignQRConfig } from '../src/config/index.ts';
import { build3DTree } from '../src/designs/tree/treeBuilder.ts';
import { createCityBuildings } from '../src/designs/city/layout.ts';
import { build3DCity } from '../src/designs/city/cityBuilder.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';
import { resolveTreeTheme } from '../src/designs/tree/themes.ts';

test('city defaults to Shibuya and round-trips canonical share and embed state', () => {
  const config = normalizeDesignQRConfig({ value: 'https://example.com/渋谷', design: 'city' });
  assert.deepEqual(config.design, { type: 'city' });
  assert.deepEqual(config.theme, { type: 'preset', preset: 'shibuya' });
  const decoded = decodeDesignQRConfig(encodeDesignQRConfig(config));
  assert.ok(decoded.ok);
  assert.deepEqual(decoded.value, config);
  assert.equal(resolveTreeTheme(config.theme).particleType, 'none');
});

test('content reproduces artwork after another value is generated', () => {
  const first = generateQRMatrix('Shibuya A').modules;
  const second = generateQRMatrix('Shibuya B').modules;
  assert.equal(first.length, second.length);
  const city = createCityBuildings(first);
  assert.notDeepEqual(createCityBuildings(second), city);
  assert.deepEqual(createCityBuildings(first), city);
  const tree = build3DTree(first, 'wide');
  assert.notDeepEqual(build3DTree(second, 'wide'), tree);
  assert.deepEqual(build3DTree(first, 'wide'), tree);
});

test('city rejects custom and seasonal themes instead of partially applying unsupported colors', () => {
  for (const theme of ['spring', resolveTreeTheme({ type: 'preset', preset: 'spring' })]) {
    assert.throws(() => normalizeDesignQRConfig({ value: 'city', design: 'city', theme }),
      { code: 'INVALID_CONFIG', message: /only the Shibuya preset/ });
  }
});

test('city preserves every QR module across content lengths and error correction levels', () => {
  for (const value of ['Shibuya', 'https://example.com/渋谷', 'city/'.repeat(90)]) {
    for (const correction of ['M', 'H'] as const) {
      const matrix = generateQRMatrix(value, correction).modules;
      const city = build3DCity(matrix);
      assert.deepEqual(city.city?.modules, matrix);
      assert.equal(city.gridSize, matrix.length);
      assert.equal(city.flowers.length, 0);
      assert.notEqual(city.city?.modules, matrix);
      assert.notEqual(city.city?.modules[0], matrix[0]);
    }
  }
});
