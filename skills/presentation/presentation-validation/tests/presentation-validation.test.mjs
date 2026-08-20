import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const cli = path.resolve('skills/presentation/presentation-validation/scripts/presentation-validation.mjs');

async function fixture() {
  const project = await mkdtemp(path.join(os.tmpdir(), 'presentation-validation-'));
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify({
    language: 'en',
    theme: { id: 'editorial' },
    paths: { presentation: 'PRESENTASJON.md' },
  }));
  await writeFile(path.join(project, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  await writeFile(path.join(project, 'PRESENTASJON.md'), `---\nmarp: true\ntheme: editorial\nsize: 16:9\npaginate: true\nlang: en\n---\n<!-- _class: archetype-title variation-default tone-light -->\n<h1 class="slot-title">Hello</h1>\n`);
  return project;
}

test('reports the runtime version through the public CLI', async () => {
  const { stdout } = await run(process.execPath, [cli, '--version']);
  assert.equal(stdout.trim(), '1.0.0');
});

test('validates structure through JSON without mutating the Project Folder', async () => {
  const project = await fixture();
  const before = await readFile(path.join(project, 'PRESENTASJON.md'), 'utf8');
  const { stdout } = await run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.summary.blocking, 0);
  assert.ok(report.findings.some((finding) => finding.check === 'structure.slides'));
  assert.equal(await readFile(path.join(project, 'PRESENTASJON.md'), 'utf8'), before);
});

test('rejects report paths outside the Project Folder', async () => {
  const project = await fixture();
  await assert.rejects(
    run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--report', '../outside.json']),
    (error) => error.code === 2 && error.stderr.includes('--report must be inside'),
  );
});

test('returns configuration status for a missing Project Folder contract', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'presentation-validation-empty-'));
  await assert.rejects(
    run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--format', 'json']),
    (error) => error.code === 2 && JSON.parse(error.stdout).summary.blocking >= 1,
  );
});
