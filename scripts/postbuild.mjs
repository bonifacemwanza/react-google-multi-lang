// Writes a tiny package.json into dist/cjs and dist/esm so Node resolves the
// right module system for each, regardless of the root package's "type".
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const variants = [
  ['dist/cjs/package.json', { type: 'commonjs' }],
  ['dist/esm/package.json', { type: 'module' }],
];

for (const [rel, contents] of variants) {
  const file = resolve(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(contents, null, 2) + '\n');
}

console.log('postbuild: wrote dist/{cjs,esm}/package.json');
