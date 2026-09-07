/** Export the same source-aligned architectural generator to Blender's authoring
 * input. No browser, downloaded textures, user values or logos are required. */
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildCityArchitecturalModel, cityBuildingPanels, cityPanelAnchor } from '../../packages/designqr/src/designs/city/architecture.ts';
import { createCityBuildings } from '../../packages/designqr/src/designs/city/layout.ts';
import { CITY_PAVEMENT_HEIGHT } from '../../packages/designqr/src/designs/city/road-network.ts';
import { SHIBUYA_PALETTE, SHIBUYA_ASSET_SOURCE_PALETTE } from '../../packages/designqr/src/designs/city/palette.ts';

const source = await readFile(new URL('../../packages/designqr/src/designs/city/building-data.ts', import.meta.url));
const buildings = createCityBuildings([[true]]).slice(0, 2);
const models = buildings.map(b => {
  const geometry = buildCityArchitecturalModel(b, { ...SHIBUYA_PALETTE, ...SHIBUYA_ASSET_SOURCE_PALETTE });
  geometry.positions = geometry.positions.map((n, i) => (n - [b.x, CITY_PAVEMENT_HEIGHT, b.z][i % 3]) / [b.width, b.height, b.depth][i % 3]);
  const hero = cityBuildingPanels(b).find(p => p.hero), anchor = hero ? cityPanelAnchor(hero) : null;
  return { id: `building-${b.id}`, ...geometry,
    ...(anchor ? { logoPosition: [(anchor.x - b.x) / b.width, (anchor.y - CITY_PAVEMENT_HEIGHT) / b.height, (anchor.z - b.z) / b.depth], logoYaw: anchor.angle } : {}) };
});
const target = new URL('../../assets/design-qr/shibuya/landmark-meshes.json', import.meta.url);
await writeFile(target, JSON.stringify({ schema: 'designqr-shibuya-landmark-input', sourceSha256: createHash('sha256').update(source).digest('hex'), models }) + '\n');
console.log(`Prepared ${models.map(m => m.id).join(', ')} from the shared architectural generator.`);
