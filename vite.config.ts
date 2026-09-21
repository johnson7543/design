import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { dotonboriAssetPlugin } from './scripts/dotonbori-asset-plugin.mjs';
import { shibuyaAssetPlugin } from './scripts/shibuya-asset-plugin.mjs';

const notoNoticePath = fileURLToPath(new URL(
  './packages/designqr/third-party-licenses/noto-cjk.txt', import.meta.url
));

const notoNoticePlugin: Plugin = {
  name: 'designqr-noto-notice',
  buildStart() {
    this.addWatchFile(notoNoticePath);
  },
  async generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'licenses/noto-cjk.txt',
      source: await readFile(notoNoticePath, 'utf8'),
    });
  },
  configureServer(server) {
    server.middlewares.use('/licenses/noto-cjk.txt', async (_request, response, next) => {
      try {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end(await readFile(notoNoticePath, 'utf8'));
      } catch (error) {
        next(error);
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), shibuyaAssetPlugin(), dotonboriAssetPlugin(), notoNoticePlugin],
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
