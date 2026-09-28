// End-to-end tests against the real D2 binary. CI installs D2 0.7.1, pinned;
// locally the file skips when D2 is absent, and fails in CI if it is missing.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const script = path.resolve('skills/presentation/generate-diagrams/scripts/render-diagrams.mjs');
const installedThemes = path.resolve('skills/presentation/generate-slides/themes');
const d2Version = spawnSync('d2', ['--version'], { encoding: 'utf8' });
const d2Available = d2Version.status === 0;
if (process.env.CI && !d2Available) throw new Error('CI must install D2 0.7.1 before running the real-D2 render tests.');
const skip = d2Available ? false : 'd2 is not installed';

async function project(theme, entries) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'render-diagrams-d2-'));
  await writeFile(path.join(directory, 'DISCOVERY.json'), JSON.stringify({ theme: { id: theme } }));
  await writeFile(path.join(directory, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  await cp(path.join(installedThemes, theme), path.join(directory, 'themes', theme), { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(directory, 'themes', theme, 'theme.json'), 'utf8'));
  await writeFile(path.join(directory, 'themes', 'theme-lock.json'), JSON.stringify({ lockVersion: 1, id: theme, packageVersion: manifest.packageVersion, markupVersion: 1, files: {} }));
  const spec = entries.map(({ slide, d2 }) => [
    `## Slide ${slide} — Diagram ${slide}`,
    `- **Filename:** \`images/diagram-${slide}.svg\``,
    '- **D2 Source:**',
    '  ```d2',
    ...d2.split('\n').map((line) => `  ${line}`),
    '  ```',
  ].join('\n'));
  await writeFile(path.join(directory, 'DIAGRAM_SPEC.md'), `# Diagram Spec\n\n${spec.join('\n\n')}\n`);
  return { directory, manifest };
}

async function render(directory) {
  return run(process.execPath, [script, path.join(directory, 'DIAGRAM_SPEC.md')])
    .then(({ stdout, stderr }) => ({ code: 0, output: stdout + stderr }))
    .catch((error) => ({ code: error.code, output: `${error.stdout}${error.stderr}` }));
}

test('real D2 renders a clean spec to SVGs with a root viewBox', { skip }, async () => {
  assert.match(d2Version.stdout, /^0\.7\.1/, 'the render contract is pinned to D2 0.7.1');
  const { directory } = await project('editorial', [
    { slide: 1, d2: 'explore: Explore\nalign: Align\nexplore -> align: next' },
  ]);

  const result = await render(directory);

  assert.equal(result.code, 0, result.output);
  assert.deepEqual(await readdir(path.join(directory, 'images')), ['diagram-1.svg']);
  const svg = await readFile(path.join(directory, 'images', 'diagram-1.svg'), 'utf8');
  assert.match(svg, /^<\?xml[^>]*\?><svg\b[^>]*\sviewBox="0 0 \d+ \d+"/);
});
