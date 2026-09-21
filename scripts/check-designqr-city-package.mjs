import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = await mkdtemp(join(tmpdir(), 'designqr-city-package-'));
const run = (command, args, cwd = root, env = process.env) => execFileSync(command, args, { cwd, env, stdio: 'inherit' });
const pkg = JSON.parse(await readFile(join(root, 'packages/designqr/package.json'), 'utf8'));
const dependencies = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).dependencies;
run('npm', ['pack', '--workspace', 'designqr', '--pack-destination', output, '--cache', join(output, 'npm-cache')]);
const consumer = join(output, 'consumer');
await cp(join(root, 'scripts/fixtures/city-assets-consumer'), consumer, { recursive: true });
await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
  designqr: `file:../designqr-${pkg.version}.tgz`, react: dependencies.react, 'react-dom': dependencies['react-dom'],
} }, null, 2));
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(output, 'npm-cache')], consumer);
const require = createRequire(join(consumer, 'package.json'));
const cjs = require('designqr');
assert.equal(typeof cjs.DesignQR, 'object');
const esm = await import(pathToFileURL(join(consumer, 'node_modules/designqr/dist/designqr.js')));
for (const api of [cjs, esm, require('designqr/config')]) {
  assert.deepEqual(Object.keys(api.CITY_PRESETS), ['shibuya', 'dotonbori', 'tokyo-tower']);
  for (const theme of Object.keys(api.CITY_PRESETS)) {
    assert.equal(api.isCityPreset(theme), true);
    assert.equal(api.normalizeDesignQRConfig({ value: 'City package check', design: 'city', theme }).theme.preset, theme);
  }
  assert.equal(api.isCityPreset('unknown-city'), false);
}
assert.equal(typeof globalThis.window, 'undefined', 'SSR import created browser globals.');
run(process.execPath, ['scripts/check-city-startup.mjs', join(consumer, 'node_modules/designqr/dist')], root,
  { ...process.env, DESIGNQR_STARTUP_REPORT: join(output, 'startup-budget.json') });
run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', consumer, '--base=/city-consumer/']);
run(process.execPath, ['scripts/smoke-city-loading.mjs'], root, { ...process.env,
  DESIGNQR_CITY_ASSET_CONSUMER: consumer, DESIGNQR_CITY_ASSET_CAPTURES: output });
run(process.execPath, ['scripts/smoke-designqr-city-assets.mjs'], root, { ...process.env,
  DESIGNQR_CITY_ASSET_CONSUMER: consumer, DESIGNQR_CITY_ASSET_CAPTURES: output, DESIGNQR_CITY_ASSET_PORT: '4191' });
run(process.execPath, ['scripts/smoke-dotonbori.mjs'], root, { ...process.env,
  DESIGNQR_DOTONBORI_CONSUMER: consumer, DESIGNQR_DOTONBORI_CAPTURES: output, DESIGNQR_DOTONBORI_PORT: '4192' });
console.log(`Installed-tarball ESM/CJS/SSR and non-root browser proof passed. Artifacts: ${output}`);
