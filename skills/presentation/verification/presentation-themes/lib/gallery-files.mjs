import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveGallerySource } from './gallery-contract.mjs';
import { themeIds } from './theme-catalog.mjs';

export const galleryPortraitRelativePath =
  'skills/presentation/verification/presentation-themes/fixtures/gallery/media/collaboration-portrait.png';

export async function loadGallerySource({ repositoryDirectory }) {
  const relativePaths = [
    'skills/presentation/generate-slides/themes/catalog.json',
    ...themeIds.flatMap((theme) => [
      `skills/presentation/generate-slides/themes/${theme}/theme.json`,
      `skills/presentation/generate-slides/themes/${theme}/theme.css`,
    ]),
    'skills/presentation/generate-slides/scripts/semantic-markup.mjs',
    'skills/presentation/generate-slides/scripts/slide-composition.mjs',
    'skills/presentation/verification/presentation-themes/fixtures/capacity-deck.mjs',
    'skills/presentation/verification/presentation-themes/fixtures/gallery/AGENDA.md',
    'skills/presentation/verification/presentation-themes/fixtures/gallery/IMAGE_SPEC.md',
    'skills/presentation/verification/presentation-themes/lib/gallery-contract.mjs',
    'skills/presentation/verification/presentation-themes/lib/gallery-approval.mjs',
    'skills/presentation/verification/presentation-themes/lib/gallery-documentation.mjs',
    'skills/presentation/verification/presentation-themes/lib/gallery-markdown-preview.mjs',
    'skills/presentation/verification/presentation-themes/lib/gallery-review-matrix.mjs',
    'skills/presentation/verification/presentation-themes/lib/gallery-slide-acceptance.mjs',
    'skills/presentation/verification/presentation-themes/lib/gallery-files.mjs',
    'skills/presentation/verification/presentation-themes/scripts/generate-gallery-fixtures.mjs',
    'skills/presentation/verification/presentation-themes/scripts/render-gallery.mjs',
    'skills/presentation/verification/presentation-themes/scripts/check-gallery.mjs',
    'skills/presentation/verification/presentation-themes/scripts/approve-gallery.mjs',
    'skills/presentation/verification/presentation-themes/package.json',
    'skills/presentation/verification/presentation-themes/package-lock.json',
    galleryPortraitRelativePath,
  ];
  const sourceFiles = [];
  let sampleMediaPresent = true;
  let sampleMediaBytes;
  for (const relativePath of relativePaths) {
    try {
      const bytes = await readFile(path.join(repositoryDirectory, relativePath));
      sourceFiles.push({
        path: relativePath,
        bytes,
      });
      if (relativePath === galleryPortraitRelativePath) sampleMediaBytes = bytes;
    } catch (error) {
      if (relativePath === galleryPortraitRelativePath && error.code === 'ENOENT') {
        sampleMediaPresent = false;
        continue;
      }
      throw error;
    }
  }
  return resolveGallerySource({
    themes: themeIds,
    sourceFiles,
    sampleMediaPresent,
    sampleMediaBytes,
    fixtureVersion: 1,
  });
}

export function galleryPaths(suiteDirectory) {
  const repositoryDirectory = path.resolve(suiteDirectory, '../../../..');
  return {
    repositoryDirectory,
    generatedDirectory: path.join(suiteDirectory, '.generated/gallery'),
    reportsDirectory: path.join(suiteDirectory, 'reports/gallery'),
    assetsDirectory: path.join(
      repositoryDirectory,
      'skills/presentation/docs/assets/presentation-themes',
    ),
    galleryFixtureDirectory: path.join(suiteDirectory, 'fixtures/gallery'),
  };
}
