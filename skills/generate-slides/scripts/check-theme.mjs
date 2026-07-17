#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveTheme } from './theme-resolution.mjs';

async function main() {
  const projectArgument = process.argv
    .slice(2)
    .find((argument) => !argument.startsWith('--'));
  const projectDirectory = path.resolve(projectArgument ?? '.');
  const discovery = JSON.parse(
    await readFile(path.join(projectDirectory, 'DISCOVERY.json'), 'utf8'),
  );
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const themesDirectory = path.resolve(scriptDirectory, '../themes');
  const projectThemesDirectory = path.resolve(
    projectDirectory,
    discovery.paths?.themes ?? 'themes/',
  );
  const resolution = await resolveTheme({
    discovery,
    themesDirectory,
    projectThemesDirectory,
  });

  process.stdout.write(
    `${JSON.stringify({
      id: resolution.id,
      name: resolution.manifest.name,
      packageVersion: resolution.manifest.packageVersion,
      source: resolution.source,
      updateAvailable: resolution.updateAvailable,
      usedLegacyFallback: resolution.usedLegacyFallback,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.code ? `${error.code}: ` : ''}${error.message}\n`);
  process.exitCode = 1;
});
