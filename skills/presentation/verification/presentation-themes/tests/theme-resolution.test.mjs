import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  resolveTheme,
  snapshotTheme,
} from '../../../generate-slides/scripts/theme-resolution.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const themesDirectory = path.resolve(here, '../../../generate-slides/themes');

test('a legacy project without theme state resolves Editorial without mutating state', async () => {
  const discovery = { topic: 'Legacy deck' };
  const before = structuredClone(discovery);

  const result = await resolveTheme({ discovery, themesDirectory });

  assert.equal(result.id, 'editorial');
  assert.equal(result.usedLegacyFallback, true);
  assert.deepEqual(discovery, before);
});

test('an unknown present theme identifier blocks and lists supported identifiers', async () => {
  await assert.rejects(
    resolveTheme({
      discovery: { theme: { id: 'midnight' } },
      themesDirectory,
    }),
    (error) => {
      assert.equal(error.code, 'UNKNOWN_THEME');
      assert.match(error.message, /midnight/);
      assert.deepEqual(error.supportedIds, ['editorial', 'signal', 'compact-signal', 'field-notes']);
      return true;
    },
  );
});

test('all bundled identifiers resolve complete compatible Theme Packages', async () => {
  const expected = [
    ['editorial', 'Editorial'],
    ['signal', 'Signal'],
    ['compact-signal', 'Compact Signal'],
    ['field-notes', 'Field Notes'],
  ];

  for (const [id, name] of expected) {
    const result = await resolveTheme({
      discovery: { theme: { id } },
      themesDirectory,
    });

    assert.equal(result.id, id);
    assert.equal(result.manifest.name, name);
    assert.equal(result.manifest.markupVersion, 1);
    assert.deepEqual(Object.keys(result.manifest.archetypes), [
      'title',
      'section',
      'text-only',
      'text-plus-image',
      'data',
      'diagram',
      'quotation',
    ]);
  }
});

const nodeRoles = ['base', 'emphasis', 'muted', 'risk', 'boundary'];
const edgeRoles = ['flow', 'optional-flow', 'risk-flow'];

test('every bundled theme declares the fixed Diagram Role set by palette key', async () => {
  for (const id of ['editorial', 'signal', 'compact-signal', 'field-notes']) {
    const { manifest } = await resolveTheme({ discovery: { theme: { id } }, themesDirectory });
    assert.deepEqual(Object.keys(manifest.diagramRoles).sort(), [...nodeRoles, ...edgeRoles].sort(), id);
    for (const [role, definition] of Object.entries(manifest.diagramRoles)) {
      const colorFields = nodeRoles.includes(role) ? ['fill', 'stroke', 'fontColor'] : ['stroke', 'fontColor'];
      for (const field of colorFields) assert.ok(definition[field] in manifest.palette, `${id} ${role}.${field}`);
      assert.ok(Number.isInteger(definition.fontSize) && definition.fontSize >= 20, `${id} ${role}.fontSize`);
      assert.equal(typeof definition.strokeDash, 'number', `${id} ${role}.strokeDash`);
    }
    const { mediaBox } = manifest.archetypes.diagram;
    assert.ok(mediaBox.width > 0 && mediaBox.width <= 1280 && mediaBox.height > 0 && mediaBox.height <= 720, `${id} diagram media box`);
  }
});

test('the theme schema requires Diagram Roles, role font sizes, and the diagram media box', async () => {
  const schema = JSON.parse(await readFile(path.join(themesDirectory, 'theme.schema.json'), 'utf8'));

  assert.ok(schema.required.includes('diagramRoles'));
  assert.deepEqual([...schema.properties.diagramRoles.required].sort(), [...nodeRoles, ...edgeRoles].sort());
  assert.ok(schema.$defs.diagramNodeRole.required.includes('fontSize'));
  assert.ok(schema.$defs.diagramEdgeRole.required.includes('fontSize'));
  assert.ok(schema.properties.archetypes.properties.diagram.required.includes('mediaBox'));
});

