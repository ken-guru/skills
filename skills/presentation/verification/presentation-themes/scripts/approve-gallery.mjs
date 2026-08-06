import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { approveGalleryAssets } from '../lib/gallery-approval.mjs';
import { galleryPaths, loadGallerySource } from '../lib/gallery-files.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const paths = galleryPaths(suiteDirectory);
const imageSpec = await readFile(
  path.join(paths.galleryFixtureDirectory, 'IMAGE_SPEC.md'),
  'utf8',
);
const field = (name) => imageSpec.match(new RegExp(`\\*\\*${name}:\\*\\* (.+)`))?.[1]?.trim();
const source = await loadGallerySource({
  repositoryDirectory: paths.repositoryDirectory,
});
const result = await approveGalleryAssets({
  approve: process.argv.includes('--approve'),
  reportDirectory: paths.reportsDirectory,
  assetsDirectory: paths.assetsDirectory,
  source,
  provenance: {
    provider: field('Generation provider'),
    model: field('Generation model'),
    approvedAt: field('Approval date'),
  },
});

for (const warning of result.warnings) process.stderr.write(`⚠️  ${warning}\n`);
process.stdout.write(`Approved ${result.approved} public gallery screenshots.\n`);
