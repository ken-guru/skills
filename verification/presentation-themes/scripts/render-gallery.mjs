import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { galleryPaths } from '../lib/gallery-files.mjs';
import { themeIds } from '../lib/theme-catalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const paths = galleryPaths(suiteDirectory);
const marpExecutable = process.env.PRESENTATION_THEME_MARP ?? 'marp';

function run(command, arguments_, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });
}

for (const id of themeIds) {
  const projectDirectory = path.join(paths.generatedDirectory, id);
  await run(
    marpExecutable,
    ['PRESENTASJON.md', '-o', 'PRESENTASJON.html'],
    projectDirectory,
  );
}

process.stdout.write(`Rendered ${themeIds.length} production gallery HTML decks.\n`);