async function resolveWithEditedManifest(edit) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-diagram-roles-'));
  const copiedThemes = path.join(temporaryRoot, 'themes');
  await cp(themesDirectory, copiedThemes, { recursive: true });
  const manifestPath = path.join(copiedThemes, 'editorial', 'theme.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  edit(manifest);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return resolveTheme({ discovery: { theme: { id: 'editorial' } }, themesDirectory: copiedThemes });
}

for (const [name, edit, message] of [
  ['a missing Diagram Role', (manifest) => { delete manifest.diagramRoles['risk-flow']; }, /Diagram Role "risk-flow"/],
  ['missing Diagram Roles', (manifest) => { delete manifest.diagramRoles; }, /Diagram Roles/],
  ['a role naming an unknown palette key', (manifest) => { manifest.diagramRoles.base.fill = 'chartreuse'; }, /"base".*fill/],
  ['a role without a font size', (manifest) => { delete manifest.diagramRoles.flow.fontSize; }, /"flow".*fontSize/],
  ['a role written in D2 syntax', (manifest) => { manifest.diagramRoles.base.fill = '#ffffff'; }, /"base".*fill/],
  ['no diagram media box', (manifest) => { delete manifest.archetypes.diagram.mediaBox; }, /media box/],
  ['a diagram media box larger than the slide', (manifest) => { manifest.archetypes.diagram.mediaBox = { width: 1400, height: 300 }; }, /media box/],
]) {
  test(`an installed Theme Package with ${name} blocks resolution`, async () => {
    await assert.rejects(resolveWithEditedManifest(edit), (error) => {
      assert.equal(error.code, 'INVALID_THEME_PACKAGE');
      assert.match(error.message, message);
      return true;
    });
  });
}

test('a locked snapshot that predates Diagram Roles still resolves so it can be refreshed', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-pre-roles-'));
  const projectThemes = path.join(temporaryRoot, 'project-themes');
  const initial = await resolveTheme({ discovery: { theme: { id: 'editorial' } }, themesDirectory });
  const legacy = structuredClone(initial.manifest);
  delete legacy.diagramRoles;
  legacy.packageVersion = '1.0.0';
  const legacyPackage = path.join(temporaryRoot, 'legacy-editorial');
  await cp(initial.packageDirectory, legacyPackage, { recursive: true });
  await writeFile(path.join(legacyPackage, 'theme.json'), `${JSON.stringify(legacy, null, 2)}\n`);
  await snapshotTheme({ resolution: { ...initial, manifest: legacy, packageDirectory: legacyPackage }, projectThemesDirectory: projectThemes });

  const locked = await resolveTheme({ discovery: { theme: { id: 'editorial' } }, themesDirectory, projectThemesDirectory: projectThemes });

  assert.equal(locked.source, 'project-snapshot');
  assert.equal(locked.manifest.diagramRoles, undefined);
  assert.equal(locked.updateAvailable, true);
});

test('a catalog and manifest identifier mismatch blocks before resolution', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-resolution-'));
  const copiedThemes = path.join(temporaryRoot, 'themes');
  await cp(themesDirectory, copiedThemes, { recursive: true });

  const manifestPath = path.join(copiedThemes, 'editorial', 'theme.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.id = 'not-editorial';
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    resolveTheme({
      discovery: { theme: { id: 'editorial' } },
      themesDirectory: copiedThemes,
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_THEME_PACKAGE');
      assert.match(error.message, /catalog.*editorial.*not-editorial/i);
      return true;
    },
  );
});

test('a declared archetype without a stylesheet implementation blocks resolution', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-css-contract-'));
  const copiedThemes = path.join(temporaryRoot, 'themes');
  await cp(themesDirectory, copiedThemes, { recursive: true });

  const manifestPath = path.join(copiedThemes, 'editorial', 'theme.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.archetypes.title.class = 'archetype-missing';
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    resolveTheme({
      discovery: { theme: { id: 'editorial' } },
      themesDirectory: copiedThemes,
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_THEME_PACKAGE');
      assert.match(error.message, /archetype-missing/);
      return true;
    },
  );
});

