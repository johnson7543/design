import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(packageRoot, 'src/library.ts'),
        config: resolve(packageRoot, 'src/config/index.ts'),
        embed: resolve(packageRoot, 'src/embed/index.ts'),
      },
      formats: ['es', 'cjs'],
      cssFileName: 'designqr',
      fileName: (format, entryName) => {
        const baseName = entryName === 'index' ? 'designqr' : entryName;
        return `${baseName}.${format === 'es' ? 'js' : 'cjs'}`;
      },
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        'three',
        'qrcode',
      ],
    },
  },
});
