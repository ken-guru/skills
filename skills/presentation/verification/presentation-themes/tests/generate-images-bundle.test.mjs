import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
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

async function installSkill(labelPrefix) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), `${labelPrefix}-skill-`));
  const installedSkill = path.join(targetRoot, 'generate images');

  await cp(sourceSkill, installedSkill, {
    recursive: true,
    filter: (source) => path.basename(source) !== 'node_modules',
  });

  return installedSkill;
}

async function runScript({ installedSkill, projectDir, specPath, args = [], env = {} }) {
  return spawnSync(
    process.execPath,
    [path.join(installedSkill, 'scripts/generate-images.js'), specPath, ...args],
    {
      cwd: projectDir,
      encoding: 'utf8',
      env: { ...process.env, GEMINI_API_KEY: undefined, OPENAI_API_KEY: undefined, ...env },
    },
  );
}

test('installed generate-images bundle runs from an unrelated cwd without dependencies or writes', async () => {
  const installedSkill = await installSkill('presentation skill with spaces');
  const unrelatedCwd = await mkdtemp(path.join(os.tmpdir(), 'unrelated cwd-'));

  const before = await filesBelow(installedSkill);
  const missingSpec = path.join(unrelatedCwd, 'missing spec.md');
  const result = await runScript({
    installedSkill,
    projectDir: unrelatedCwd,
    specPath: missingSpec,
    env: { GEMINI_API_KEY: 'dummy-migration-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing spec\.md not found/);
  assert.doesNotMatch(result.stderr, /not installed/);
  assert.deepEqual(await filesBelow(installedSkill), before);
});

test('provider resolution errors when neither provider key is set', async () => {
  const installedSkill = await installSkill('neither-key');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'neither-key-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  const result = await runScript({ installedSkill, projectDir, specPath });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /No image provider configured — set GEMINI_API_KEY or OPENAI_API_KEY/);
});

test('--provider errors immediately when that provider\'s key is missing', async () => {
  const installedSkill = await installSkill('missing-provider-key');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'missing-provider-key-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    args: ['--provider=openai'],
    env: { GEMINI_API_KEY: 'dummy-gemini-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--provider=openai requires OPENAI_API_KEY to be set/);
});

test('--model errors when it does not belong to the resolved provider', async () => {
  const installedSkill = await installSkill('model-mismatch');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'model-mismatch-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    args: ['--model=gpt-image-2'],
    env: { GEMINI_API_KEY: 'dummy-gemini-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--model=gpt-image-2 is not a valid model for provider "gemini" — did you mean --provider=openai\?/);
});

test('auto-detection prefers Gemini when both keys are set and notes OpenAI is available', async () => {
  const installedSkill = await installSkill('both-keys');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'both-keys-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    env: { GEMINI_API_KEY: 'dummy-gemini-key', OPENAI_API_KEY: 'dummy-openai-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /IMAGE_SPEC\.md not found/);
  assert.match(result.stdout, /Both provider keys detected — using Gemini \(default\)\. Pass --provider=openai to use OpenAI instead\./);

  const projectState = JSON.parse(await readFile(path.join(projectDir, 'PROJECT.json'), 'utf8'));
  assert.equal(projectState.phases.images.provider, 'gemini');
  assert.equal(projectState.phases.images.providerSource, 'auto');
});

test('a flag-sourced persisted provider hard-errors when its key later goes missing', async () => {
  const installedSkill = await installSkill('flag-drift');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'flag-drift-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  await writeFile(
    path.join(projectDir, 'PROJECT.json'),
    JSON.stringify({ phases: { images: { provider: 'openai', providerSource: 'flag' } } }),
  );

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    env: { GEMINI_API_KEY: 'dummy-gemini-key' },
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Project is configured for provider "openai" \(see PROJECT\.json\) but OPENAI_API_KEY is not set\. Set it, or pass --provider=gemini to switch\./,
  );

  const projectState = JSON.parse(await readFile(path.join(projectDir, 'PROJECT.json'), 'utf8'));
  assert.equal(projectState.phases.images.provider, 'openai');
  assert.equal(projectState.phases.images.providerSource, 'flag');
});

test('an auto-sourced persisted provider re-resolves silently and notes the change', async () => {
  const installedSkill = await installSkill('auto-drift');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'auto-drift-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  await writeFile(
    path.join(projectDir, 'PROJECT.json'),
    JSON.stringify({ phases: { images: { provider: 'openai', providerSource: 'auto' } } }),
  );

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    env: { GEMINI_API_KEY: 'dummy-gemini-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /IMAGE_SPEC\.md not found/);
  assert.match(result.stdout, /Provider changed from openai to gemini since last run \(auto-detected — pass --provider to lock one in\)/);

  const projectState = JSON.parse(await readFile(path.join(projectDir, 'PROJECT.json'), 'utf8'));
  assert.equal(projectState.phases.images.provider, 'gemini');
  assert.equal(projectState.phases.images.providerSource, 'auto');
});

test('a flag-sourced persisted model is reused for the same provider without repeating --model', async () => {
  const installedSkill = await installSkill('model-reuse');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'model-reuse-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  await writeFile(
    path.join(projectDir, 'PROJECT.json'),
    JSON.stringify({
      phases: { images: { provider: 'openai', providerSource: 'flag', model: 'gpt-image-2', modelSource: 'flag' } },
    }),
  );

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    args: ['--provider=openai'],
    env: { OPENAI_API_KEY: 'dummy-openai-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /IMAGE_SPEC\.md not found/);

  const projectState = JSON.parse(await readFile(path.join(projectDir, 'PROJECT.json'), 'utf8'));
  assert.equal(projectState.phases.images.model, 'gpt-image-2');
  assert.equal(projectState.phases.images.modelSource, 'flag');
});

test('an unset --model falls back to the resolved provider\'s default when no flag-sourced model applies', async () => {
  const installedSkill = await installSkill('model-default');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'model-default-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    args: ['--provider=openai'],
    env: { OPENAI_API_KEY: 'dummy-openai-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /IMAGE_SPEC\.md not found/);

  const projectState = JSON.parse(await readFile(path.join(projectDir, 'PROJECT.json'), 'utf8'));
  assert.equal(projectState.phases.images.model, 'gpt-image-1-mini');
  assert.equal(projectState.phases.images.modelSource, 'default');
});

test('a flag-sourced persisted model does not carry over to a different provider', async () => {
  const installedSkill = await installSkill('model-provider-switch');
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'model-provider-switch-project-'));
  const specPath = path.join(projectDir, 'IMAGE_SPEC.md');

  await writeFile(
    path.join(projectDir, 'PROJECT.json'),
    JSON.stringify({
      phases: { images: { provider: 'openai', providerSource: 'flag', model: 'gpt-image-2', modelSource: 'flag' } },
    }),
  );

  const result = await runScript({
    installedSkill,
    projectDir,
    specPath,
    args: ['--provider=gemini'],
    env: { GEMINI_API_KEY: 'dummy-gemini-key' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /IMAGE_SPEC\.md not found/);

  const projectState = JSON.parse(await readFile(path.join(projectDir, 'PROJECT.json'), 'utf8'));
  assert.equal(projectState.phases.images.model, 'gemini-3.1-flash-image');
  assert.equal(projectState.phases.images.modelSource, 'default');
});