test('an incomplete project snapshot blocks instead of being silently replaced', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-incomplete-lock-'));
  const projectThemes = path.join(temporaryRoot, 'project-themes');
  await cp(path.join(themesDirectory, 'editorial'), path.join(projectThemes, 'editorial'), {
    recursive: true,
  });

  await assert.rejects(
    resolveTheme({
      discovery: { theme: { id: 'editorial' } },
      themesDirectory,
      projectThemesDirectory: projectThemes,
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_THEME_PACKAGE');
      assert.match(error.message, /without.*theme-lock/i);
      return true;
    },
  );
});

test('a modified locked package fingerprint blocks resolution', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-damaged-lock-'));
  const projectThemes = path.join(temporaryRoot, 'project-themes');
  const initial = await resolveTheme({
    discovery: { theme: { id: 'signal' } },
    themesDirectory,
  });
  await snapshotTheme({ resolution: initial, projectThemesDirectory: projectThemes });
  await writeFile(path.join(projectThemes, 'signal', 'theme.css'), '/* modified */\n');

  await assert.rejects(
    resolveTheme({
      discovery: { theme: { id: 'signal' } },
      themesDirectory,
      projectThemesDirectory: projectThemes,
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_THEME_PACKAGE');
      assert.match(error.message, /modified file|does not declare/i);
      return true;
    },
  );
});

test('an unsupported Semantic Slide Markup version blocks resolution', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-markup-version-'));
  const copiedThemes = path.join(temporaryRoot, 'themes');
  await cp(themesDirectory, copiedThemes, { recursive: true });
  const manifestPath = path.join(copiedThemes, 'field-notes', 'theme.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.markupVersion = 2;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    resolveTheme({
      discovery: { theme: { id: 'field-notes' } },
      themesDirectory: copiedThemes,
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_THEME_PACKAGE');
      assert.match(error.message, /markup version 2/);
      return true;
    },
  );
});

test('a matching locked project snapshot wins over a newer installed package', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-snapshot-'));
  const installedThemes = path.join(temporaryRoot, 'installed-themes');
  const projectThemes = path.join(temporaryRoot, 'project-themes');
  await cp(themesDirectory, installedThemes, { recursive: true });

  const initial = await resolveTheme({
    discovery: { theme: { id: 'editorial' } },
    themesDirectory: installedThemes,
  });
  await snapshotTheme({ resolution: initial, projectThemesDirectory: projectThemes });

  const installedManifestPath = path.join(installedThemes, 'editorial', 'theme.json');
  const installedManifest = JSON.parse(await readFile(installedManifestPath, 'utf8'));
  installedManifest.packageVersion = '1.9.0';
  await writeFile(installedManifestPath, `${JSON.stringify(installedManifest, null, 2)}\n`);

  const locked = await resolveTheme({
    discovery: { theme: { id: 'editorial' } },
    themesDirectory: installedThemes,
    projectThemesDirectory: projectThemes,
  });

  assert.equal(locked.source, 'project-snapshot');
  assert.equal(locked.manifest.packageVersion, '1.1.0');
  assert.equal(locked.updateAvailable, true);
});

test('version comparison stops at the first differing segment', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'theme-version-'));
  const installedThemes = path.join(temporaryRoot, 'installed-themes');
  const projectThemes = path.join(temporaryRoot, 'project-themes');
  await cp(themesDirectory, installedThemes, { recursive: true });

  const installedManifestPath = path.join(installedThemes, 'editorial', 'theme.json');
  const installedManifest = JSON.parse(await readFile(installedManifestPath, 'utf8'));
  installedManifest.packageVersion = '1.2.0';
  await writeFile(installedManifestPath, `${JSON.stringify(installedManifest, null, 2)}\n`);
  const initial = await resolveTheme({
    discovery: { theme: { id: 'editorial' } },
    themesDirectory: installedThemes,
  });
  await snapshotTheme({ resolution: initial, projectThemesDirectory: projectThemes });

  installedManifest.packageVersion = '1.1.1';
  await writeFile(installedManifestPath, `${JSON.stringify(installedManifest, null, 2)}\n`);
  const locked = await resolveTheme({
    discovery: { theme: { id: 'editorial' } },
    themesDirectory: installedThemes,
    projectThemesDirectory: projectThemes,
  });

  assert.equal(locked.updateAvailable, false);
});
