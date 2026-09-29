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

function suite(name, members, { manifestVersion = '2.0.0', pluginVersion = '2.0.0', memberVersions = {} } = {}) {
  const unit = `skills/${name}`;
  const files = {
    'release-please-config.json': {
      packages: {
        [unit]: {
          component: name,
          'extra-files': [...members.map((member) => `${member}/SKILL.md`), { type: 'json', path: '/.claude-plugin/plugin.json', jsonpath: '$.version' }],
        },
      },
    },
    '.release-please-manifest.json': { [unit]: manifestVersion },
    '.claude-plugin/plugin.json': { name: `${name}-skills`, version: pluginVersion },
    [`${unit}/README.md`]: `# ${name}\n`,
    [`${unit}/CHANGELOG.md`]: '# Changelog\n',
  };
  for (const member of members) files[`${unit}/${member}/SKILL.md`] = versioned(member, memberVersions[member] ?? manifestVersion, unit);
  return files;
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

test('a consistent Skill Suite with a plugin manifest passes', async () => {
  const result = check(await repo(suite('presentation', ['build', 'proofread'])));
  assert.equal(result.status, 0, result.output);
});

test('a plugin manifest version that disagrees with its suite fails, naming the manifest', async () => {
  const result = check(await repo(suite('presentation', ['build', 'proofread'], { pluginVersion: '1.1.0' })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /\.claude-plugin\/plugin\.json: version 1\.1\.0 does not match the manifest's 2\.0\.0 for skills\/presentation/);
});

test('one suite member whose version disagrees fails, naming only that member', async () => {
  const result = check(await repo(suite('presentation', ['build', 'proofread'], { memberVersions: { proofread: '1.9.0' } })));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/presentation\/proofread\/SKILL\.md: version 1\.9\.0/);
  assert.doesNotMatch(result.output, /build\/SKILL\.md/);
});

test('an unregistered Standalone Skill fails, naming it', async () => {
  const files = { ...standalone('unslop'), 'skills/newcomer/SKILL.md': skill('newcomer', []) };
  const result = check(await repo(files));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/newcomer: Standalone Skill is not registered in release-please-config\.json/);
});

test('an unregistered Skill Suite fails, naming the suite rather than its members', async () => {
  const files = { ...standalone('unslop'), 'skills/decks/README.md': '# Decks\n', 'skills/decks/outline/SKILL.md': skill('outline', []) };
  const result = check(await repo(files));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/decks: Skill Suite is not registered in release-please-config\.json/);
  assert.doesNotMatch(result.output, /skills\/decks\/outline:/);
});

test('a package registered in the config but missing from the manifest fails', async () => {
  const files = standalone('unslop');
  files['.release-please-manifest.json'] = {};
  const result = check(await repo(files));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/unslop: registered in release-please-config\.json but missing from \.release-please-manifest\.json/);
});

test('a manifest entry with no package in the config fails', async () => {
  const files = standalone('unslop');
  files['.release-please-manifest.json']['skills/gone'] = '1.0.0';
  const result = check(await repo(files));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /skills\/gone: listed in \.release-please-manifest\.json but not registered in release-please-config\.json/);
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
