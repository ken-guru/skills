// Tests the Collection release-unit check only through its command line,
// against throwaway repositories built per test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script = path.resolve('scripts/release-units/check-release-units.mjs');
const blob = 'https://github.com/ken-guru/skills/blob/main';

async function repo(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-units-'));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

function check(root, ...args) {
  const result = spawnSync(process.execPath, [script, '--root', root, ...args], { encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
}

function skill(name, metadataLines) {
  return ['---', `name: ${name}`, `description: "Load when testing ${name}."`, ...metadataLines, '---', '', 'Body.', ''].join('\n');
}

function versioned(name, version, unitPath = `skills/${name}`) {
  return skill(name, [
    'metadata:',
    `  version: "${version}" # x-release-please-version`,
    `  changelog: "${blob}/${unitPath}/CHANGELOG.md"`,
  ]);
}

function standalone(name, { manifestVersion = '1.0.0', skillMd } = {}) {
  return {
    'release-please-config.json': { packages: { [`skills/${name}`]: { component: name, 'extra-files': ['SKILL.md'] } } },
    '.release-please-manifest.json': { [`skills/${name}`]: manifestVersion },
    [`skills/${name}/SKILL.md`]: skillMd ?? versioned(name, '1.0.0'),
    [`skills/${name}/CHANGELOG.md`]: '# Changelog\n',
  };
}

test('this repository passes', () => {
  const result = check(path.resolve('.'));
  assert.equal(result.status, 0, result.output);
});

test('a consistent Standalone Skill passes', async () => {
  const result = check(await repo(standalone('unslop')));
  assert.equal(result.status, 0, result.output);
});

test('a SKILL.md version that disagrees with the manifest fails, naming the file and both versions', async () => {
  const result = check(await repo(standalone('unslop', { skillMd: versioned('unslop', '1.0.1') })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md/);
  assert.match(result.output, /1\.0\.1/);
  assert.match(result.output, /1\.0\.0/);
});

test('an unquoted metadata value fails, because Antigravity drops a Skill whose metadata value is not a string', async () => {
  const skillMd = skill('unslop', ['metadata:', '  version: 1.0.0 # x-release-please-version', `  changelog: "${blob}/skills/unslop/CHANGELOG.md"`]);
  const result = check(await repo(standalone('unslop', { skillMd })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md: metadata\.version must be a quoted string/);
});

test('a metadata value that is not a map fails', async () => {
  const skillMd = skill('unslop', ['metadata: "1.0.0" # x-release-please-version']);
  const result = check(await repo(standalone('unslop', { skillMd })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md: metadata must be a map/);
});

test('a nested metadata value fails, because Codex and Antigravity only accept a flat map of strings', async () => {
  const skillMd = skill('unslop', [
    'metadata:',
    '  version: "1.0.0" # x-release-please-version',
    '  build:',
    '    major: "1"',
    `  changelog: "${blob}/skills/unslop/CHANGELOG.md"`,
  ]);
  const result = check(await repo(standalone('unslop', { skillMd })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md: metadata must be a flat map of strings/);
});

test('a metadata.version without the release annotation fails, because release-please would never bump it', async () => {
  const skillMd = skill('unslop', ['metadata:', '  version: "1.0.0"', `  changelog: "${blob}/skills/unslop/CHANGELOG.md"`]);
  const result = check(await repo(standalone('unslop', { skillMd })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md: metadata\.version must carry the x-release-please-version annotation/);
});

test('a metadata.changelog pointing at another unit\'s changelog fails', async () => {
  const result = check(await repo(standalone('unslop', { skillMd: versioned('unslop', '1.0.0', 'skills/presentation') })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md: metadata\.changelog must be "https:\/\/github\.com\/ken-guru\/skills\/blob\/main\/skills\/unslop\/CHANGELOG\.md"/);
});

test('a unit without a CHANGELOG.md fails', async () => {
  const files = standalone('unslop');
  delete files['skills/unslop/CHANGELOG.md'];
  const result = check(await repo(files));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/CHANGELOG\.md: missing/);
});

test('a SKILL.md missing from its unit\'s extra-files fails, because release-please would never bump it', async () => {
  const files = standalone('unslop');
  files['release-please-config.json'].packages['skills/unslop']['extra-files'] = [];
  const result = check(await repo(files));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop\/SKILL\.md: not listed in extra-files for skills\/unslop/);
});
