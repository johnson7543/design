import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../assets/design-qr/dotonbori/', import.meta.url);
const filenames = ['study-manifest.json', 'east-source-meshes.json', 'dotonbori-focus.glb', 'dotonbori-bridge-deck-study.glb', 'focus-manifest.json', 'focus-layout.json', 'waterfront-layout.json'];

/** Build from the reviewed exports; never regenerate geography during a build. */
export async function readDotonboriAssets() {
  const [manifestBytes, sourceBytes, buildings, bridge, focusBytes, layoutBytes, waterfrontBytes] = await Promise.all(
    filenames.map(name => readFile(new URL(name, directory))));
  const manifest = JSON.parse(manifestBytes);
  const focus = JSON.parse(focusBytes), layout = JSON.parse(layoutBytes);
  const waterfront = JSON.parse(waterfrontBytes);
  const source = JSON.parse(sourceBytes);
  const waterfrontGenerator = await readFile(new URL('./blender/prepare-dotonbori-waterfront.py', import.meta.url));
  if (layout.version !== 5 || focus.version !== 5 || layout.sourceMeshSha256 !== focus.sourceMeshSha256
    || layout.bridgeStudySha256 !== manifest.bridgeStudy.sourceSha256
    || focus.sourceBuildingCount !== source.objects.length
    || focus.objects.some(object => !source.objects.some(s => s.id === object.sourceId && s.lod === object.lod))
    || layout.objects.map(object => `${object.sourceId}:${object.variationIndex}`).join() !== focus.objects.map(object => `${object.sourceId}:${object.variationIndex}`).join()
    || layout.objects.some((object, i) => JSON.stringify(object.translationEastNorthM) !== JSON.stringify(focus.objects[i].translationEastNorthM)
      || JSON.stringify(object.translationEastNorthM) !== JSON.stringify(layout.landmarkOffsetsEastNorthM[object.sourceId] ?? [0, 0]))) {
    throw new Error('Dōtonbori focus registration or source inventory differs from its study.');
  }
  for (const [bytes, expected] of [[sourceBytes, focus.sourceMeshSha256], [layoutBytes, focus.layoutSha256],
    [buildings, focus.glbSha256], [bridge, manifest.bridgeStudy.glbSha256],
    [sourceBytes, waterfront.sourceMeshSha256], [layoutBytes, waterfront.layoutSha256],
    [waterfrontGenerator, waterfront.generatorSha256]]) {
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Dōtonbori source/export hash mismatch. Revalidate the study first.');
  }
  if (buildings.length + bridge.length > 768 * 1024) throw new Error('Dōtonbori GLBs exceed their combined 768 KiB budget.');
  return {
    buildings: buildings.toString('base64'), bridge: bridge.toString('base64'), manifest, focus,
    layout: { tileSizeM: layout.tileSizeM, centerEastNorthM: layout.centerEastNorthM,
      rotationYRadians: layout.rotationYRadians,
      outlineEastNorthM: layout.outlineEastNorthM, landmarkOffsetsEastNorthM: layout.landmarkOffsetsEastNorthM },
    // Plan coordinates carry no claim about terrain or water elevations.
    plan: layout.plan, waterfront,
  };
}

export function dotonboriAssetPlugin() {
  const id = '\0dotonbori-asset-data';
  return {
    name: 'designqr-dotonbori-asset-data',
    resolveId(source) { if (source === 'virtual:designqr-dotonbori-assets') return id; },
    async generateBundle() {
      const source = await readFile(new URL('../packages/designqr/third-party-licenses/dotonbori-sources.txt', import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'licenses/dotonbori-sources.txt', source });
    },
    async load(source) {
      if (source !== id) return;
      filenames.forEach(name => this.addWatchFile(fileURLToPath(new URL(name, directory))));
      return `export default ${JSON.stringify(await readDotonboriAssets())};\n`;
    },
  };
}
