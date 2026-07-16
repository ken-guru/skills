#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveTheme, snapshotTheme } from './theme-resolution.mjs';

const genericFontFamilies = new Set([
  'cursive',
  'emoji',
  'fangsong',
  'fantasy',
  'math',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif',
]);

function cssFontStack(fonts) {
  return fonts
    .map((font) =>
      genericFontFamilies.has(font) || !font.includes(' ')
        ? font
        : `"${font.replaceAll('"', '\\"')}"`,
    )
    .join(', ');
}

function externalFontStyle(fontOverride, fallback) {
  if (!fontOverride) return undefined;
  const family = fontOverride.family.replaceAll('"', '\\"');
  const importRule = fontOverride.sourceUrl
    ? `@import url("${fontOverride.sourceUrl.replaceAll('"', '%22')}");\n`
    : '';
  return `${importRule}section { --presentation-font-override: "${family}", ${fallback}; }`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function assertRefreshInvalidated(projectDirectory, discovery) {
  const statePath = path.join(projectDirectory, 'PROJECT.json');
  let project;
  try {
    project = JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    project = null;
  }
  const pendingPhases = ['generation', 'images', 'diagrams', 'proofread'];
  const stalePaths = [
    discovery.paths?.imageSpec ?? 'IMAGE_SPEC.md',
    discovery.paths?.diagramSpec ?? 'DIAGRAM_SPEC.md',
    discovery.paths?.presentation ?? 'PRESENTASJON.md',
    discovery.paths?.html ?? 'PRESENTASJON.html',
    discovery.paths?.pdf ?? 'PRESENTASJON.pdf',
    discovery.paths?.themes ?? 'themes/',
    '.marprc.yml',
    '.vscode/settings.json',
  ];
  const agendaPath = discovery.paths?.agenda ?? 'AGENDA.md';
  const invalid =
    !project ||
    pendingPhases.some((phase) => project.phases?.[phase]?.status !== 'pending') ||
    !(await exists(path.join(projectDirectory, agendaPath))) ||
    (await Promise.all(stalePaths.map((file) => exists(path.join(projectDirectory, file))))).some(
      Boolean,
    );
  if (invalid) {
    const error = new Error(
      'Theme refresh confirmation is not backed by the required Theme-only Restart Guard state.',
    );
    error.code = 'REFRESH_STATE_NOT_INVALIDATED';
    throw error;
  }
}

export async function prepareThemeProject({
  projectDirectory,
  themesDirectory,
  refresh = false,
  refreshConfirmed = false,
}) {
  if (refresh && !refreshConfirmed) {
    const error = new Error(
      'Theme refresh requires confirmed restart invalidation before project files may change.',
    );
    error.code = 'REFRESH_CONFIRMATION_REQUIRED';
    throw error;
  }
  const discoveryPath = path.join(projectDirectory, 'DISCOVERY.json');
  const discovery = JSON.parse(await readFile(discoveryPath, 'utf8'));
  if (refresh) await assertRefreshInvalidated(projectDirectory, discovery);
  const configuredThemesPath = discovery.paths?.themes ?? 'themes/';
  const projectThemesDirectory = path.resolve(projectDirectory, configuredThemesPath);
  let resolution = await resolveTheme({
    discovery,
    themesDirectory,
    projectThemesDirectory: refresh ? undefined : projectThemesDirectory,
  });

  if (refresh || resolution.source !== 'project-snapshot') {
    await snapshotTheme({ resolution, projectThemesDirectory });
    resolution = await resolveTheme({
      discovery,
      themesDirectory,
      projectThemesDirectory,
    });
  }

  const relativeCss = path
    .relative(projectDirectory, path.join(resolution.packageDirectory, resolution.manifest.css))
    .split(path.sep)
    .join('/');

  await writeFile(
    path.join(projectDirectory, '.marprc.yml'),
    `allowLocalFiles: true\nhtml: true\nthemeSet:\n  - ./${relativeCss}\n`,
  );

  const vscodeDirectory = path.join(projectDirectory, '.vscode');
  await mkdir(vscodeDirectory, { recursive: true });
  await writeFile(
    path.join(vscodeDirectory, 'settings.json'),
    `${JSON.stringify({ 'markdown.marp.themes': [relativeCss] }, null, 2)}\n`,
  );

  const frontMatter = {
    marp: true,
    theme: resolution.id,
    size: '16:9',
    paginate: true,
    lang: discovery.language,
  };
  const style = externalFontStyle(
    discovery.theme?.fontOverride,
    cssFontStack(resolution.manifest.fonts.body),
  );
  if (style) frontMatter.style = style;

  return {
    ...resolution,
    frontMatter,
    relativeCss,
  };
}

async function main() {
  const projectArgument = process.argv
    .slice(2)
    .find((argument) => !argument.startsWith('--'));
  const projectDirectory = path.resolve(projectArgument ?? '.');
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const themesDirectory = path.resolve(scriptDirectory, '../themes');
  const result = await prepareThemeProject({
    projectDirectory,
    themesDirectory,
    refresh: process.argv.includes('--refresh'),
    refreshConfirmed: process.argv.includes('--confirm-refresh'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.code ? `${error.code}: ` : ''}${error.message}\n`);
    process.exitCode = 1;
  });
}
