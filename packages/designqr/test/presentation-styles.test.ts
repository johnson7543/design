import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DESIGN_QR_PRESENTATION_STYLE_DEFAULTS,
  DESIGN_QR_PRESENTATION_STYLE_PROPERTIES,
  resolveDesignQRPresentationStyles,
} from '../src/renderer/presentationStyles.ts';

test('uses package-owned fallbacks when presentation CSS properties are absent', () => {
  const resolved = resolveDesignQRPresentationStyles({
    getPropertyValue: () => '',
  });

  assert.deepEqual(resolved, DESIGN_QR_PRESENTATION_STYLE_DEFAULTS);
  for (const value of Object.values(resolved)) {
    assert.ok(value.trim().length > 0);
  }
});

test('reads and trims package-owned presentation CSS properties', () => {
  const configured = new Map<string, string>([
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.titleFontFamily, ' Fixture Title '],
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.bodyFontFamily, ' Fixture Body '],
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.contentColor, ' #282018 '],
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.borderColor, ' rgba(95, 78, 61, 0.5) '],
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.borderHighlightColor, ' rgba(255, 255, 255, 0.5) '],
  ]);

  assert.deepEqual(
    resolveDesignQRPresentationStyles({
      getPropertyValue: (property) => configured.get(property) ?? '',
    }),
    {
      titleFontFamily: 'Fixture Title',
      bodyFontFamily: 'Fixture Body',
      contentColor: '#282018',
      borderColor: 'rgba(95, 78, 61, 0.5)',
      borderHighlightColor: 'rgba(255, 255, 255, 0.5)',
    }
  );
});

test('declares every presentation CSS property in the package stylesheet', async () => {
  const stylesheet = await readFile(
    new URL('../src/style.css', import.meta.url),
    'utf8'
  );
  const expectedDeclarations = {
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.titleFontFamily]:
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.titleFontFamily,
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.bodyFontFamily]:
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.bodyFontFamily,
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.contentColor]:
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.contentColor,
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.borderColor]:
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.borderColor,
    [DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.borderHighlightColor]:
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.borderHighlightColor,
  };
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const [property, fallback] of Object.entries(expectedDeclarations)) {
    assert.match(property, /^--designqr-/);
    const declaration = stylesheet.match(
      new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]+);`)
    );
    assert.ok(declaration, `Missing ${property} in the package stylesheet.`);
    assert.equal(
      declaration[1].replace(/\s+/g, ' ').trim().toLowerCase(),
      fallback.replace(/\s+/g, ' ').trim().toLowerCase(),
      `${property} must match its package fallback.`
    );
  }
});
