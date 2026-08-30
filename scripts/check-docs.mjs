import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ignoredDirectories = new Set(['.git', '.wrangler', 'dist', 'node_modules']);
const failures = [];

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(path));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(path);
    }
  }

  return files;
}

const markdownFiles = await collectMarkdownFiles(projectRoot);
const allowedRootDocuments = new Set(['AGENTS.md', 'README.md']);
let checkedLinks = 0;

for (const absolutePath of markdownFiles) {
  const repositoryPath = relative(projectRoot, absolutePath).split(sep).join('/');
  const source = await readFile(absolutePath, 'utf8');

  if (!repositoryPath.includes('/') && !allowedRootDocuments.has(repositoryPath)) {
    failures.push(`${repositoryPath}: move maintained documentation under docs/<product>/`);
  }

  if (repositoryPath.startsWith('docs/')) {
    const filename = repositoryPath.split('/').at(-1);
    if (filename !== 'README.md' && !/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(filename)) {
      failures.push(`${repositoryPath}: documentation filenames must use lowercase kebab-case`);
    }
    if (repositoryPath.split('/').length === 2 && filename !== 'README.md') {
      failures.push(`${repositoryPath}: top-level docs must be an index or live under docs/<product>/`);
    }
  }

  const markdownLinkPattern = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(markdownLinkPattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    target = target.split(/\s+["']/)[0];

    if (/^(?:https?:|mailto:)/i.test(target) || target.startsWith('#')) continue;
    checkedLinks += 1;

    const line = source.slice(0, match.index).split('\n').length;
    if (/^file:/i.test(target)) {
      failures.push(`${repositoryPath}:${line}: machine-specific file:// links are not allowed`);
      continue;
    }
    if (target.startsWith('/')) {
      failures.push(`${repositoryPath}:${line}: use a repository-relative link instead of ${target}`);
      continue;
    }

    const pathOnly = target.split(/[?#]/, 1)[0];
    if (!pathOnly) continue;

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathOnly);
    } catch {
      failures.push(`${repositoryPath}:${line}: link contains invalid URI encoding: ${target}`);
      continue;
    }

    const resolvedTarget = resolve(dirname(absolutePath), decodedPath);
    if (!resolvedTarget.startsWith(`${projectRoot}${sep}`) && resolvedTarget !== projectRoot) {
      failures.push(`${repositoryPath}:${line}: link escapes the repository: ${target}`);
      continue;
    }

    try {
      await access(resolvedTarget);
    } catch {
      failures.push(`${repositoryPath}:${line}: broken local link: ${target}`);
    }
  }
}

const docsRoot = join(projectRoot, 'docs');
if (!markdownFiles.some((path) => relative(projectRoot, path).split(sep).join('/') === 'docs/README.md')) {
  failures.push('docs/README.md: required documentation index is missing');
}

for (const areaEntry of await readdir(docsRoot, { withFileTypes: true })) {
  if (!areaEntry.isDirectory()) continue;
  const documentationArea = areaEntry.name;
  const documentationDirectory = join(docsRoot, documentationArea);
  const indexPath = join(documentationDirectory, 'README.md');
  let documentationIndex;
  try {
    documentationIndex = await readFile(indexPath, 'utf8');
  } catch {
    failures.push(`docs/${documentationArea}/README.md: every documentation area requires an index`);
    continue;
  }
  for (const entry of await readdir(documentationDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'README.md' || extname(entry.name) !== '.md') continue;
    if (!documentationIndex.includes(`(${entry.name})`)) {
      failures.push(`docs/${documentationArea}/${entry.name}: add this document to docs/${documentationArea}/README.md`);
    }
  }
}

if (failures.length > 0) {
  console.error('Documentation contract failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation contract passed (${markdownFiles.length} files, ${checkedLinks} local links).`);
}
