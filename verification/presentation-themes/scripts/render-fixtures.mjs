import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { themeIds } from '../lib/theme-catalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedDirectory = path.resolve(scriptDirectory, '../.generated');
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
  const projectDirectory = path.join(generatedDirectory, id);
  await run(marpExecutable, ['PRESENTASJON.md', '-o', 'PRESENTASJON.html'], projectDirectory);
  await run(
    marpExecutable,
    ['PRESENTASJON.md', '--pdf', '-o', 'PRESENTASJON.pdf'],
    projectDirectory,
  );
  const projectPath = path.join(projectDirectory, 'PROJECT.json');
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  project.phases.generation = { status: 'done', completedAt: 'fixture-render' };
  await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`);
}
