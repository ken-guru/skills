import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceSkill = path.resolve(here, '../../../generate-images');

async function filesBelow(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesBelow(path.join(directory, entry.name), relative));
    } else {
      files.push(relative);
    }
  }

  return files.sort();
}

test('installed generate-images bundle runs from an unrelated cwd without dependencies or writes', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'presentation skill with spaces-'));
  const installedSkill = path.join(targetRoot, 'generate images');
  const unrelatedCwd = await mkdtemp(path.join(os.tmpdir(), 'unrelated cwd-'));

  await cp(sourceSkill, installedSkill, {
    recursive: true,
    filter: (source) => path.basename(source) !== 'node_modules',
  });

  const before = await filesBelow(installedSkill);
  const missingSpec = path.join(unrelatedCwd, 'missing spec.md');
  const result = spawnSync(
    process.execPath,
    [path.join(installedSkill, 'scripts/generate-images.js'), missingSpec],
    {
      cwd: unrelatedCwd,
      encoding: 'utf8',
      env: { ...process.env, GEMINI_API_KEY: 'dummy-migration-key' },
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing spec\.md not found/);
  assert.doesNotMatch(result.stderr, /not installed/);
  assert.deepEqual(await filesBelow(installedSkill), before);
});

test('installed bundle supports an opt-in Atlas provider without retrying submission', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'presentation atlas skill-'));
  const installedSkill = path.join(targetRoot, 'generate images');
  const projectDir = path.join(targetRoot, 'project');
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');
  const preloadPath = path.join(targetRoot, 'atlas-fetch-mock.cjs');
  const submitCountPath = path.join(targetRoot, 'submit-count.txt');

  await cp(sourceSkill, installedSkill, {
    recursive: true,
    filter: (source) => path.basename(source) !== 'node_modules',
  });
  await mkdir(projectDir, { recursive: true });
  await writeFile(specPath, [
    '## Slide 1 — Atlas test',
    '**Filename:** `images/atlas.png`',
    '**Prompt suggestion:** "A clean presentation illustration"',
  ].join('\n'));
  await writeFile(preloadPath, `
const fs = require('node:fs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
let submitCount = 0;
process.on('exit', () => fs.writeFileSync(process.env.ATLAS_MOCK_SUBMIT_COUNT_FILE, String(submitCount)));
global.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  if (method === 'POST') {
    submitCount += 1;
    if (process.env.ATLAS_MOCK_SUBMIT_FAILURE === '1') {
      return new Response('unavailable', { status: 503 });
    }
    return Response.json({ code: 200, data: { id: 'prediction-1', status: 'created' } });
  }
  if (String(url).includes('/api/v1/model/result/')) {
    return Response.json({
      code: 200,
      data: { id: 'prediction-1', status: 'completed', outputs: ['https://example.test/atlas.png'] },
    });
  }
  if (String(url) === 'https://example.test/atlas.png') {
    return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
  }
  return new Response('not found', { status: 404 });
};
`);

  const command = [
    '-r',
    preloadPath,
    path.join(installedSkill, 'scripts/generate-images.js'),
    specPath,
    '--provider=atlas',
  ];
  const env = {
    ...process.env,
    ATLASCLOUD_API_KEY: 'dummy-atlas-key',
    ATLAS_MOCK_SUBMIT_COUNT_FILE: submitCountPath,
  };
  const result = spawnSync(process.execPath, command, { encoding: 'utf8', env });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Provider: atlas/);
  assert.equal(await readFile(submitCountPath, 'utf8'), '1');
  assert.deepEqual(
    await readFile(path.join(projectDir, 'images/atlas.png')),
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  );

  await writeFile(specPath, [
    '## Slide 2 — Failed Atlas test',
    '**Filename:** `images/failed.png`',
    '**Prompt suggestion:** "A request that must not be retried"',
  ].join('\n'));
  const failed = spawnSync(process.execPath, command, {
    encoding: 'utf8',
    env: { ...env, ATLAS_MOCK_SUBMIT_FAILURE: '1' },
  });

  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Atlas submission failed with HTTP 503/);
  assert.doesNotMatch(failed.stdout, /Saved:/);
  assert.equal(await readFile(submitCountPath, 'utf8'), '1');
});
