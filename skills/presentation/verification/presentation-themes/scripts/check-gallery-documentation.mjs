import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateGalleryDocumentation } from '../lib/gallery-documentation.mjs';
import { galleryPaths, loadGallerySource } from '../lib/gallery-files.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const paths = galleryPaths(suiteDirectory);
const source = await loadGallerySource({
  repositoryDirectory: paths.repositoryDirectory,
});
const readme = await readFile(
  path.join(paths.repositoryDirectory, 'skills/presentation/README.md'),
  'utf8',
);
const gallery = await readFile(
  path.join(
    paths.repositoryDirectory,
    'skills/presentation/docs/presentation-themes.md',
  ),
  'utf8',
);
const existingPaths = new Set(
  (await readdir(paths.repositoryDirectory, { recursive: true })).map((entry) =>
    entry.split(path.sep).join('/'),
  ),
);
const issues = validateGalleryDocumentation({
  readme,
  gallery,
  expectedAssets: source.assets.map(({ filename }) => filename),
  existingPaths,
});

if (issues.length) {
  process.stderr.write(`${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Presentation theme gallery documentation passed fast validation.\n');
}
