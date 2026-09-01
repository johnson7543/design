import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTreeTheme, resolveTreeTheme } from 'designqr';
import { normalizeDesignQRConfig } from 'designqr/config';
import {
  createDesignQRAdvancedReactSnippet,
  createDesignQRThemeReactSnippet,
  getRecommendedDesignQRReactExample,
} from '../src/utils/integration.ts';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const inlineLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const examples = [
  {
    name: 'preset-url-logo',
    config: normalizeDesignQRConfig({
      value: 'https://design.example.com/winter-release',
      design: {
        type: 'tree',
        options: { shape: 'wide', seed: 0.73 },
      },
      theme: 'winter',
      view: 'qr',
      details: {
        title: 'Winter release',
        showValue: true,
        border: { padding: 24 },
      },
      interaction: {
        dragToRotate: false,
        tapToToggleView: false,
        autoRotate: true,
        autoRotateDirection: 'counterclockwise',
        transitionSpeed: 1.75,
        motionBlur: false,
      },
      logo: {
        src: 'https://assets.example.com/brand/tree-mark.png',
        alt: 'Tree mark',
        size: 0.14,
      },
      transparentBackground: true,
    }),
  },
  {
    name: 'custom-inline-logo',
    config: normalizeDesignQRConfig({
      value: 'https://design.example.com/spring-event',
      design: {
        type: 'tree',
        options: { shape: 'pine', seed: 0.31 },
      },
      theme: {
        foliageColor: '#F4B4CF',
        groundColor: '#F1CDBD',
        skyTop: '#F6E2D5',
        skyBottom: '#F0CCBD',
        particleType: 'sakura',
        particleAmount: 24,
      },
      view: 'qr',
      details: {
        title: 'Spring event',
        showValue: true,
        border: { padding: 20 },
      },
      interaction: {
        dragToRotate: false,
        tapToToggleView: false,
        autoRotate: true,
        autoRotateDirection: 'counterclockwise',
        transitionSpeed: 0.75,
        motionBlur: false,
      },
      logo: {
        src: inlineLogo,
        alt: 'Spring event mark',
        size: 0.12,
      },
      transparentBackground: true,
    }),
  },
];

assert.equal(
  getRecommendedDesignQRReactExample(normalizeDesignQRConfig({
    value: 'https://design.example.com/url-only',
  })),
  'simple',
  'A URL-only setup must recommend Simple.'
);

const advancedRecommendationInputs = [
  ['preset theme', { theme: 'summer' }],
  ['tree shape', { tree: { shape: 'wide' } }],
  ['tree seed', { tree: { seed: 0.72 } }],
  ['initial view', { view: 'qr' }],
  ['details title', { details: { title: 'Current setup' } }],
  ['visible value', { details: { showValue: true } }],
  ['detail border', { details: { border: { padding: 24 } } }],
  ['drag interaction', { interaction: { dragToRotate: false } }],
  ['tap interaction', { interaction: { tapToToggleView: false } }],
  ['automatic rotation', { interaction: { autoRotate: true } }],
  ['rotation direction', { interaction: { autoRotateDirection: 'counterclockwise' } }],
  ['transition speed', { interaction: { transitionSpeed: 1.5 } }],
  ['motion blur', { interaction: { motionBlur: false } }],
  ['logo', { logo: { src: '/brand.png' } }],
  ['transparent background', { transparentBackground: true }],
];

for (const [name, input] of advancedRecommendationInputs) {
  assert.equal(
    getRecommendedDesignQRReactExample(normalizeDesignQRConfig({
      value: 'https://design.example.com/configured',
      ...input,
    })),
    'advanced',
    `${name} must recommend Advanced.`
  );
}

assert.equal(
  getRecommendedDesignQRReactExample(normalizeDesignQRConfig({
    value: 'https://design.example.com/custom-theme',
    theme: createTreeTheme('spring'),
    view: 'qr',
    details: { title: 'Custom theme setup' },
  })),
  'theme',
  'An active custom theme must recommend Custom Theme over Advanced.'
);

