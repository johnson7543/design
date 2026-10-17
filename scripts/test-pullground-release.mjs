import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateRelease } from './check-pullground-release.mjs';

const original = JSON.parse(await readFile(new URL('../packages/pullground/package.json', import.meta.url), 'utf8'));
function fixture(version = '0.1.0-rc.1') {
  const manifest = structuredClone(original);
  manifest.version = version;
  manifest.publishConfig.tag = version.includes('-') ? 'next' : 'latest';
  const lock = { packages: { 'packages/pullground': {
    version, license: manifest.license, peerDependencies: structuredClone(manifest.peerDependencies),
  } } };
  return { manifest, lock };
}

test('release and prerelease versions select their own npm channels', () => {
  for (const version of ['0.1.0', '0.1.0-rc.1']) {
    const { manifest, lock } = fixture(version);
    assert.equal(validateRelease(manifest, lock, `pullground-v${version}`).npmTag, manifest.publishConfig.tag);
  }
});

test('mismatched tags and lockfiles cannot qualify', () => {
  const { manifest, lock } = fixture();
  assert.throws(() => validateRelease(manifest, lock, 'pullground-v0.1.0'), /Release tag/);
  lock.packages['packages/pullground'].version = '0.0.0';
  assert.throws(() => validateRelease(manifest, lock), /package-lock/);
});

test('prereleases cannot accidentally use latest', () => {
  const { manifest, lock } = fixture();
  manifest.publishConfig.tag = 'latest';
  assert.throws(() => validateRelease(manifest, lock), /must be next/);
});

test('rejects ambiguous versions and invalid numeric prerelease identifiers', () => {
  for (const version of ['0.0.0', '01.0.0', '0.1.0-rc.01', '0.1.0+build', 'v0.1.0']) {
    const { manifest, lock } = fixture(version);
    assert.throws(() => validateRelease(manifest, lock), /canonical release version/);
  }
});

test('private packages, unexpected exports, and accidental source files cannot qualify', () => {
  for (const change of [
    manifest => { manifest.private = true; },
    manifest => { manifest.exports['./internal'] = './src/input.ts'; },
    manifest => { manifest.files.push('src'); },
  ]) {
    const { manifest, lock } = fixture();
    change(manifest);
    assert.throws(() => validateRelease(manifest, lock), /release contract failed/);
  }
});
