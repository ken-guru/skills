import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { prepareThemeProject } from '../../../generate-slides/scripts/prepare-theme.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const themesDirectory = path.resolve(here, '../../../generate-slides/themes');

test('project generation prepares one locked theme for every Marp surface', async () => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'theme-project-'));
  await writeFile(
    path.join(projectDirectory, 'DISCOVERY.json'),
    `${JSON.stringify({ language: 'en', theme: { id: 'signal', fontOverride: null } })}\n`,
  );

  const result = await prepareThemeProject({ projectDirectory, themesDirectory });

  assert.deepEqual(result.frontMatter, {
    marp: true,
    theme: 'signal',
    size: '16:9',
    paginate: true,
    lang: 'en',
  });
  assert.match(
    await readFile(path.join(projectDirectory, '.marprc.yml'), 'utf8'),
    /themes\/signal\/theme\.css/,
  );
  assert.match(
    await readFile(path.join(projectDirectory, '.vscode', 'settings.json'), 'utf8'),
    /themes\/signal\/theme\.css/,
  );
  const lock = JSON.parse(
    await readFile(path.join(projectDirectory, 'themes', 'theme-lock.json'), 'utf8'),
  );
  assert.equal(lock.id, 'signal');
});

test('external font overrides preserve a quoted offline-safe fallback stack', async () => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'theme-font-project-'));
  await writeFile(
    path.join(projectDirectory, 'DISCOVERY.json'),
    `${JSON.stringify({
      language: 'en',
      theme: {
        id: 'field-notes',
        fontOverride: { family: 'Example Font', sourceUrl: null },
      },
    })}\n`,
  );

  const result = await prepareThemeProject({ projectDirectory, themesDirectory });

  assert.match(result.frontMatter.style, /"Example Font"/);
  assert.match(result.frontMatter.style, /"Trebuchet MS"/);
  assert.doesNotMatch(result.frontMatter.style, /@import/);
});

test('theme refresh blocks before writes without confirmed restart invalidation', async () => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'theme-refresh-project-'));
  await writeFile(
    path.join(projectDirectory, 'DISCOVERY.json'),
    `${JSON.stringify({ language: 'en', theme: { id: 'editorial', fontOverride: null } })}\n`,
  );

  await assert.rejects(
    prepareThemeProject({ projectDirectory, themesDirectory, refresh: true }),
    (error) => {
      assert.equal(error.code, 'REFRESH_CONFIRMATION_REQUIRED');
      return true;
    },
  );
  await assert.rejects(readFile(path.join(projectDirectory, '.marprc.yml'), 'utf8'), {
    code: 'ENOENT',
  });
});

test('a refresh confirmation cannot bypass Theme-only Restart Guard state', async () => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), 'theme-refresh-state-'));
  await writeFile(
    path.join(projectDirectory, 'DISCOVERY.json'),
    `${JSON.stringify({ language: 'en', theme: { id: 'editorial', fontOverride: null } })}\n`,
  );
  await writeFile(path.join(projectDirectory, 'AGENDA.md'), '# Preserved agenda\n');
  await writeFile(
    path.join(projectDirectory, 'PROJECT.json'),
    `${JSON.stringify({ phases: { generation: { status: 'done' } } })}\n`,
  );

  await assert.rejects(
    prepareThemeProject({
      projectDirectory,
      themesDirectory,
      refresh: true,
      refreshConfirmed: true,
    }),
    { code: 'REFRESH_STATE_NOT_INVALIDATED' },
  );
});
