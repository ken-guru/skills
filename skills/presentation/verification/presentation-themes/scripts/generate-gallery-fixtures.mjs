import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareThemeProject } from '../../../generate-slides/scripts/prepare-theme.mjs';
import { capacityDeck } from '../fixtures/capacity-deck.mjs';
import { galleryPaths, loadGallerySource } from '../lib/gallery-files.mjs';
import { themeIds } from '../lib/theme-catalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const paths = galleryPaths(suiteDirectory);
const source = await loadGallerySource({
  repositoryDirectory: paths.repositoryDirectory,
});
const themesDirectory = path.join(
  paths.repositoryDirectory,
  'skills/presentation/generate-slides/themes',
);
const commonMediaDirectory = path.join(suiteDirectory, 'fixtures/media');
const portraitSource = path.join(
  paths.galleryFixtureDirectory,
  'media/collaboration-portrait.png',
);

await rm(paths.generatedDirectory, { recursive: true, force: true });
await mkdir(paths.generatedDirectory, { recursive: true });

for (const id of themeIds) {
  const projectDirectory = path.join(paths.generatedDirectory, id);
  await mkdir(projectDirectory, { recursive: true });
  await writeFile(
    path.join(projectDirectory, 'DISCOVERY.json'),
    `${JSON.stringify({ language: 'en', theme: { id, fontOverride: null } }, null, 2)}\n`,
  );
  const prepared = await prepareThemeProject({ projectDirectory, themesDirectory });
  await cp(commonMediaDirectory, path.join(projectDirectory, 'media'), { recursive: true });
  await cp(portraitSource, path.join(projectDirectory, 'media/collaboration-portrait.png'));
  await cp(
    path.join(paths.galleryFixtureDirectory, 'AGENDA.md'),
    path.join(projectDirectory, 'AGENDA.md'),
  );
  await cp(
    path.join(paths.galleryFixtureDirectory, 'IMAGE_SPEC.md'),
    path.join(projectDirectory, 'IMAGE_SPEC.md'),
  );
  await cp(
    path.join(suiteDirectory, 'fixtures/project/DIAGRAM_SPEC.template.md'),
    path.join(projectDirectory, 'DIAGRAM_SPEC.md'),
  );
  await writeFile(
    path.join(projectDirectory, 'PROJECT.json'),
    `${JSON.stringify({
      projectType: 'presentation-gallery-fixture',
      sourceFingerprint: source.sourceFingerprint,
      phases: {
        discovery: { status: 'done', completedAt: 'fixture' },
        structure: { status: 'done', completedAt: 'fixture' },
        generation: { status: 'pending', completedAt: null },
        images: { status: 'done', completedAt: 'fixture' },
        diagrams: { status: 'done', completedAt: 'fixture' },
        proofread: { status: 'pending', completedAt: null },
      },
    }, null, 2)}\n`,
  );
  await writeFile(
    path.join(projectDirectory, 'PRESENTASJON.md'),
    capacityDeck(id, prepared.manifest, {
      portraitFilename: 'media/collaboration-portrait.png',
      portraitAlt: 'Two collaborators shaping a shared physical model together in a bright studio',
    }),
  );
}

process.stdout.write(
  `Generated ${themeIds.length} gallery fixtures at source ${source.sourceFingerprint.slice(0, 12)}.\n`,
);
