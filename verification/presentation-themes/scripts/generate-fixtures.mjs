import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareThemeProject } from '../../../skills/generate-slides/scripts/prepare-theme.mjs';
import { capacityDeck } from '../fixtures/capacity-deck.mjs';
import { themeIds } from '../lib/theme-catalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = path.resolve(suiteDirectory, '../..');
const themesDirectory = path.join(repositoryDirectory, 'skills/generate-slides/themes');
const mediaDirectory = path.join(suiteDirectory, 'fixtures/media');
const projectFixtureDirectory = path.join(suiteDirectory, 'fixtures/project');
const generatedDirectory = path.join(suiteDirectory, '.generated');

await rm(generatedDirectory, { recursive: true, force: true });
await mkdir(generatedDirectory, { recursive: true });

for (const id of themeIds) {
  const projectDirectory = path.join(generatedDirectory, id);
  await mkdir(projectDirectory, { recursive: true });
  await writeFile(
    path.join(projectDirectory, 'DISCOVERY.json'),
    `${JSON.stringify({ language: 'en', theme: { id, fontOverride: null } }, null, 2)}\n`,
  );
  const prepared = await prepareThemeProject({ projectDirectory, themesDirectory });
  await cp(mediaDirectory, path.join(projectDirectory, 'media'), { recursive: true });
  await cp(
    path.join(projectFixtureDirectory, 'AGENDA.md'),
    path.join(projectDirectory, 'AGENDA.md'),
  );
  const imageSpec = (await readFile(
    path.join(projectFixtureDirectory, 'IMAGE_SPEC.template.md'),
    'utf8',
  )).replaceAll('{{PICTURE_TREATMENT}}', prepared.manifest.media.pictureTreatment);
  const diagramSpec = (await readFile(
    path.join(projectFixtureDirectory, 'DIAGRAM_SPEC.template.md'),
    'utf8',
  )).replaceAll('{{DIAGRAM_TREATMENT}}', prepared.manifest.media.diagramTreatment);
  await writeFile(path.join(projectDirectory, 'IMAGE_SPEC.md'), imageSpec);
  await writeFile(path.join(projectDirectory, 'DIAGRAM_SPEC.md'), diagramSpec);
  await writeFile(
    path.join(projectDirectory, 'PROJECT.json'),
    `${JSON.stringify({
      projectType: 'presentation',
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
  await writeFile(path.join(projectDirectory, 'PRESENTASJON.md'), capacityDeck(id, prepared.manifest));
}
