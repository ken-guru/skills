import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { themeIds } from '../lib/theme-catalog.mjs';

if (!process.argv.includes('--approve')) {
  throw new Error(
    'Refusing to replace visual baselines without the explicit --approve flag.',
  );
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const reportsDirectory = path.join(suiteDirectory, 'reports');
const baselinesDirectory = path.join(suiteDirectory, 'baselines');
const baselineSuffix = /-(html|pdf)-slide-[1-8]\.png$/;
const files = (await readdir(reportsDirectory)).filter(
  (file) => themeIds.some((id) => file.startsWith(`${id}-`)) && baselineSuffix.test(file),
);

const expectedCount = themeIds.length * 2 * 8;
if (files.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} reviewed render images; found ${files.length}.`);
}

await mkdir(baselinesDirectory, { recursive: true });
const fingerprints = {};
for (const file of files.sort()) {
  const source = path.join(reportsDirectory, file);
  const destination = path.join(baselinesDirectory, file);
  await cp(source, destination);
  fingerprints[file] = createHash('sha256')
    .update(await readFile(destination))
    .digest('hex');
}

await writeFile(
  path.join(baselinesDirectory, 'baseline-manifest.json'),
  `${JSON.stringify({ baselineVersion: 1, files: fingerprints }, null, 2)}\n`,
);

process.stdout.write(`Approved ${expectedCount} HTML/PDF visual baselines.\n`);
