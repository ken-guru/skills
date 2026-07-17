import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveGallerySource } from './gallery-contract.mjs';
import { themeIds } from './theme-catalog.mjs';

export const galleryPortraitRelativePath =
  'verification/presentation-themes/fixtures/gallery/media/collaboration-portrait.png';

export async function loadGallerySource({ repositoryDirectory, suiteDirectory }) {
  const relativePaths = [
    'skills/generate-slides/themes/catalog.json',
    ...themeIds.flatMap((theme) => [
      `skills/generate-slides/themes/${theme}/theme.json`,
      `skills/generate-slides/themes/${theme}/theme.css`,
    ]),
    'skills/generate-slides/scripts/semantic-markup.mjs',
    'skills/generate-slides/scripts/slide-composition.mjs',
    'verification/presentation-themes/fixtures/capacity-deck.mjs',
    'verification/presentation-themes/fixtures/gallery/AGENDA.md',
    'verification/presentation-themes/fixtures/gallery/IMAGE_SPEC.md',
    'verification/presentation-themes/lib/gallery-contract.mjs',
    'verification/presentation-themes/lib/gallery-files.mjs',
    'verification/presentation-themes/scripts/generate-gallery-fixtures.mjs',
    'verification/presentation-themes/scripts/render-gallery.mjs',
    'verification/presentation-themes/scripts/check-gallery.mjs',
    'verification/presentation-themes/scripts/approve-gallery.mjs',
    'verification/presentation-themes/package.json',
    'verification/presentation-themes/package-lock.json',
    galleryPortraitRelativePath,
  ];
  const sourceFiles = [];
  let sampleMediaPresent = true;
  for (const relativePath of relativePaths) {
    try {
      sourceFiles.push({
        path: relativePath,
        bytes: await readFile(path.join(repositoryDirectory, relativePath)),
      });
    } catch (error) {
      if (relativePath === galleryPortraitRelativePath && error.code === 'ENOENT') {
        sampleMediaPresent = false;
        continue;
      }
      throw error;
    }
  }
  return resolveGallerySource({ themes: themeIds, sourceFiles, sampleMediaPresent });
}

export function galleryPaths(suiteDirectory) {
  const repositoryDirectory = path.resolve(suiteDirectory, '../..');
  return {
    repositoryDirectory,
    generatedDirectory: path.join(suiteDirectory, '.generated/gallery'),
    reportsDirectory: path.join(suiteDirectory, 'reports/gallery'),
    assetsDirectory: path.join(repositoryDirectory, 'docs/assets/presentation-themes'),
    galleryFixtureDirectory: path.join(suiteDirectory, 'fixtures/gallery'),
  };
}
