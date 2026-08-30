import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function printUsage() {
  console.log(`Usage:
  npm run init:demo -- --product "Product Name" --route /route \\
    --consumer src/platform/DesignHomePage.tsx [options]

Options:
  --id <slug>               Defaults to a slug generated from --product
  --ready-selector <css>    Defaults to body
  --orientation <value>     portrait (default) or landscape
  --duration <seconds>      Defaults to 8
  --fps <number>            Defaults to 60`);
}

function repositoryPath(pathValue, label) {
  const resolvedPath = resolve(projectRoot, pathValue);
  const relativePath = relative(projectRoot, resolvedPath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside ${projectRoot}.`);
  }
  return { absolute: resolvedPath, relative: relativePath.split(sep).join('/') };
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

if (process.argv.includes('--help')) {
  printUsage();
  process.exit(0);
}

const product = argumentValue('--product');
const route = argumentValue('--route');
const consumerArgument = argumentValue('--consumer');
if (!product || !route || !consumerArgument) {
  printUsage();
  throw new Error('--product, --route, and --consumer are required.');
}
if (!route.startsWith('/')) throw new Error('--route must begin with /.');

const id = argumentValue('--id') ?? slugify(product);
if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  throw new Error('--id must contain lowercase letters, digits, and hyphens.');
}
const orientation = argumentValue('--orientation') ?? 'portrait';
if (!['portrait', 'landscape'].includes(orientation)) {
  throw new Error('--orientation must be portrait or landscape.');
}
const durationSeconds = Number(argumentValue('--duration') ?? 8);
const fps = Number(argumentValue('--fps') ?? 60);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
  throw new Error('--duration must be a positive number.');
}
if (!Number.isInteger(fps) || fps <= 0) {
  throw new Error('--fps must be a positive integer.');
}

const consumer = repositoryPath(consumerArgument, 'Consumer file');
await access(consumer.absolute);
const scenarioFile = repositoryPath(
  `scripts/demo-video-scenarios/${id}.json`,
  'Scenario file'
);
const isPortrait = orientation === 'portrait';
const videoPublicPath = `/previews/${id}.mp4`;
const posterPublicPath = `/previews/${id}.webp`;
const scenario = {
  version: 1,
  id,
  product,
  description: `Initial catalog demo for ${product}.`,
  route,
  windowTitle: product,
  readySelector: argumentValue('--ready-selector') ?? 'body',
  settleMs: 1000,
  viewport: {
    width: isPortrait ? 405 : 1280,
    height: 720,
    deviceScaleFactor: 1,
    isMobile: isPortrait,
    hasTouch: isPortrait,
  },
  recording: {
    fps,
    durationSeconds,
    output: `public${videoPublicPath}`,
    poster: `public${posterPublicPath}`,
    posterAtSeconds: 0.4,
    posterQuality: 82,
    size: {
      width: isPortrait ? 720 : 1280,
      height: isPortrait ? 1280 : 720,
    },
    crf: 22,
  },
  quality: {
    contactSheetFps: 2,
    motionChecks: [],
  },
  actions: [{ action: 'wait', ms: 500 }],
  application: {
    consumerFiles: [consumer.relative],
    videoPublicPath,
    posterPublicPath,
  },
};

await mkdir(dirname(scenarioFile.absolute), { recursive: true });
try {
  await writeFile(scenarioFile.absolute, `${JSON.stringify(scenario, null, 2)}\n`, {
    flag: 'wx',
  });
} catch (error) {
  if (error?.code === 'EEXIST') {
    throw new Error(
      `${scenarioFile.relative} already exists. Edit it directly; initialization never overwrites scenarios.`
    );
  }
  throw error;
}

console.log(`Created ${scenarioFile.relative}`);
console.log(`Next: replace the starter wait with the requested actions.`);
console.log(`Apply ${videoPublicPath} and ${posterPublicPath} in ${consumer.relative}.`);
console.log(`Then run: npm run record:demo -- --scenario ${scenarioFile.relative}`);
