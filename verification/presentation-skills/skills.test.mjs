// Collection-level checks for the presentation skill set: the four Presentation
// suite members and the four general-purpose Standalone Skills.
// Run: node --test verification/presentation-skills/

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
    assert.ok(existsSync(path.join(directory, 'CHANGELOG.md')), `${name}: CHANGELOG.md missing`);
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

test('every copy of the shared tool-cache module is identical', () => {
  const copies = present.map((name) => path.join(skillDirectory(name), 'scripts', 'tools.mjs')).filter(existsSync);
  const texts = new Set(copies.map((file) => readFileSync(file, 'utf8')));
  assert.equal(texts.size, copies.length ? 1 : 0, `tools.mjs differs between: ${copies.map((file) => path.relative(root, file)).join(', ')}`);
});
