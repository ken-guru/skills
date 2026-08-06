import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), 'generate-images-bundle-'),
);
const rebuiltBundle = path.join(temporaryDirectory, 'generate-images.js');

await build({
  bundle: true,
  entryPoints: [path.join(scriptsDirectory, 'src/generate-images.js')],
  format: 'cjs',
  minify: true,
  outfile: rebuiltBundle,
  platform: 'node',
});

assert.deepEqual(
  await readFile(rebuiltBundle),
  await readFile(path.join(scriptsDirectory, 'generate-images.js')),
  'Committed generate-images.js differs from a clean rebuild. Run npm run build.',
);

console.log('generate-images bundle is reproducible.');
