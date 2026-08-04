import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir } from 'node:fs/promises';
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
