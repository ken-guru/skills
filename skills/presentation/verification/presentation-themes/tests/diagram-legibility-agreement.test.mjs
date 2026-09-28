// Effective Text Size is computed by two owners: Generate Diagrams' render
// command and presentation-validation's media.svg-legibility. Both must reach
// the same verdict for the same SVGs.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const presentation = path.resolve(here, '../../..');
const fixtures = path.resolve(here, '../fixtures/diagram-legibility');
const renderCommand = path.join(presentation, 'generate-diagrams/scripts/render-diagrams.mjs');
const stub = path.join(presentation, 'generate-diagrams/tests/fixtures/stub-d2.mjs');
const validator = path.join(presentation, 'presentation-validation/scripts/presentation-validation.mjs');

// Verdicts in the Editorial diagram media box (1126×252), worked by hand.
const expected = {
  'wide-16px.svg': 'fail', // 16 × min(1126/1800, 252/200) = 10.0
  'role-sized.svg': 'pass', // 24 × min(1126/900, 252/240) = 25.2
  'tall.svg': 'fail', // 28 × min(1126/300, 252/700) = 10.1
  'exact-threshold.svg': 'pass', // 20 × 1 = 20.0
  'just-under.svg': 'fail', // 19.9 × 1 = 19.9
  'attribute-font-size.svg': 'pass', // 12 × min(1126/600, 252/100) = 22.5
};

function exitCode(command, args, env = process.env) {
  return new Promise((resolve) => {
    execFile(process.execPath, [command, ...args], { env }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, output: `${stdout}${stderr}` }));
  });
}

async function project() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'legibility-agreement-'));
  await writeFile(path.join(directory, 'DISCOVERY.json'), JSON.stringify({ language: 'en', theme: { id: 'editorial' } }));
  await writeFile(path.join(directory, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  await cp(path.join(presentation, 'generate-slides/themes/editorial'), path.join(directory, 'themes/editorial'), { recursive: true });
  await writeFile(path.join(directory, 'themes/theme-lock.json'), JSON.stringify({ lockVersion: 1, id: 'editorial' }));
  await writeFile(path.join(directory, 'DIAGRAM_SPEC.md'), '## Slide 1 — Flow\n- **Filename:** `images/diagram.svg`\n- **D2 Source:**\n  ```d2\n  a -> b {class: flow}\n  ```\n');
  return directory;
}

async function stubBin() {
  const bin = await mkdtemp(path.join(os.tmpdir(), 'legibility-stub-bin-'));
  await writeFile(path.join(bin, 'd2'), `#!/bin/sh\nexec "${process.execPath}" "${stub}" "$@"\n`);
  await chmod(path.join(bin, 'd2'), 0o755);
  return bin;
}

for (const [fixture, verdict] of Object.entries(expected)) {
  test(`${fixture}: the render command and the validator both ${verdict}`, async () => {
    const bin = await stubBin();
    const rendering = await project();
    const rendered = await exitCode(renderCommand, [path.join(rendering, 'DIAGRAM_SPEC.md')], {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      STUB_D2_SVG: path.join(fixtures, fixture),
    });
    assert.equal(rendered.code === 0 ? 'pass' : 'fail', verdict, `render command: ${rendered.output}`);
    if (verdict === 'fail') assert.match(rendered.output, /Effective Text Size/);

    const validating = await project();
    await mkdir(path.join(validating, 'images'));
    await writeFile(path.join(validating, 'images/diagram.svg'), await readFile(path.join(fixtures, fixture)));
    const validated = await exitCode(validator, ['check', 'media', '--project-dir', validating, '--format', 'json']);
    const blocking = JSON.parse(validated.stdout).findings.filter((finding) => finding.check === 'media.svg-legibility' && finding.severity === 'blocking');
    assert.equal(blocking.length ? 'fail' : 'pass', verdict, `validator: ${JSON.stringify(blocking)}`);
  });
}
