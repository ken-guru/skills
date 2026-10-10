// Exercises reviewing-presentation's timing estimate through its command interface.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'reviewing-presentation.mjs');

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(' ');

function deckFolder({ notesWords, slides = 3, length }) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'reviewing-presentation-test-'));
  const body = Array.from({ length: slides }, (_, index) => `## Slide ${index + 1}\n\nPoint.\n\n<!--\n${words(notesWords)}\n-->\n`).join('\n---\n\n');
  writeFileSync(path.join(directory, 'deck.md'), `---\nmarp: true\ntitle: T\nlang: en\n---\n\n${body}`);
  if (length) writeFileSync(path.join(directory, 'brief.md'), `---\napproved: true\n---\n\n# Brief: T\n\n- Length: ${length}\n`);
  return directory;
}

test('timing estimates speaking time from the notes at about 130 words per minute', () => {
  const result = run(['timing', '--deck', deckFolder({ notesWords: 130, slides: 4 })]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /About 4(\.0)? minutes/);
  assert.match(result.out, /\| 2 \| Slide 2 \| 130 \| 1\.0 \|/);
});

test('timing warns when the talk runs over the Brief\'s length', () => {
  const result = run(['timing', '--deck', deckFolder({ notesWords: 260, slides: 4, length: '5 minutes, plus 2 for questions' })]);
  assert.equal(result.code, 1);
  assert.match(result.out, /runs about 3(\.0)? minutes over the 5 minutes in the Brief/);
});

test('timing flags slides with no notes', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'reviewing-presentation-test-'));
  writeFileSync(path.join(directory, 'deck.md'), '---\nmarp: true\n---\n\n## Only slide\n\nNo notes here.\n');
  const result = run(['timing', '--deck', directory]);
  assert.match(result.out, /Slide 1 has no speaker notes/);
});
