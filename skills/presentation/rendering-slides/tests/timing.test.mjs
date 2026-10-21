// The speaking-time estimate: the rate, the comparison with a length, and the Brief's Length line.

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseDeck } from '../scripts/deck.mjs';
import { briefLength, speakingTimeNotes } from '../scripts/timing.mjs';

// A one-slide deck whose notes are the given number of words.
const deckWithWords = (words) => parseDeck(`# One\n\n<!-- ${Array.from({ length: words }, () => 'word').join(' ')} -->\n`);

test('the estimate uses 130 words a minute and prints no comparison without a length', () => {
  assert.deepEqual(speakingTimeNotes(deckWithWords(260), null), [
    'About 2.0 minutes of speaking at 130 words per minute (260 words in the notes).',
  ]);
});

test('notes that run well over the length warn, with the difference', () => {
  const [, warning] = speakingTimeNotes(deckWithWords(780), 5);
  assert.match(warning, /^Warning: the talk runs about 1\.0 minutes over the 5-minute length/);
});

test('notes that run more than a minute short of the length warn', () => {
  const [, warning] = speakingTimeNotes(deckWithWords(260), 5);
  assert.match(warning, /^Warning: the talk runs about 3\.0 minutes short of the 5-minute length/);
});

test('notes near the length say so', () => {
  assert.deepEqual(speakingTimeNotes(deckWithWords(650), 5).slice(1), ['Fits the 5-minute length.']);
});

test('briefLength reads the Length line of brief.md, and is null without one', () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'rendering-slides-timing-'));
  assert.equal(briefLength(folder), null);
  writeFileSync(path.join(folder, 'brief.md'), '# Brief\n\n- Length: 7.5 minutes\n');
  assert.equal(briefLength(folder), 7.5);
});
