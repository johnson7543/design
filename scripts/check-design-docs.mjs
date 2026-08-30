import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const registryPath = join(projectRoot, 'docs', 'design-registry.json');
const globalColorRegistryPath = 'docs/design-system/colors.md';
const failures = [];

function repositoryPath(path) {
  return relative(projectRoot, path).split(sep).join('/');
}

function isSafeRepositoryPath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.startsWith('/')) return false;
  const resolved = resolve(projectRoot, path);
  return resolved === projectRoot || resolved.startsWith(`${projectRoot}${sep}`);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let registry;
try {
  registry = JSON.parse(await readFile(registryPath, 'utf8'));
} catch (error) {
  console.error(`Design documentation harness failed to read docs/design-registry.json: ${error.message}`);
  process.exit(1);
}

if (registry.version !== 1) {
  failures.push('docs/design-registry.json: version must be 1');
}
if (!Array.isArray(registry.designs) || registry.designs.length === 0) {
  failures.push('docs/design-registry.json: designs must contain at least one registered design');
}
if (!Array.isArray(registry.sharedSourcePaths)) {
  failures.push('docs/design-registry.json: sharedSourcePaths must be an array');
}

const docsIndex = await readFile(join(projectRoot, 'docs', 'README.md'), 'utf8');
const designIds = new Set();
const designNames = new Set();
const docsDirectories = new Set();
const registeredRoutes = new Set();
const ownedSourcePaths = new Map();
const requiredDocumentKeys = ['index', 'style', 'colors'];

for (const sharedSourcePath of registry.sharedSourcePaths ?? []) {
  if (!isSafeRepositoryPath(sharedSourcePath)) {
    failures.push(`docs/design-registry.json: invalid shared source path ${String(sharedSourcePath)}`);
    continue;
  }
  if (!await pathExists(join(projectRoot, sharedSourcePath))) {
    failures.push(`docs/design-registry.json: shared source path does not exist: ${sharedSourcePath}`);
  }
  ownedSourcePaths.set(sharedSourcePath, 'shared');
}

for (const design of registry.designs ?? []) {
  const label = design?.id || '<missing-id>';

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(design?.id ?? '')) {
    failures.push(`docs/design-registry.json: design id must use lowercase kebab-case: ${label}`);
  } else if (designIds.has(design.id)) {
    failures.push(`docs/design-registry.json: duplicate design id ${design.id}`);
  }
  designIds.add(design?.id);

  if (typeof design?.name !== 'string' || design.name.trim().length === 0) {
    failures.push(`docs/design-registry.json: ${label} must have a name`);
  } else if (designNames.has(design.name)) {
    failures.push(`docs/design-registry.json: duplicate design name ${design.name}`);
  }
  designNames.add(design?.name);

  const expectedDocsDirectory = `docs/${design?.id}`;
  if (design?.docsDirectory !== expectedDocsDirectory) {
    failures.push(`docs/design-registry.json: ${label} docsDirectory must be ${expectedDocsDirectory}`);
  }
  if (!isSafeRepositoryPath(design?.docsDirectory)) {
    failures.push(`docs/design-registry.json: ${label} has an invalid docsDirectory`);
    continue;
  }
  if (docsDirectories.has(design.docsDirectory)) {
    failures.push(`docs/design-registry.json: duplicate docsDirectory ${design.docsDirectory}`);
  }
  docsDirectories.add(design.docsDirectory);

  if (!docsIndex.includes(`(${design.docsDirectory.replace(/^docs\//, '')}/README.md)`)) {
    failures.push(`docs/README.md: link the ${label} design index`);
  }

  if (!Array.isArray(design.routes) || design.routes.length === 0) {
    failures.push(`docs/design-registry.json: ${label} must own at least one route`);
  }
  for (const route of design.routes ?? []) {
    if (typeof route !== 'string' || route.length === 0) {
      failures.push(`docs/design-registry.json: ${label} contains an invalid route`);
      continue;
    }
    if (registeredRoutes.has(route)) {
      failures.push(`docs/design-registry.json: route ${route} has more than one owner`);
    }
    registeredRoutes.add(route);
  }

  if (!Array.isArray(design.sourcePaths) || design.sourcePaths.length === 0) {
    failures.push(`docs/design-registry.json: ${label} must own at least one source path`);
  }
  for (const sourcePath of design.sourcePaths ?? []) {
    if (!isSafeRepositoryPath(sourcePath)) {
      failures.push(`docs/design-registry.json: ${label} has invalid source path ${String(sourcePath)}`);
      continue;
    }
    if (!await pathExists(join(projectRoot, sourcePath))) {
      failures.push(`docs/design-registry.json: ${label} source path does not exist: ${sourcePath}`);
    }
    if (ownedSourcePaths.has(sourcePath)) {
      failures.push(`docs/design-registry.json: source path ${sourcePath} is owned by both ${ownedSourcePaths.get(sourcePath)} and ${label}`);
    }
    ownedSourcePaths.set(sourcePath, label);
  }

  if (!design.documents || typeof design.documents !== 'object') {
    failures.push(`docs/design-registry.json: ${label} must define documents`);
    continue;
  }

  const loadedDocuments = new Map();
  for (const documentKey of requiredDocumentKeys) {
    const filename = design.documents[documentKey];
    if (typeof filename !== 'string' || filename.length === 0) {
      failures.push(`docs/design-registry.json: ${label} is missing documents.${documentKey}`);
      continue;
    }
    if (documentKey === 'index' ? filename !== 'README.md' : !/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(filename)) {
      failures.push(`docs/design-registry.json: ${label} has invalid documents.${documentKey}: ${filename}`);
      continue;
    }

    const absoluteDocumentPath = join(projectRoot, design.docsDirectory, filename);
    if (!await pathExists(absoluteDocumentPath)) {
      failures.push(`${repositoryPath(absoluteDocumentPath)}: required ${documentKey} document is missing`);
      continue;
    }
    loadedDocuments.set(documentKey, await readFile(absoluteDocumentPath, 'utf8'));
  }

  const designIndex = loadedDocuments.get('index') ?? '';
  for (const documentKey of ['style', 'colors']) {
    const filename = design.documents[documentKey];
    if (filename && !designIndex.includes(`(${filename})`)) {
      failures.push(`${design.docsDirectory}/README.md: link documents.${documentKey} (${filename})`);
    }

    const document = loadedDocuments.get(documentKey) ?? '';
    if (document && !/^Status:\s*\S+/m.test(document)) {
      failures.push(`${design.docsDirectory}/${filename}: add a Status field`);
    }
    if (document && !/^Scope:\s*\S+/m.test(document)) {
      failures.push(`${design.docsDirectory}/${filename}: add a Scope field`);
    }
  }

  const colorDocument = loadedDocuments.get('colors') ?? '';
  if (colorDocument && !colorDocument.includes('design-system/colors.md')) {
    failures.push(`${design.docsDirectory}/${design.documents.colors}: link the global color registry`);
  }
}

