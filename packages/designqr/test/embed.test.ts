import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeDesignQRConfig,
  normalizeDesignQRConfig,
} from '../src/config/index.ts';
import {
  createDesignQREmbedUrl,
  createDesignQRIframeMarkup,
  createDesignQRInstanceId,
  createDesignQRMessage,
  isDesignQRChildMessage,
  isDesignQRInstanceId,
  isDesignQRParentMessage,
} from '../src/embed/index.ts';

test('builds a canonical hosted-player URL without browser globals', () => {
  const instanceId = createDesignQRInstanceId();
  const source = createDesignQREmbedUrl(
    {
      value: 'https://example.com/embed',
      theme: 'winter',
      view: 'qr',
      details: { title: 'Embedded QR', showValue: true },
      logo: { src: '/brand.webp', alt: 'Embedded brand', size: 0.14 },
    },
    {
      origin: 'http://127.0.0.1:4175/some/ignored/path',
      instanceId,
    }
  );

  const url = new URL(source);
  assert.equal(url.origin, 'http://127.0.0.1:4175');
  assert.equal(url.pathname, '/qr/embed');
  assert.equal(url.searchParams.get('instanceId'), instanceId);

  const encoded = url.searchParams.get('config');
  assert.ok(encoded);
  const decoded = decodeDesignQRConfig(encoded);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.value.view.initial, 'qr');
    assert.deepEqual(decoded.value.theme, { type: 'preset', preset: 'winter' });
    assert.deepEqual(decoded.value.logo, {
      src: '/brand.webp',
      alt: 'Embedded brand',
      size: 0.14,
    });
  }
});

test('builds safe copy-ready iframe markup', () => {
  const markup = createDesignQRIframeMarkup(
    'https://design.example/qr/embed?config=one&instanceId=two'
  );

  assert.match(markup, /src="https:\/\/design\.example\/qr\/embed\?config=one&amp;instanceId=two"/);
  assert.match(markup, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(markup, /referrerpolicy="no-referrer"/);
  assert.match(markup, /title="Interactive DesignQR"/);

  assert.throws(
    () => createDesignQRIframeMarkup('javascript:alert(1)'),
    /HTTP or HTTPS/
  );
  assert.throws(
    () => createDesignQRIframeMarkup('https://user:password@design.example/qr/embed'),
    /credentials/
  );
});

test('rejects unsafe embed URL inputs', () => {
  assert.throws(
    () => createDesignQREmbedUrl(
      { value: 'https://example.com' },
      { origin: 'javascript:alert(1)' }
    ),
    /HTTP or HTTPS/
  );
  assert.throws(
    () => createDesignQREmbedUrl(
      { value: 'https://example.com' },
      { instanceId: 'contains spaces' }
    ),
    /URL-safe/
  );
});

test('validates parent protocol envelopes and payloads', () => {
  const instanceId = createDesignQRInstanceId();
  assert.equal(isDesignQRInstanceId(instanceId), true);
  assert.equal(
    isDesignQRParentMessage(
      createDesignQRMessage('*', 'designqr:connect')
    ),
    true
  );
  assert.equal(
    isDesignQRParentMessage(
      createDesignQRMessage('*', 'designqr:set-view', { view: 'qr' })
    ),
    false
  );
  assert.equal(
    isDesignQRParentMessage(
      createDesignQRMessage(instanceId, 'designqr:set-config', {
        config: normalizeDesignQRConfig({ value: 'https://example.com' }),
      })
    ),
    true
  );
  assert.equal(
    isDesignQRParentMessage({
      source: 'designqr',
      protocolVersion: 2,
      instanceId,
      type: 'designqr:pause',
    }),
    false
  );
});

test('validates child events and structured-cloned PNG payload shape', () => {
  const instanceId = createDesignQRInstanceId();
  assert.equal(
    isDesignQRChildMessage(
      createDesignQRMessage(instanceId, 'designqr:ready', { view: 'design' })
    ),
    true
  );
  assert.equal(
    isDesignQRChildMessage(
      createDesignQRMessage(instanceId, 'designqr:export-result', {
        requestId: 'req_123',
        blob: new Blob(['png'], { type: 'image/png' }),
      })
    ),
    true
  );
  assert.equal(
    isDesignQRChildMessage(
      createDesignQRMessage(instanceId, 'designqr:export-result', {
        requestId: 'not valid',
        blob: new Blob(['png'], { type: 'image/png' }),
      })
    ),
    false
  );
  assert.equal(
    isDesignQRChildMessage(
      createDesignQRMessage(instanceId, 'designqr:error', {
        error: { code: 'UNKNOWN', message: 'Not part of protocol v1.' },
      })
    ),
    false
  );
  assert.equal(
    isDesignQRChildMessage(
      createDesignQRMessage(instanceId, 'designqr:error', {
        error: { code: 'LOGO_LOAD_FAILED', message: 'Logo could not load.' },
      })
    ),
    true
  );
});
