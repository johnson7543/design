import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const componentFiles = [
  'src/App.tsx',
  'src/components/ControlsOverlay.tsx',
  'src/components/CustomThemeModal.tsx',
  'src/components/FloatingFlatQRControls.tsx',
  'src/components/Header.tsx',
  'src/components/InteractiveCheckbox.tsx',
  'src/components/ShareModal.tsx',
  'packages/designqr/src/react/DesignQR.tsx',
  'packages/designqr/src/react/DesignQRCanvas.tsx',
];
const cssFiles = [
  'src/styles/design-tokens.css',
  'src/index.css',
  'src/platform.css',
  'packages/designqr/src/style.css',
];

const failures = [];
const componentSources = await Promise.all(
  componentFiles.map(async (path) => ({
    path,
    source: await readFile(join(projectRoot, path), 'utf8'),
  }))
);
const cssSources = await Promise.all(
  cssFiles.map((path) => readFile(join(projectRoot, path), 'utf8'))
);
const allCss = cssSources.join('\n');
const tokenCss = cssSources[0];
const componentCss = cssSources[1];

const styledClasses = new Set(
  [...allCss.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => match[1])
);

for (const { path, source } of componentSources) {
  const staticClassPattern = /className\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
  for (const match of source.matchAll(staticClassPattern)) {
    const classes = (match[1] ?? match[2]).split(/\s+/).filter(Boolean);
    for (const className of classes) {
      if (!styledClasses.has(className)) {
        failures.push(`${path}: .${className} has no CSS owner`);
      }
    }
  }

  const inlineStylePattern = /style=\{\{([\s\S]*?)\}\}/g;
  const staticLayoutProperty = /\b(?:alignItems|display|fontSize|gap|gridTemplateColumns|height|lineHeight|margin(?:Block|Bottom|Inline|Left|Right|Top)?|padding(?:Block|Bottom|Inline|Left|Right|Top)?|width)\s*:/;
  for (const match of source.matchAll(inlineStylePattern)) {
    if (staticLayoutProperty.test(match[1])) {
      const line = source.slice(0, match.index).split('\n').length;
      failures.push(`${path}:${line}: move static layout from style={{...}} into a named CSS class`);
    }
  }
}

const requiredTokens = [
  '--qr-accent',
  '--qr-border-default',
  '--qr-control-font-size',
  '--qr-control-gap',
  '--qr-control-height',
  '--qr-control-padding-inline',
  '--qr-drawer-gap',
  '--qr-drawer-padding-inline',
  '--qr-focus-color',
  '--qr-shadow-control',
  '--qr-surface-control',
  '--qr-transition-control',
];
for (const token of requiredTokens) {
  if (!tokenCss.includes(`${token}:`)) {
    failures.push(`src/styles/design-tokens.css: missing required token ${token}`);
  }
}

function exactRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(componentCss)?.[1] ?? '';
}

const sharedControlContracts = [
  ['.interactive-checkbox-chip', 'height: var(--qr-control-height)'],
  ['.season-chip', 'height: var(--qr-control-height)'],
  ['.drawer-icon-btn', 'height: var(--qr-control-height)'],
  ['.transition-speed-control', 'height: var(--qr-control-height)'],
  ['.share-icon-btn', 'height: var(--qr-control-height)'],
  ['.customizer-card', 'gap: var(--qr-drawer-gap)'],
  ['.season-tabs .add-theme-chip-compact', 'width: var(--qr-control-height)'],
];
for (const [selector, declaration] of sharedControlContracts) {
  const rule = exactRule(selector);
  if (!rule.includes(declaration)) {
    failures.push(`src/index.css: ${selector} must retain "${declaration}"`);
  }
}

if (failures.length > 0) {
  console.error('Design QR style contract failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Design QR style contract passed.');
}
