import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const esm = await import('../dist/designqr.js');
const embedEsm = await import('../dist/embed.js');
const require = createRequire(import.meta.url);
const cjs = require('../dist/designqr.cjs');
const embedCjs = require('../dist/embed.cjs');

if (!esm.DesignQR || !cjs.DesignQR) {
  throw new Error('The DesignQR component is missing from an ESM or CJS build.');
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
