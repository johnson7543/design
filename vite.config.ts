import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: 'designqr/style.css',
        replacement: fileURLToPath(new URL('./packages/designqr/src/style.css', import.meta.url)),
      },
      {
        find: 'designqr/embed',
        replacement: fileURLToPath(new URL('./packages/designqr/src/embed/index.ts', import.meta.url)),
      },
      {
        find: 'designqr/editor',
        replacement: fileURLToPath(new URL('./packages/designqr/src/editor.ts', import.meta.url)),
      },
      {
        find: 'designqr/config',
        replacement: fileURLToPath(new URL('./packages/designqr/src/config/index.ts', import.meta.url)),
      },
      {
        find: 'designqr',
        replacement: fileURLToPath(new URL('./packages/designqr/src/index.ts', import.meta.url)),
      },
    ],
  },
  build: {
    sourcemap: false,
  },
});
