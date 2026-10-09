// Exercises rendering-slides through its command interface only.
// Rendering tests need Marp CLI and a browser: run `node scripts/rendering-slides.mjs setup`
// first. They are skipped, loudly, when the tools are missing.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'rendering-slides.mjs');
const fixtures = path.join(skill, 'tests', 'fixtures');

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 240_000 });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

// The PDF's raw bytes plus every inflatable stream, so markers inside
// compressed object streams are visible.
function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  const parts = [raw];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    try {
      parts.push(inflateSync(buffer.subarray(start, end)).toString('latin1'));
    } catch {
      // Not a Flate stream (fonts, images): nothing to search.
    }
  }
  return parts.join('\n');
}

function deckFolder(fixture = 'minimal') {
  const directory = path.join(mkdtempSync(path.join(os.tmpdir(), 'rendering-slides-test-')), 'deck');
  cpSync(path.join(fixtures, fixture), directory, { recursive: true });
  return directory;
}

function themed(fixture) {
  const directory = deckFolder(fixture);
  const result = run(['theme', '--deck', directory, '--name', 'editorial']);
  assert.equal(result.code, 0, result.out);
  return directory;
}

const hasTools = run(['setup', '--status']).code === 0;
const needsTools = { skip: hasTools ? false : 'Marp CLI or browser missing: run `node scripts/rendering-slides.mjs setup`' };

test('a render without the tools names the exact setup command', () => {
  const directory = themed();
  const empty = mkdtempSync(path.join(os.tmpdir(), 'rendering-slides-empty-'));
  const result = run(['render', '--deck', directory], { KEN_GURU_SKILLS_CACHE: empty, MARP_CLI_PATH: '', CHROME_PATH: '', PATH: path.dirname(process.execPath) });
  assert.equal(result.code, 2);
  assert.match(result.out, /node scripts\/rendering-slides\.mjs setup/);
});

test('theme copies a shipped theme into the Deck Folder under the stable name "deck"', () => {
  const directory = themed();
  const css = readFileSync(path.join(directory, 'theme.css'), 'utf8');
  assert.match(css, /\/\* @theme deck \*\//);
  assert.match(css, /--color-bg:\s*#eee8dc/);
  assert.doesNotMatch(css, /@theme editorial\b/);
});

test('theme-values reports the theme\'s colours, fonts, and slots as JSON', () => {
  const directory = themed();
  const result = run(['theme-values', '--deck', directory]);
  assert.equal(result.code, 0, result.out);
  const values = JSON.parse(result.out);
  assert.equal(values['--color-bg'], '#eee8dc');
  assert.match(values['--font-body'], /Arial/);
  assert.equal(values['--slot-visual'], '1164x452');
});

test('a deck without theme.css is told how to add one', () => {
  const directory = deckFolder();
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 2);
  assert.match(result.out, /theme --deck/);
});

test('render writes HTML, a tagged PDF with an outline, and a speaker-notes script', needsTools, () => {
  const directory = themed();
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 0, result.out);
  const dist = path.join(directory, 'dist');
  assert.match(readFileSync(path.join(dist, 'deck.html'), 'utf8'), /<html[^>]*lang="en"/);
  const pdf = readFileSync(path.join(dist, 'deck.pdf'));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  const text = pdfText(pdf);
  assert.match(text, /\/StructTreeRoot/);
  assert.match(text, /\/Outlines/);
  assert.match(text, /\/Lang\s*\(en\)/);
  const notes = readFileSync(path.join(dist, 'deck-notes.md'), 'utf8');
  assert.match(notes, /## 3\. Innovation tokens/);
  assert.match(notes, /Dan McKinley's framing/);
  assert.doesNotMatch(notes, /_class/);
  assert.doesNotMatch(notes, /Visual intent/);
});

test('a slide-picture PPTX and PNG images are made only on request, and labelled', needsTools, () => {
  const directory = themed();
  const result = run(['render', '--deck', directory, '--pptx', '--images']);
  assert.equal(result.code, 0, result.out);
  assert.ok(existsSync(path.join(directory, 'dist', 'deck.pptx')));
  assert.ok(readdirSync(path.join(directory, 'dist', 'slides')).filter((file) => file.endsWith('.png')).length === 4);
  assert.match(result.out, /neither editable nor accessible/);
});

test('a browser blocked by the macOS sandbox gets advice to allow that one command', needsTools, () => {
  const directory = themed();
  const fake = path.join(mkdtempSync(path.join(os.tmpdir(), 'fake-browser-')), 'chrome');
  writeFileSync(fake, '#!/bin/sh\necho "bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)" >&2\nexit 1\n');
  chmodSync(fake, 0o755);
  const result = run(['render', '--deck', directory], { CHROME_PATH: fake });
  assert.equal(result.code, 1);
  assert.match(result.out, /sandbox/i);
  assert.match(result.out, /outside the sandbox/);
});
