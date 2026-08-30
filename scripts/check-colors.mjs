import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Color } from 'three';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const registryPath = join(projectRoot, 'docs', 'design-system', 'colors.md');
const ignoredDirectories = new Set(['.git', '.wrangler', 'dist', 'node_modules']);
const sourceExtensions = new Set([
  '.c',
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.jsonc',
  '.md',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
]);
const failures = [];
const namedColorKeywords = new Set(Object.keys(Color.NAMES));
const allowedSemanticKeywords = new Set(['currentcolor', 'transparent']);

function normalizeHex(value) {
  let digits = value.replace(/^(?:#|0x)/i, '').toLowerCase();
  if (digits.length === 3 || digits.length === 4) {
    digits = [...digits].map((digit) => digit + digit).join('');
  }
  if (digits.length === 8) digits = digits.slice(0, 6);
  return `#${digits}`;
}

function channelsToHex(channels) {
  const digits = channels
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');
  return `#${digits}`;
}

function lineFor(source, index) {
  return source.slice(0, index).split('\n').length;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(path));
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }

  return files;
}

const registry = await readFile(registryPath, 'utf8');
const approvedStartMarker = '<!-- approved-colors:start -->';
const approvedEndMarker = '<!-- approved-colors:end -->';
const approvedStart = registry.indexOf(approvedStartMarker);
const approvedEnd = registry.indexOf(approvedEndMarker);
if (approvedStart === -1 || approvedEnd === -1 || approvedEnd <= approvedStart) {
  throw new Error(`${relative(projectRoot, registryPath)} must contain one valid approved-color marker block`);
}
const approvedBlock = registry.slice(approvedStart, approvedEnd + approvedEndMarker.length);
const approvedColors = new Set(
  [...approvedBlock.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => normalizeHex(match[0]))
);

const sourceFiles = await collectSourceFiles(projectRoot);

const usages = new Map();
function recordUsage(color, path, line) {
  if (!usages.has(color)) usages.set(color, []);
  usages.get(color).push(`${path}:${line}`);
}

for (const absolutePath of sourceFiles) {
  const path = relative(projectRoot, absolutePath).split(sep).join('/');
  let source = await readFile(absolutePath, 'utf8');
  if (absolutePath === registryPath) {
    source = `${source.slice(0, approvedStart)}${source.slice(approvedEnd + approvedEndMarker.length)}`;
  }

  for (const match of source.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    recordUsage(normalizeHex(match[0]), path, lineFor(source, match.index));
  }

  for (const match of source.matchAll(/\b0x([0-9a-f]{6}|[0-9a-f]{8})(?![0-9a-f])/gi)) {
    recordUsage(normalizeHex(match[0]), path, lineFor(source, match.index));
  }

  for (const match of source.matchAll(/(?<![a-z0-9_])rgba?\(([^)]*)\)/gi)) {
    if (match[1].includes('${')) continue;
    const parts = match[1].trim().split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) continue;
    const channels = parts.slice(0, 3).map((part) => {
      if (part.endsWith('%')) return Number.parseFloat(part) * 2.55;
      return Number.parseFloat(part);
    });
    if (channels.every(Number.isFinite)) {
      recordUsage(channelsToHex(channels), path, lineFor(source, match.index));
    }
  }

  const extension = extname(absolutePath).toLowerCase();
  if (extension !== '.md') {
    for (const match of source.matchAll(/\b(?:hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/g)) {
      failures.push(`${path}:${lineFor(source, match.index)}: raw ${match[0].trim()} color syntax is prohibited; use an approved hex value or token`);
    }

    const namedColorContexts = extension === '.css'
      ? /(?:^|[;{])\s*(?:--[\w-]+|color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline|box-shadow|text-shadow|fill|stroke|caret-color|accent-color)\s*:\s*([^;{}]+)/gim
      : /\b(?:backgroundColor|borderColor|color|fill|fillStyle|shadowColor|stroke|strokeStyle)\s*(?::|=)\s*(['"])([a-z]+)\1/gi;

    for (const match of source.matchAll(namedColorContexts)) {
      const candidates = extension === '.css'
        ? match[1].match(/[a-z]+/gi) ?? []
        : [match[2]];
      for (const candidate of candidates) {
        const keyword = candidate.toLowerCase();
        if (allowedSemanticKeywords.has(keyword) || !namedColorKeywords.has(keyword)) continue;
        failures.push(`${path}:${lineFor(source, match.index)}: named color "${candidate}" is prohibited; use an approved hex value or token`);
      }
    }
  }
}

for (const [color, locations] of [...usages].sort(([left], [right]) => left.localeCompare(right))) {
  if (approvedColors.has(color)) continue;
  const shownLocations = locations.slice(0, 3).join(', ');
  const remainder = locations.length > 3 ? ` (+${locations.length - 3} more)` : '';
  failures.push(`${color} is not approved; used at ${shownLocations}${remainder}`);
}

if (failures.length > 0) {
  console.error('Repository color contract failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`\nAdd approved colors to ${relative(projectRoot, registryPath)} only when the user explicitly changes the repository palette.`);
  process.exitCode = 1;
} else {
  console.log(`Repository color contract passed (${approvedColors.size} approved base colors, ${usages.size} in use).`);
}
