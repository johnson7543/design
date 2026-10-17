import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
export const packageName = '@johnson7543/pullground';

export function validateRelease(manifest, lock, tag) {
  const failures = [];
  const expect = (condition, message) => { if (!condition) failures.push(message); };
  const numeric = '(?:0|[1-9]\\d*)';
  const identifier = `(?:${numeric}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)`;
  const versionPattern = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-${identifier}(?:\\.${identifier})*)?$`);
  const expectedTag = `pullground-v${manifest.version}`;
  const npmTag = manifest.version?.includes('-') ? 'next' : 'latest';

  expect(manifest.name === packageName, `Package name must be ${packageName}.`);
  expect(versionPattern.test(manifest.version) && manifest.version !== '0.0.0', 'Use a nonzero canonical release version without build metadata.');
  expect(manifest.private !== true, 'The release package must not be private.');
  expect(manifest.license === 'MIT', 'The license must be MIT.');
  expect(Boolean(manifest.author) && Boolean(manifest.description) && manifest.keywords?.length > 0, 'Include author, description, and keywords.');
  expect(manifest.homepage === 'https://design.johnson7543.com/pullground', 'The homepage must identify the canonical demo.');
  expect(manifest.bugs?.url === 'https://github.com/johnson7543/design/issues', 'The issue tracker must match the repository.');
  expect(manifest.repository?.type === 'git'
    && manifest.repository.url === 'git+https://github.com/johnson7543/design.git'
    && manifest.repository.directory === 'packages/pullground', 'Repository metadata must identify the Pullground workspace.');
  expect(manifest.publishConfig?.access === 'public'
    && manifest.publishConfig.registry === 'https://registry.npmjs.org/', 'Publish publicly to the npm registry.');
  expect(manifest.publishConfig?.tag === npmTag, `publishConfig.tag must be ${npmTag} for this version.`);
  expect(JSON.stringify([...(manifest.files ?? [])].sort()) === JSON.stringify(['LICENSE', 'README.md', 'dist']), 'Publish only dist, README.md, and LICENSE.');
  expect(manifest.main === './dist/pullground.cjs' && manifest.module === './dist/pullground.js'
    && manifest.types === './dist/index.d.ts', 'ESM, CommonJS, and declaration entry points must match the build.');
  const expectedExports = {
    '.': { types: './dist/index.d.ts', import: './dist/pullground.js', require: './dist/pullground.cjs' },
    './style.css': { types: './dist/style.d.ts', default: './dist/pullground.css' },
  };
  try { assert.deepEqual(manifest.exports, expectedExports); } catch { failures.push('Public exports must match the supported component and stylesheet entries.'); }
  expect(manifest.sideEffects?.length === 1 && manifest.sideEffects[0] === './dist/pullground.css', 'Preserve the optional stylesheet side effect.');
  expect(manifest.peerDependencies?.react === '^19.0.0', 'The tested React peer range must be ^19.0.0.');
  expect(Object.keys(manifest.dependencies ?? {}).length === 0, 'The package has no runtime dependencies.');
  const entry = lock.packages?.['packages/pullground'];
  expect(entry?.version === manifest.version && entry?.license === manifest.license, 'Workspace version and license must match package-lock.json.');
  try { assert.deepEqual(entry?.peerDependencies, manifest.peerDependencies); } catch { failures.push('Peer dependencies must match package-lock.json.'); }
  if (tag) expect(tag === expectedTag, `Release tag must be ${expectedTag}; received ${tag}.`);
  if (failures.length) throw new Error(`Pullground release contract failed:\n- ${failures.join('\n- ')}`);
  return { expectedTag, npmTag };
}

export async function checkRelease(tag) {
  const manifest = JSON.parse(await readFile(join(repositoryRoot, 'packages/pullground/package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(repositoryRoot, 'package-lock.json'), 'utf8'));
  const result = validateRelease(manifest, lock, tag);
  for (const file of ['README.md', 'LICENSE']) await access(join(repositoryRoot, 'packages/pullground', file));
  return { ...result, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { tag: { type: 'string' } } });
  const githubTag = process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME?.startsWith('pullground-v')
    ? process.env.GITHUB_REF_NAME : undefined;
  const { expectedTag, npmTag } = await checkRelease(values.tag ?? githubTag);
  console.log(`Pullground release contract passed: ${expectedTag}, npm channel ${npmTag}.`);
}
