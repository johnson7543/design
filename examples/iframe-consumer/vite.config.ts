import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const exampleRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: exampleRoot,
  build: {
    sourcemap: true,
  },
});
