import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const libraryDirectory = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(
  libraryDirectory,
  '../../../skills/generate-slides/themes/catalog.json',
);

export const themeCatalog = JSON.parse(await readFile(catalogPath, 'utf8'));
export const themeIds = themeCatalog.themes.map((theme) => theme.id);
