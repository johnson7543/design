import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeCompatibleDesignQRConfig,
  decodeDesignQRConfig,
  encodeDesignQRConfig,
  normalizeDesignQRConfig,
  parseDesignQRConfig,
} from '../src/config/index.ts';
import {
  VIEW_TRANSITION_DURATION_SECONDS,
  VIEW_TRANSITION_SPEED_DEFAULT,
} from '../src/designs/tree/constants.ts';
import { getDesignAdapter } from '../src/designs/registry.ts';
import { resolveTreeTitleColor } from '../src/designs/tree/themes.ts';

const LEGACY_V2_FIXTURE = 'eyJ2IjoyLCJ1IjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9vbGQiLCJzIjoyLCJwIjowLCJtIjoicyIsInQiOiJMZWdhY3kgdGl0bGUiLCJjIjoxLCJiIjoyNH0';
const LEGACY_ORIGINAL_FIXTURE = 'MTBodHRwczovL2V4YW1wbGUuY29tL29yaWdpbmFs';

test('uses the recalibrated normal-speed transition baseline', () => {
  assert.equal(VIEW_TRANSITION_SPEED_DEFAULT, 1);
  assert.equal(VIEW_TRANSITION_DURATION_SECONDS, 1.25 / 1.5);
});

test('normalizes defaults into the canonical v1 shape', () => {
  const config = normalizeDesignQRConfig({ value: 'https://example.com' });

  assert.deepEqual(config, {
    schemaVersion: 1,
    value: 'https://example.com',
    design: {
      type: 'tree',
      options: { shape: 'dome', seed: 0.5 },
    },
    theme: { type: 'preset', preset: 'spring' },
    view: { initial: 'design' },
    details: { title: '', showValue: false, border: false },
    interaction: {
      dragToRotate: true,
      tapToToggleView: true,
      autoRotate: false,
      motionBlur: true,
    },
    quality: 'high',
  });
});

test('normalizes custom themes and strips editor-only fields', () => {
  const config = normalizeDesignQRConfig({
    value: 'https://example.com',
    design: { type: 'tree', options: { shape: 'wide', seed: 8 } },
    theme: {
      type: 'custom',
      value: {
        id: 'editor-id',
        label: 'Editor label',
        isCustom: true,
        treeShape: 'pine',
        foliageColor: '#fff',
        foliageShadowColor: '#98596e',
        groundColor: '#fff',
        skyTop: '#fef6e9',
        skyBottom: '#F0CCBD',
        canopyDensity: 0.6,
        particleType: 'sakura',
        particleAmount: 500,
        groundLeavesAmount: -10,
      },
    },
    details: {
      title: 'x'.repeat(50),
      showValue: true,
      border: { padding: 29 },
    },
  });

  assert.deepEqual(config.design.options, { shape: 'wide', seed: 1 });
  assert.equal(config.details.title.length, 40);
  assert.deepEqual(config.details.border, { padding: 28 });
  assert.equal(config.theme.type, 'custom');
  if (config.theme.type === 'custom') {
    assert.deepEqual(config.theme.value, {
      foliageColor: '#FFFFFF',
      foliageShadowColor: '#98596E',
      groundColor: '#FFFFFF',
      skyTop: '#FEF6E9',
      skyBottom: '#F0CCBD',
      canopyDensity: 60,
      particleType: 'sakura',
      particleAmount: 60,
      groundLeavesAmount: 0,
    });
    assert.equal('id' in config.theme.value, false);
    assert.equal('treeShape' in config.theme.value, false);
  }
});

test('returns typed errors for unsafe or unsupported input', () => {
  const missingSchema = parseDesignQRConfig({ value: 'https://example.com' });
  assert.equal(missingSchema.ok, false);

  const unsupported = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com',
    design: { type: 'unknown' },
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.error.code, 'UNSUPPORTED_DESIGN');

  const invalidColor = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com',
    theme: {
      type: 'custom',
      value: {
        foliageColor: 'red',
        groundColor: '#fff',
        skyTop: '#fff',
        skyBottom: '#fff',
        particleType: 'none',
      },
    },
  });
  assert.equal(invalidColor.ok, false);

  const oversized = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'a'.repeat(2049),
  });
  assert.equal(oversized.ok, false);

  const removedAutoQuality = parseDesignQRConfig({
    schemaVersion: 1,
    value: 'https://example.com',
    quality: 'auto',
  });
  assert.equal(removedAutoQuality.ok, false);
  if (!removedAutoQuality.ok) {
    assert.equal(removedAutoQuality.error.message, 'quality must be low or high.');
  }
});

test('round-trips UTF-8 canonical configuration with base64url', () => {
  const encoded = encodeDesignQRConfig({
    value: 'https://example.com/春天',
    theme: 'winter',
    view: 'qr',
    details: { title: '春の QR', showValue: true },
  });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);

  const decoded = decodeDesignQRConfig(encoded);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.value, 'https://example.com/春天');
    assert.deepEqual(decoded.value.theme, { type: 'preset', preset: 'winter' });
    assert.equal(decoded.value.view.initial, 'qr');
  }
});

test('migrates encoded auto quality to high for existing links', () => {
  const encoded = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    value: 'https://example.com/previous-link',
    quality: 'auto',
  })).toString('base64url');
  const decoded = decodeDesignQRConfig(encoded);

  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.equal(decoded.value.quality, 'high');
});

test('converts legacy v2 links directly into canonical configuration', () => {
  const decoded = decodeCompatibleDesignQRConfig(LEGACY_V2_FIXTURE);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.schemaVersion, 1);
    assert.equal(decoded.value.value, 'https://example.com/old');
    assert.deepEqual(decoded.value.theme, { type: 'preset', preset: 'autumn' });
    assert.equal(decoded.value.view.initial, 'qr');
    assert.equal(decoded.value.details.title, 'Legacy title');
    assert.equal(decoded.value.details.showValue, true);
    assert.deepEqual(decoded.value.details.border, { padding: 24 });
  }
});

test('converts original compact links directly into canonical configuration', () => {
  const decoded = decodeCompatibleDesignQRConfig(LEGACY_ORIGINAL_FIXTURE);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.value, 'https://example.com/original');
    assert.deepEqual(decoded.value.theme, { type: 'preset', preset: 'summer' });
    assert.equal(decoded.value.view.initial, 'design');
  }
});

test('registry and title resolution keep tree-specific rules behind the adapter', () => {
  assert.equal(getDesignAdapter('tree')?.type, 'tree');
  assert.equal(getDesignAdapter('unknown'), undefined);
  assert.equal(
    resolveTreeTitleColor({ type: 'preset', preset: 'spring' }),
    '#98596E'
  );
  assert.equal(
    resolveTreeTitleColor({
      type: 'custom',
      value: {
        foliageColor: '#F4B4CF',
        foliageShadowColor: '#98596E',
        groundColor: '#FFFFFF',
        skyTop: '#FFFFFF',
        skyBottom: '#FFFFFF',
        particleType: 'none',
      },
    }),
    '#98596E'
  );
});
