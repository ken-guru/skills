// Collection-level checks for the presentation skill set: the four Presentation
// suite members and the four general-purpose Standalone Skills.
// Run: node --test verification/presentation-skills/*.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STANDALONE = ['researching-sources', 'creating-diagrams', 'creating-charts', 'generating-images'];
const SUITE = ['planning-presentation', 'drafting-slides', 'rendering-slides', 'reviewing-presentation'];
const skillDirectory = (name) => (SUITE.includes(name) ? path.join(root, 'skills', 'presentation', name) : path.join(root, 'skills', name));
const present = [...STANDALONE, ...SUITE].filter((name) => existsSync(path.join(skillDirectory(name), 'SKILL.md')));

// The open Agent Skills format's frontmatter fields.
const OPEN_SPEC_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `${file} has no frontmatter`);
  const fields = {};
  let current = null;
  for (const line of match[1].split('\n')) {
    const top = line.match(/^([\w-]+):\s*(.*)$/);
    // A plain (unquoted) YAML scalar may not contain ": " or " #", nor start with an indicator character.
    if (top && top[2] && !/^["']/.test(top[2])) {
      assert.doesNotMatch(top[2], /: | #|^[-?:,[\]{}#&*!|>%@`]/, `${file}: "${top[1]}" must be quoted to be valid YAML`);
    }
    if (top) {
      current = top[1];
      fields[current] = top[2] === '' ? {} : top[2].replace(/^["']|["']$/g, '');
    } else {
      const nested = line.match(/^\s+([\w-]+):\s*(.*)$/);
      assert.ok(nested && typeof fields[current] === 'object', `${file}: unexpected frontmatter line "${line}"`);
      fields[current][nested[1]] = nested[2];
    }
  }
  return fields;
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      if (!['node_modules', 'tests'].includes(entry)) files.push(...markdownFiles(full));
    } else if (entry.endsWith('.md')) files.push(full);
  }
  return files;
}

test('at least one presentation skill is present', () => {
  assert.ok(present.length > 0);
});

for (const name of present) {
  const directory = skillDirectory(name);

  test(`${name}: frontmatter stays inside the open spec`, () => {
    const fields = frontmatter(path.join(directory, 'SKILL.md'));
    for (const key of Object.keys(fields)) assert.ok(OPEN_SPEC_FIELDS.includes(key), `${name}: "${key}" is not an open-spec field`);
    assert.equal(fields.name, name);
    assert.ok(fields.description && fields.description.length <= 1024, `${name}: description must be 1–1024 characters`);
    assert.doesNotMatch(fields.description, /<[^>]+>/, `${name}: description must not contain XML tags`);
    assert.match(fields.metadata?.version ?? '', /^"\d+\.\d+\.\d+"$/, `${name}: metadata.version must be a quoted X.Y.Z string`);
    assert.match(fields.metadata?.changelog ?? '', /^"https:\/\/github\.com\/ken-guru\/skills\/blob\/main\/.+CHANGELOG\.md"$/, `${name}: metadata.changelog must be a quoted main URL`);
    // A Release Unit keeps one CHANGELOG.md at its root: the suite's for suite members.
    const unitRoot = SUITE.includes(name) ? path.dirname(directory) : directory;
    assert.ok(existsSync(path.join(unitRoot, 'CHANGELOG.md')), `${name}: CHANGELOG.md missing at ${path.relative(root, unitRoot)}`);
    assert.ok(fields.metadata.changelog.includes(path.relative(root, path.join(unitRoot, 'CHANGELOG.md'))), `${name}: metadata.changelog must point at its Release Unit's CHANGELOG.md`);
    if (SUITE.includes(name)) assert.equal(fields.metadata.version, `"${JSON.parse(readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version}"`, `${name}: suite members carry the suite (plugin) version`);
  });

  test(`${name}: SKILL.md stays short and references stay one level deep`, () => {
    const skill = readFileSync(path.join(directory, 'SKILL.md'), 'utf8');
    assert.ok(skill.split('\n').length < 500, `${name}: SKILL.md must stay under 500 lines`);
    const references = path.join(directory, 'references');
    if (existsSync(references)) {
      for (const file of readdirSync(references).filter((entry) => entry.endsWith('.md'))) {
        const text = readFileSync(path.join(references, file), 'utf8');
        assert.doesNotMatch(text, /\]\((?!https?:|#)[^)]*references\//, `${name}/references/${file} links deeper into references/`);
        if (text.split('\n').length > 100) assert.match(text, /^## Contents/m, `${name}/references/${file} is over 100 lines and needs a table of contents`);
      }
    }
  });

  test(`${name}: commands keep the one-command shape and harness-neutral paths`, () => {
    for (const file of markdownFiles(directory)) {
      const text = readFileSync(file, 'utf8');
      const relative = path.relative(root, file);
      assert.doesNotMatch(text, /\$\{CLAUDE_SKILL_DIR\}|\$ARGUMENTS|!`/, `${relative}: harness-specific substitution`);
      for (const [, command] of text.matchAll(/`(node scripts\/[^`]*)`/g)) {
        assert.doesNotMatch(command, /&&|\|\||\$\(|<<|;/, `${relative}: "${command}" chains commands`);
      }
    }
  });
}

// Shared contracts are authored once in the suite's docs/ and copied into each
// suite skill that needs them at runtime.
for (const shared of ['accessibility-bar.md', 'deck-folder.md']) {
  test(`every copy of ${shared} matches the suite's docs/ original`, () => {
    const original = readFileSync(path.join(root, 'skills', 'presentation', 'docs', shared), 'utf8');
    for (const name of present.filter((skill) => SUITE.includes(skill))) {
      const copy = path.join(skillDirectory(name), 'references', shared);
      if (existsSync(copy)) assert.equal(readFileSync(copy, 'utf8'), original, `${path.relative(root, copy)} differs from skills/presentation/docs/${shared}`);
    }
  });
}

test('the plugin lists every presentation skill that exists, and nothing else', () => {
  const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  const listed = plugin.skills.map((entry) => path.resolve(root, entry));
  const expected = present.map(skillDirectory);
  assert.deepEqual([...listed].sort(), [...expected].sort());
  for (const directory of listed) assert.ok(existsSync(path.join(directory, 'SKILL.md')), `${path.relative(root, directory)} has no SKILL.md`);
});

test('the complete Deck Source example in drafting-slides passes rendering-slides\' check', { skip: !present.includes('drafting-slides') || !present.includes('rendering-slides') }, () => {
  const reference = readFileSync(path.join(skillDirectory('drafting-slides'), 'references', 'deck-source-format.md'), 'utf8');
  const example = reference.split('## A complete example')[1]?.match(/```markdown\n([\s\S]*?)\n```/)?.[1];
  assert.ok(example, 'deck-source-format.md has no complete example');
  const folder = mkdtempSync(path.join(tmpdir(), 'deck-example-'));
  writeFileSync(path.join(folder, 'deck.md'), `${example}\n`);
  const cli = path.join(skillDirectory('rendering-slides'), 'scripts', 'rendering-slides.mjs');
  const themed = spawnSync(process.execPath, [cli, 'theme', '--deck', folder, '--name', 'editorial'], { encoding: 'utf8' });
  assert.equal(themed.status, 0, themed.stderr);
  const checked = spawnSync(process.execPath, [cli, 'check', '--deck', folder], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `${checked.stdout}${checked.stderr}`);
});

// Shared modules are copied into each skill that runs them, so each installs alone.
for (const module of ['tools.mjs', 'deck.mjs']) {
  test(`every copy of the shared ${module} module is identical`, () => {
    const copies = present.map((name) => path.join(skillDirectory(name), 'scripts', module)).filter(existsSync);
    const texts = new Set(copies.map((file) => readFileSync(file, 'utf8')));
    assert.equal(texts.size, copies.length ? 1 : 0, `${module} differs between: ${copies.map((file) => path.relative(root, file)).join(', ')}`);
  });
}
