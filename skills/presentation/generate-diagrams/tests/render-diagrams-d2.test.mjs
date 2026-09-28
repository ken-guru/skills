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

const roleClassedSpec = [
  'direction: right',
  'explore: Explore {class: emphasis}',
  'align: Align {class: base}',
  'risk: Drift {class: risk}',
  'explore -> align: next {class: flow}',
  'align -> risk: unchecked {class: risk-flow}',
].join('\n');

for (const theme of ['editorial', 'signal', 'compact-signal', 'field-notes']) {
  test(`real D2 renders a role-classed spec in ${theme}'s role colors`, { skip }, async () => {
    assert.match(d2Version.stdout, /^0\.7\.1/, 'the render contract is pinned to D2 0.7.1');
    const { directory, manifest } = await project(theme, [{ slide: 1, d2: roleClassedSpec }]);

    const result = await render(directory);

    assert.equal(result.code, 0, result.output);
    assert.deepEqual(await readdir(path.join(directory, 'images')), ['diagram-1.svg']);
    const svg = (await readFile(path.join(directory, 'images', 'diagram-1.svg'), 'utf8')).toLowerCase();
    assert.match(svg, /^<\?xml[^>]*\?><svg\b[^>]*\sviewbox="0 0 \d+ \d+"/);
    const roles = manifest.diagramRoles;
    for (const key of [roles.emphasis.fill, roles.base.stroke, roles.risk.fill, roles.flow.stroke, roles['risk-flow'].stroke]) {
      assert.ok(svg.includes(manifest.palette[key].toLowerCase()), `${theme}: ${key} ${manifest.palette[key]}`);
    }
    assert.ok(!svg.includes('#0d32b2'), `${theme}: D2's default blue leaked into the diagram`);
  });
}

test('real D2: a wide diagram with 16 px labels fails Effective Text Size in the Editorial slot', { skip }, async () => {
  const stages = ['Collect feedback', 'Triage requests', 'Draft proposal', 'Review with stakeholders', 'Revise the plan', 'Publish decision'];
  const d2 = ['direction: right', ...stages.map((stage, index) => `s${index}: ${stage}`), ...stages.slice(1).map((_, index) => `s${index} -> s${index + 1}`)].join('\n');
  const { directory } = await project('editorial', [{ slide: 3, d2 }]);

  const result = await render(directory);

  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /Slide 3\b[^\n]*Effective Text Size [\d.]+ px is below 20 px: smallest text 16 px × scale 0\.\d\d into the 1126×252 diagram slot/);
  assert.match(result.output, /wider than the slot; give every shape and connection a role class, shorten labels, use `direction: down`/);
  assert.deepEqual(await readdir(directory).then((entries) => entries.includes('images') ? readdir(path.join(directory, 'images')) : []), []);
});
