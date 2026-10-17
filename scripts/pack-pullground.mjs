import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkRelease, packageName, repositoryRoot } from './check-pullground-release.mjs';

export const artifactDirectory = join(repositoryRoot, 'artifacts/pullground');

export async function packPullground() {
  const { manifest, npmTag } = await checkRelease();
  await mkdir(artifactDirectory, { recursive: true });
  const [packed] = JSON.parse(execFileSync('npm', [
    'pack', '--workspace', packageName, '--ignore-scripts', '--pack-destination', artifactDirectory, '--json',
  ], { cwd: repositoryRoot, encoding: 'utf8' }));
  assert.equal(packed.name, packageName);
  assert.equal(packed.version, manifest.version);
  const tarball = join(artifactDirectory, packed.filename);
  const sha256 = createHash('sha256').update(await readFile(tarball)).digest('hex');
  const git = args => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  const evidence = {
    ...packed, sha256, npmTag,
    commit: git(['rev-parse', 'HEAD']),
    workingTreeDirty: Boolean(git(['status', '--porcelain'])),
    node: process.version,
  };
  await writeFile(join(artifactDirectory, 'release.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(join(artifactDirectory, 'SHA256SUMS'), `${sha256}  ${packed.filename}\n`);
  console.log(`Prepared ${packed.filename} (${(packed.size / 1024).toFixed(1)} KiB); SHA-256 ${sha256}.`);
  return tarball;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await packPullground();
