import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), {
    name: 'pullground-css-types',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'style.d.ts', source: 'export {};\n' });
    },
  }],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/library.ts', import.meta.url)),
      formats: ['es', 'cjs'],
      fileName: format => `pullground.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'pullground',
    },
    rollupOptions: { external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  },
});
