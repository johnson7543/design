import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  await readFile(join(repositoryRoot, 'packages', 'designqr', 'package.json'), 'utf8')
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'designqr-pack-audit-'));
const reportPath = join(temporaryDirectory, 'report.json');
let stdout;

try {
  const reportFile = await open(reportPath, 'w');
  try {
    const npm = spawn(
      'npm',
      ['pack', '--dry-run', '--workspace', 'designqr', '--json'],
      {
        cwd: repositoryRoot,
        stdio: ['ignore', reportFile.fd, 'inherit'],
      }
    );
    const [exitCode, signal] = await once(npm, 'exit');
    if (exitCode !== 0) {
      throw new Error(
        `npm pack failed with ${signal ? `signal ${signal}` : `exit code ${exitCode}`}.`
      );
    }
  } finally {
    await reportFile.close();
  }
  stdout = await readFile(reportPath, 'utf8');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const reports = JSON.parse(stdout);
if (!Array.isArray(reports) || reports.length !== 1) {
  throw new Error('Expected npm pack to return exactly one DesignQR package report.');
}

const report = reports[0];
const paths = new Set(report.files.map((file) => file.path));
const requiredPaths = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/designqr.js',
  'dist/designqr.cjs',
  'dist/designqr.css',
  'dist/index.d.ts',
  'dist/config.js',
  'dist/config.cjs',
  'dist/embed.js',
  'dist/embed.cjs',
];

const failures = [];
if (report.name !== packageJson.name || report.version !== packageJson.version) {
  failures.push(
    `Tarball identity ${report.name}@${report.version} does not match package.json.`
  );
}

for (const requiredPath of requiredPaths) {
  if (!paths.has(requiredPath)) failures.push(`Tarball is missing ${requiredPath}.`);
}

for (const path of paths) {
  const allowed = path === 'package.json'
    || path === 'README.md'
    || path === 'LICENSE'
    || path.startsWith('dist/');
  if (!allowed) failures.push(`Tarball contains unexpected path ${path}.`);
}

if (failures.length > 0) {
  throw new Error(`DesignQR package audit failed:\n- ${failures.join('\n- ')}`);
}

const packedKilobytes = (report.size / 1000).toFixed(1);
const unpackedKilobytes = (report.unpackedSize / 1000).toFixed(1);
console.log(
  `DesignQR package audit passed (${report.entryCount} files, `
  + `${packedKilobytes} kB packed, ${unpackedKilobytes} kB unpacked).`
);
