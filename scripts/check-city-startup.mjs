import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = resolve(process.argv[2] ?? join(root, 'packages/designqr/dist'));
const visited = new Set(), files = [];
async function visit(path) {
  if (visited.has(path)) return;
  visited.add(path);
  const source = await readFile(path, 'utf8');
  files.push({ file: path.slice(directory.length + 1), bytes: Buffer.byteLength(source), gzipBytes: gzipSync(source, { level: 9 }).length });
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) await visit(resolve(dirname(path), specifier.text));
  }
}
await visit(join(directory, 'designqr.js'));
const report = { entry: 'designqr.js', method: 'Static relative ESM import/export closure; gzip level 9 per file; external peers and dynamic imports excluded.',
  bytes: files.reduce((n, file) => n + file.bytes, 0), gzipBytes: files.reduce((n, file) => n + file.gzipBytes, 0), files };
console.log(JSON.stringify(report, null, 2));
if (process.env.DESIGNQR_STARTUP_REPORT) await writeFile(process.env.DESIGNQR_STARTUP_REPORT, JSON.stringify(report, null, 2) + '\n');
if (!process.env.DESIGNQR_STARTUP_MEASURE_ONLY) {
  assert.ok(report.gzipBytes <= 64 * 1024, `City startup regression: ${report.gzipBytes} gzip bytes exceeds the 64 KiB static package budget.`);
  assert.equal(files.some(file => /(?:Shibuya|Dotonbori|TokyoTower)Scene|(?:shibuya|dotonbori)-asset-data/.test(file.file)), false,
    'A City implementation or model is statically imported by the main entry.');
}
