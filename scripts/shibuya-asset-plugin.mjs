import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Build-only encoding: the repository stores GLB, never hand-edited base64. */
export function shibuyaAssetPlugin() {
  const id = '\0shibuya-asset-data';
  const glbPath = fileURLToPath(new URL('../packages/designqr/src/designs/city/assets/shibuya.glb', import.meta.url));
  const manifestPath = fileURLToPath(new URL('../packages/designqr/src/designs/city/assets/shibuya-manifest.json', import.meta.url));
  return {
    name: 'designqr-shibuya-asset-data',
    resolveId(source) { if (source === 'virtual:designqr-shibuya-assets') return id; },
    async load(source) {
      if (source !== id) return;
      this.addWatchFile(glbPath); this.addWatchFile(manifestPath);
      const [glb, manifest] = await Promise.all([readFile(glbPath), readFile(manifestPath, 'utf8')]);
      if (glb.length > 1024 * 1024) throw new Error('Shibuya GLB exceeds its 1 MiB budget.');
      return `export const glb = ${JSON.stringify(glb.toString('base64'))};\nexport const manifest = ${JSON.stringify(JSON.parse(manifest))};\n`;
    },
  };
}