const routeSourcePath = join(projectRoot, 'src', 'platform', 'DesignPlatform.tsx');
const routeSource = await readFile(routeSourcePath, 'utf8');
const implementedRoutes = new Set(
  [...routeSource.matchAll(/<Route\b[^>]*\bpath\s*=\s*"([^"]+)"/g)].map((match) => match[1])
);
for (const route of implementedRoutes) {
  if (!registeredRoutes.has(route)) {
    failures.push(`docs/design-registry.json: implemented route ${route} has no design owner`);
  }
}
for (const route of registeredRoutes) {
  if (!implementedRoutes.has(route)) {
    failures.push(`docs/design-registry.json: registered route ${route} is not implemented in src/platform/DesignPlatform.tsx`);
  }
}

const reservedDocumentationAreas = new Set(['demo-videos', 'design-system']);
for (const entry of await readdir(join(projectRoot, 'docs'), { withFileTypes: true })) {
  if (!entry.isDirectory() || reservedDocumentationAreas.has(entry.name)) continue;
  const areaPath = join(projectRoot, 'docs', entry.name);
  const filenames = (await readdir(areaPath, { withFileTypes: true }))
    .filter((child) => child.isFile() && extname(child.name) === '.md')
    .map((child) => child.name);
  const looksLikeDesign = filenames.some((filename) =>
    filename === 'style-principles.md' || filename === 'color-mappings.md' || filename === 'color-palettes.md'
  );
  if (looksLikeDesign && !docsDirectories.has(`docs/${entry.name}`)) {
    failures.push(`docs/${entry.name}: design documentation is not registered in docs/design-registry.json`);
  }
}

const requiredHarnessFiles = [
  'skills/maintain-design-docs/SKILL.md',
  'skills/maintain-design-docs/assets/design-index.md.template',
  'skills/maintain-design-docs/assets/style-principles.md.template',
  'skills/maintain-design-docs/assets/color-mappings.md.template',
  globalColorRegistryPath,
];
for (const requiredHarnessFile of requiredHarnessFiles) {
  if (!await pathExists(join(projectRoot, requiredHarnessFile))) {
    failures.push(`${requiredHarnessFile}: required design documentation harness file is missing`);
  }
}

const agentInstructions = await readFile(join(projectRoot, 'AGENTS.md'), 'utf8');
if (!agentInstructions.includes('skills/maintain-design-docs/SKILL.md')) {
  failures.push('AGENTS.md: automatically trigger the maintain-design-docs skill for design work');
}

const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
if (packageJson.scripts?.['design-docs:check'] !== 'node scripts/check-design-docs.mjs') {
  failures.push('package.json: define the design-docs:check script');
}
if (!packageJson.scripts?.check?.includes('npm run design-docs:check')) {
  failures.push('package.json: include design-docs:check in the standard check pipeline');
}

if (failures.length > 0) {
  console.error('Design documentation harness failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Design documentation harness passed (${designIds.size} designs, ${registeredRoutes.size} routes, ${ownedSourcePaths.size} source owners).`);
}
