import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirectory = join(repositoryRoot, 'packages', 'designqr');
const packageJsonPath = join(packageDirectory, 'package.json');
const packageLockPath = join(repositoryRoot, 'package-lock.json');

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    failures.push(`${name} requires a value.`);
    return undefined;
  }
  return value;
}

const cliTag = optionValue('--tag');
const githubTag = process.env.GITHUB_REF_TYPE === 'tag'
  ? process.env.GITHUB_REF_NAME
  : undefined;
const releaseTag = cliTag ?? githubTag;
const expectedTag = `designqr-v${packageJson.version}`;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

expect(packageJson.name === 'designqr', 'Package name must remain designqr.');
expect(semverPattern.test(packageJson.version), `Invalid package version: ${packageJson.version}`);
expect(packageJson.private !== true, 'The release package must not be private.');
expect(packageJson.license === 'MIT', 'The release package license must be MIT.');
expect(packageJson.repository?.type === 'git', 'repository.type must be git.');
expect(
  packageJson.repository?.url === 'git+https://github.com/johnson7543/design.git',
  'repository.url must match the public GitHub repository.'
);
expect(
  packageJson.repository?.directory === 'packages/designqr',
  'repository.directory must identify the package workspace.'
);
expect(packageJson.publishConfig?.access === 'public', 'publishConfig.access must be public.');
expect(
  packageJson.publishConfig?.registry === 'https://registry.npmjs.org/',
  'publishConfig.registry must be the public npm registry.'
);

const publishedFiles = new Set(packageJson.files ?? []);
for (const requiredFile of ['dist', 'README.md', 'LICENSE']) {
  expect(publishedFiles.has(requiredFile), `Package files must include ${requiredFile}.`);
}

for (const exportName of ['.', './config', './embed', './style.css']) {
  expect(packageJson.exports?.[exportName], `Package exports must include ${exportName}.`);
}

const lockEntry = packageLock.packages?.['packages/designqr'];
expect(lockEntry?.version === packageJson.version, 'package-lock version must match package.json.');
expect(lockEntry?.license === packageJson.license, 'package-lock license must match package.json.');

for (const requiredPath of ['README.md', 'LICENSE']) {
  try {
    await access(join(packageDirectory, requiredPath), constants.R_OK);
  } catch {
    failures.push(`${requiredPath} is missing or unreadable.`);
  }
}

if (releaseTag) {
  expect(
    releaseTag === expectedTag,
    `Release tag ${releaseTag} does not match package version; expected ${expectedTag}.`
  );
}

if (failures.length > 0) {
  throw new Error(`DesignQR release contract failed:\n- ${failures.join('\n- ')}`);
}

console.log(
  releaseTag
    ? `DesignQR release contract passed for ${releaseTag}.`
    : `DesignQR release contract passed; expected tag is ${expectedTag}.`
);
