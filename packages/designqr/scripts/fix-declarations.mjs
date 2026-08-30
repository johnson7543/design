import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url));

async function rewriteDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteDirectory(path);
      return;
    }
    if (!entry.name.endsWith('.d.ts')) return;

    const source = await readFile(path, 'utf8');
    const rewritten = source.replace(
      /(['"])(\.\.?\/[^'"]+)\.tsx?\1/g,
      '$1$2.js$1'
    );
    if (rewritten !== source) await writeFile(path, rewritten);
  }));
}

await rewriteDirectory(distDirectory);
