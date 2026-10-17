import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { checkRelease } from './check-pullground-release.mjs';
import { packPullground } from './pack-pullground.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { values } = parseArgs({ options: {
  tarball: { type: 'string' }, 'react-version': { type: 'string' },
  online: { type: 'boolean', default: false }, offline: { type: 'boolean', default: false },
} });
assert.ok(!(values.online && values.offline), 'Choose either --online or --offline');
if (values['react-version']) assert.match(values['react-version'], /^19\.\d+\.\d+$/, 'Use an exact React 19 version');
const tarball = values.tarball ? resolve(values.tarball) : await packPullground();
const bytes = await readFile(tarball);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const temporary = await mkdtemp(join(tmpdir(), 'pullground-package-'));
const run = (command, args, cwd = root, env = process.env) => execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const files = run('tar', ['-tzf', tarball]).trim().split('\n');
  assert.ok(files.every(file => /^package\/(dist\/|README\.md$|LICENSE$|package\.json$)/.test(file)
    && !file.split('/').includes('..')), 'Tarball contains only distributable files');
  const { manifest } = await checkRelease();
  const archivedManifest = JSON.parse(run('tar', ['-xOf', tarball, 'package/package.json']));
  assert.deepEqual(archivedManifest, manifest, 'The supplied archive must match the current release manifest');
  for (const required of ['dist/index.d.ts', 'dist/pullground.js', 'dist/pullground.cjs', 'dist/pullground.css', 'dist/style.d.ts', 'README.md', 'LICENSE']) {
    assert.ok(files.includes(`package/${required}`), `Missing ${required} from the archive`);
  }
  const consumer = join(temporary, 'consumer');
  await cp(join(root, 'examples/pullground-consumer'), consumer, { recursive: true, filter: source => !source.includes('/node_modules') && !source.includes('/dist') });
  // Compile the documentation actually shipped, rather than a separate copy of its examples.
  const readme = run('tar', ['-xOf', tarball, 'package/README.md']);
  const snippets = [...readme.matchAll(/^```tsx\s*\n([\s\S]*?)^```\s*$/gm)];
  assert.ok(snippets.length >= 6, 'The package README must include complete consumer examples');
  for (const [index, snippet] of snippets.entries()) {
    await writeFile(join(consumer, `readme-example-${index + 1}.tsx`), snippet[1]);
  }
  await build({ configFile: false, root, logLevel: 'warn', build: {
    ssr: join(root, 'src/pullground/react-example-source.ts'), outDir: join(temporary, 'examples'),
  } });
  const { createReactExample } = await import(pathToFileURL(join(temporary, 'examples/react-example-source.js')).href);
  for (const game of ['basketball', 'dart', 'bowling', 'stone']) {
    for (const theme of ['classic', 'simple', 'ocean', 'midnight']) {
      await writeFile(join(consumer, `${game}-${theme}.tsx`), createReactExample(game, theme));
    }
  }
  const dependencies = { '@johnson7543/pullground': `file:${tarball}` };
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    dependencies[name] = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  }
  if (values['react-version']) dependencies.react = dependencies['react-dom'] = values['react-version'];
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'isolated-pullground-consumer', private: true, type: 'module', dependencies }, null, 2));
  const cachePolicy = values.offline ? '--offline' : values.online ? '--prefer-online' : '--prefer-offline';
  run('npm', ['install', cachePolicy, '--ignore-scripts', '--no-audit', '--no-fund'], consumer);
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')]);
  console.log(`${snippets.length} packed README examples and all 16 demo game/theme examples typechecked.`);
  const imports = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    import * as pkg from '@johnson7543/pullground';
    const cjs = createRequire(import.meta.url)('@johnson7543/pullground');
    assert.deepEqual(Object.keys(pkg), ['Pullground']);
    assert.equal(typeof cjs.Pullground, 'function');
    for (const component of [pkg.Pullground, cjs.Pullground]) {
      const markup = renderToString(createElement('main', null,
        createElement(component, { onPull: async () => {} }, 'Server content'),
        createElement(component, { game: 'dart', theme: 'midnight', onPull: async () => {} }, 'Second instance'),
        createElement(component, { game: 'bowling', onPull: () => {} }, 'Third instance'),
        createElement(component, { game: 'stone', theme: 'ocean', onPull: () => {} }, 'Fourth instance')));
      assert.match(markup, /Server content/);
      assert.match(markup, /pullground-viewport/);
      assert.match(markup, /data-game="dart"/);
      assert.match(markup, /data-game="bowling"/);
      assert.match(markup, /data-game="stone"/);
      assert.match(markup, /data-theme="classic"/);
      assert.match(markup, /data-theme="midnight"/);
      assert.doesNotMatch(markup, /<button[\\s>]/, 'The component renders no built-in buttons');
      assert.equal(markup.split('<style ').length - 1, 1, 'SSR includes one shared stylesheet');
      assert.match(markup, /overscroll-behavior-y:contain/);
    }
    console.log('DOM-free ESM/CJS imports and styled SSR passed.');
  `;
  await writeFile(join(consumer, 'verify.mjs'), imports);
  console.log(run(process.execPath, ['verify.mjs'], consumer).trim());
  await build({ configFile: false, root: consumer, plugins: [react()], logLevel: 'warn' });
  await build({ configFile: false, root: consumer, plugins: [react()], logLevel: 'warn', build: { ssr: join(consumer, 'App.tsx'), outDir: 'server' } });
  const { default: Fixture } = await import(pathToFileURL(join(consumer, 'server/App.js')).href);
  // Use the consumer's React for rendering the consumer's bundle.
  const { createElement, StrictMode } = await import(pathToFileURL(join(consumer, 'node_modules/react/index.js')).href);
  const { renderToString } = await import(pathToFileURL(join(consumer, 'node_modules/react-dom/server.node.js')).href);
  const html = await readFile(join(consumer, 'dist/index.html'), 'utf8');
  await writeFile(join(consumer, 'dist/ssr.html'), html.replace('<div id="root"></div>', `<div id="root">${renderToString(createElement(StrictMode, null, createElement(Fixture)))}</div>`));
  console.log(run(process.execPath, [join(root, 'scripts/smoke-pullground.mjs')], root, {
    ...process.env, PULLGROUND_CONSUMER_DIST: join(consumer, 'dist'), PULLGROUND_SKIP_SITE: '1', PULLGROUND_SSR: '1',
  }).trim());
  const tree = JSON.parse(run('npm', ['ls', 'react', '--json'], consumer));
  assert.equal(tree.dependencies.react.version, dependencies.react);
  assert.equal(createHash('sha256').update(await readFile(tarball)).digest('hex'), sha256, 'The tested archive must remain unchanged');
  await writeFile(join(dirname(tarball), `consumer-react-${dependencies.react}.json`), `${JSON.stringify({
    status: 'passed', filename: basename(tarball), version: manifest.version, sha256,
    react: dependencies.react, readmeExamples: snippets.length, demoExamples: 16,
    checks: ['types', 'esm', 'commonjs', 'ssr', 'hydration', 'browser-interactions'],
    completedAt: new Date().toISOString(),
  }, null, 2)}\n`);
  console.log(`Packed consumer passed: ${basename(tarball)}, ${(bytes.length / 1024).toFixed(1)} KiB compressed; React ${dependencies.react}. Archive retained at ${tarball}.`);
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
