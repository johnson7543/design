import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const esm = await import('../dist/designqr.js');
const configEsm = await import('../dist/config.js');
const embedEsm = await import('../dist/embed.js');
const require = createRequire(import.meta.url);
const cjs = require('../dist/designqr.cjs');
const configCjs = require('../dist/config.cjs');
const embedCjs = require('../dist/embed.cjs');

if (!esm.DesignQR || !cjs.DesignQR) {
  throw new Error('The DesignQR component is missing from an ESM or CJS build.');
}
if (
  !esm.createTreeTheme
  || !cjs.createTreeTheme
  || !esm.createTreeParticleOverrides
  || !cjs.createTreeParticleOverrides
  || !esm.TREE_THEME_PRESETS
  || !cjs.TREE_THEME_PRESETS
) {
  throw new Error('The complete DesignQR theme API is missing from an ESM or CJS build.');
}
for (const entry of [esm, cjs, configEsm, configCjs]) {
  if (
    entry.VIEW_TRANSITION_SPEED_MIN !== 0.25
    || entry.VIEW_TRANSITION_SPEED_DEFAULT !== 1
    || entry.VIEW_TRANSITION_SPEED_MAX !== 2
  ) {
    throw new Error('The DesignQR transition-speed API is missing from a published build.');
  }
  if (entry.DESIGN_QR_MAX_INTERACTIVE_GRID_SIZE !== 57) {
    throw new Error('The DesignQR interactive matrix limit is missing from a published build.');
  }
}
if (
  !embedEsm.createDesignQREmbedUrl
  || !embedEsm.createDesignQRIframeMarkup
  || !embedEsm.connectDesignQREmbed
  || !embedCjs.createDesignQREmbedUrl
  || !embedCjs.createDesignQRIframeMarkup
  || !embedCjs.connectDesignQREmbed
) {
  throw new Error('The DesignQR embed API is missing from an ESM or CJS build.');
}

const declaration = await readFile(
  new URL('../dist/index.d.ts', import.meta.url),
  'utf8'
);
if (/from ['"][^'"]+\.tsx?['"]/.test(declaration)) {
  throw new Error('Published declarations still reference TypeScript source extensions.');
}

console.log('DesignQR ESM, CJS, SSR import, and declaration checks passed.');
