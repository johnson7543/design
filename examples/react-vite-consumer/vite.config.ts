import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const exampleRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: exampleRoot,
  plugins: [react()],
  build: {
    sourcemap: true,
  },
});