function assertExecutableExample(source, name, config) {
  assert.doesNotMatch(source, /\bTODO\b/i, `${name} contains a TODO.`);
  assert.doesNotMatch(source, /\/logo\.webp\b/i, `${name} contains a placeholder logo path.`);
  assert.doesNotMatch(
    source,
    /\bclassName\s*=\s*(?:["']{2}|\{\s*(?:["']{2}|``)\s*\})/,
    `${name} contains an empty className.`
  );
  assert.doesNotMatch(
    source,
    /^\s*\/\/.*(?:controlled?\s+view|view\s+state)|\/\*[\s\S]*?(?:controlled?\s+view|view\s+state)[\s\S]*?\*\//im,
    `${name} leaves view behavior as comment-only guidance.`
  );

  assert.ok(source.includes(`shape: "${config.design.options.shape}"`), `${name} omits tree.shape.`);
  assert.ok(source.includes(`seed: ${config.design.options.seed}`), `${name} omits tree.seed.`);
  assert.ok(source.includes(config.details.title), `${name} omits details.title.`);
  assert.ok(source.includes('showValue: true'), `${name} omits details.showValue.`);
  assert.ok(source.includes(`padding: ${config.details.border.padding}`), `${name} omits border padding.`);
  assert.ok(source.includes('dragToRotate: false'), `${name} omits dragToRotate.`);
  assert.ok(source.includes('tapToToggleView: false'), `${name} omits tapToToggleView.`);
  assert.ok(source.includes('autoRotate: true'), `${name} omits autoRotate.`);
  assert.ok(
    source.includes('autoRotateDirection: "counterclockwise"'),
    `${name} omits autoRotateDirection.`
  );
  assert.ok(
    source.includes(`transitionSpeed: ${config.interaction.transitionSpeed}`),
    `${name} omits transitionSpeed.`
  );
  assert.ok(source.includes('motionBlur: false'), `${name} omits motionBlur.`);
  assert.ok(source.includes('transparentBackground={true}'), `${name} omits transparency.`);
  assert.ok(source.includes(config.logo.src), `${name} omits logo.src.`);
}

function formatSnippetValue(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(formatSnippetValue).join(', ')}]`;
  }
  return `{ ${Object.entries(value).map(
    ([key, child]) => `${key}: ${formatSnippetValue(child)}`
  ).join(', ')} }`;
}

const generatedFiles = [];
for (const example of examples) {
  const snippets = [
    {
      name: `${example.name}-advanced`,
      source: createDesignQRAdvancedReactSnippet(example.config),
    },
    {
      name: `${example.name}-custom-theme`,
      source: createDesignQRThemeReactSnippet(example.config),
    },
  ];

  for (const snippet of snippets) {
    assertExecutableExample(snippet.source, snippet.name, example.config);
    if (snippet.name.endsWith('-custom-theme')) {
      const resolvedTheme = resolveTreeTheme(example.config.theme);
      const basePreset = example.config.theme.type === 'preset'
        ? example.config.theme.preset
        : 'spring';
      assert.ok(
        snippet.source.includes(`createTreeTheme('${basePreset}', {`),
        `${snippet.name} does not use its current theme base.`
      );
      assert.deepEqual(
        createTreeTheme(basePreset, resolvedTheme),
        resolvedTheme,
        `${snippet.name} full parameters do not reproduce the current theme.`
      );
      for (const [parameter, value] of Object.entries(resolvedTheme)) {
        assert.ok(
          snippet.source.includes(`  ${parameter}: ${formatSnippetValue(value)},`),
          `${snippet.name} does not preserve current theme.${parameter}.`
        );
      }
    }
    generatedFiles.push(snippet);
  }
}

const customAdvanced = generatedFiles.find(({ name }) => name === 'custom-inline-logo-advanced');
assert.ok(customAdvanced, 'The custom Advanced example was not generated.');
assert.match(customAdvanced.source, /\btype TreeTheme\b/, 'Custom Advanced must import TreeTheme.');
assert.match(
  customAdvanced.source,
  /const currentTheme = \{[\s\S]*\} satisfies TreeTheme;/,
  'Custom Advanced must emit a typed, executable currentTheme declaration.'
);
assert.match(customAdvanced.source, /theme=\{currentTheme\}/, 'Custom Advanced must use currentTheme.');

for (const { name, source } of generatedFiles.filter(({ name }) => name.endsWith('-advanced'))) {
  assert.match(source, /useState<DesignQRView>/, `${name} must implement controlled view state.`);
  assert.match(source, /view=\{view\}/, `${name} must pass the controlled view.`);
  assert.match(source, /onViewChange=\{setView\}/, `${name} must handle package view changes.`);
  assert.match(source, /onClick=\{\(\) => setView\(/, `${name} must include a working view control.`);
}

const temporaryDirectory = await mkdtemp(join(repositoryRoot, '.designqr-react-snippets-'));
try {
  for (const { name, source } of generatedFiles) {
    await writeFile(join(temporaryDirectory, `${name}.tsx`), `${source}\n`, 'utf8');
  }

  const tsconfigPath = join(temporaryDirectory, 'tsconfig.json');
  await writeFile(tsconfigPath, `${JSON.stringify({
    compilerOptions: {
      target: 'ES2023',
      lib: ['ES2023', 'DOM'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      types: ['react', 'react-dom', 'vite/client'],
      strict: true,
      noEmit: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      allowArbitraryExtensions: true,
      verbatimModuleSyntax: true,
      moduleDetection: 'force',
      skipLibCheck: false,
    },
    include: ['./*.tsx'],
  }, null, 2)}\n`, 'utf8');

  const typescriptCli = join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  const result = spawnSync(process.execPath, [typescriptCli, '--project', tsconfigPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([
      'Generated DesignQR React snippets did not compile.',
      result.stdout.trim(),
      result.stderr.trim(),
    ].filter(Boolean).join('\n'));
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(`DesignQR React snippet contract passed (${generatedFiles.length} generated modules).`);
