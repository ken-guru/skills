// generate-slides' export records export-lock.json and presentation-validation
// reads it. This runs both, so the two Skills cannot drift apart on the format.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const repositoryDirectory = path.resolve(process.cwd(), '../../../..');
const suite = path.join(repositoryDirectory, 'skills/presentation');
const exportScript = path.join(suite, 'generate-slides/scripts/export-presentation.mjs');
const stubMarp = path.join(suite, 'generate-slides/tests/fixtures/stub-marp.mjs');
const validator = path.join(suite, 'presentation-validation/scripts/presentation-validation.mjs');

function exportDeck(project, bin) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [exportScript, project], { env: { PATH: bin } });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

async function freshness(project) {
  const { stdout } = await promisify(execFile)(process.execPath, [validator, 'check', 'exports', '--project-dir', project, '--profile', 'proofread', '--format', 'json'])
    .catch((error) => (error.code === 1 ? error : Promise.reject(error)));
  return JSON.parse(stdout).findings.filter((finding) => finding.check === 'exports.freshness');
}

test('validation trusts a fresh export and blocks once a diagram it embeds changes', async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'export-freshness-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const bin = path.join(workspace, 'bin');
  const project = path.join(workspace, 'deck');
  await mkdir(bin);
  await mkdir(path.join(project, 'images'), { recursive: true });
  await writeFile(path.join(bin, 'marp'), `#!/bin/sh\nexec "${process.execPath}" "${stubMarp}" "$@"\n`);
  await chmod(path.join(bin, 'marp'), 0o755);
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify({ paths: {} }));
  await writeFile(path.join(project, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  await writeFile(path.join(project, '.marprc.yml'), 'allowLocalFiles: true\n');
  await writeFile(path.join(project, 'images/flow.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text style="font-size:24px">Old</text></svg>');
  await writeFile(path.join(project, 'PRESENTASJON.md'), '---\nmarp: true\n---\n\n<img src="images/flow.svg" alt="Flow">\n');

  const exported = await exportDeck(project, bin);
  assert.equal(exported.code, 0, exported.output);
  assert.equal((await freshness(project))[0].severity, 'info');

  await writeFile(path.join(project, 'images/flow.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text style="font-size:24px">New</text></svg>');
  const [stale] = await freshness(project);
  assert.equal(stale.severity, 'blocking');
  assert.equal(stale.evidence, 'images/flow.svg');

  assert.equal((await exportDeck(project, bin)).code, 0);
  assert.equal((await freshness(project))[0].severity, 'info');
  assert.ok(JSON.parse(await readFile(path.join(project, 'export-lock.json'), 'utf8')).files['PRESENTASJON.md']);
});

test('media rendered after the export makes the export stale', async (t) => {
  // Generation exports before the Media Renderers run, so the first export
  // references diagrams that don't exist yet.
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'export-freshness-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const bin = path.join(workspace, 'bin');
  const project = path.join(workspace, 'deck');
  await mkdir(bin);
  await mkdir(path.join(project, 'images'), { recursive: true });
  await writeFile(path.join(bin, 'marp'), `#!/bin/sh\nexec "${process.execPath}" "${stubMarp}" "$@"\n`);
  await chmod(path.join(bin, 'marp'), 0o755);
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify({ paths: {} }));
  await writeFile(path.join(project, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  await writeFile(path.join(project, '.marprc.yml'), 'allowLocalFiles: true\n');
  await writeFile(path.join(project, 'PRESENTASJON.md'), '---\nmarp: true\n---\n\n<img src="images/flow.svg" alt="Flow">\n');

  assert.equal((await exportDeck(project, bin)).code, 0);
  assert.equal((await freshness(project))[0].severity, 'info');

  await writeFile(path.join(project, 'images/flow.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const [stale] = await freshness(project);
  assert.equal(stale.severity, 'blocking');
  assert.equal(stale.evidence, 'images/flow.svg');
  assert.match(stale.message, /images\/flow\.svg/);
});
