// Exercises drafting-slides' visuals plan through its command interface.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'drafting-slides.mjs');

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function deckFolder(deck, theme) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'drafting-slides-test-'));
  writeFileSync(path.join(directory, 'deck.md'), deck);
  if (theme) writeFileSync(path.join(directory, 'theme.css'), theme);
  return directory;
}

const DECK = `---
marp: true
theme: deck
title: Test
lang: en
---

# Title

---

<!-- _class: visual -->

## The request path

<!-- Visual intent: diagram showing that only cache misses reach the API -->

---

<!-- _class: split -->

## Growth

- Requests doubled

![Requests doubled](media/requests.svg)

<!-- Visual intent: chart of requests per quarter, Q4 highlighted -->

---

## Unplanned

![A photo](media/photo.png)
`;

test('plan lists every Visual Intent with its layout, slot, and media status', () => {
  const result = run(['plan', '--deck', deckFolder(DECK)]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /\| 2 \| The request path \| visual \| 1164x452 \| diagram showing that only cache misses reach the API \| to make \|/);
  assert.match(result.out, /\| 3 \| Growth \| split \| 520x504 \| chart of requests per quarter, Q4 highlighted \| media\/requests\.svg \|/);
});

test('plan flags a visual that has no Visual Intent', () => {
  const result = run(['plan', '--deck', deckFolder(DECK)]);
  assert.match(result.out, /Slide 4 shows media\/photo\.png without a Visual Intent/);
});

test('plan uses the slot sizes from the deck\'s theme when there is one', () => {
  const theme = ':root {\n  --slot-visual: 1000x400;\n  --slot-split: 500x480;\n  --slot-default: 1100x460;\n}\n';
  const result = run(['plan', '--deck', deckFolder(DECK, theme)]);
  assert.match(result.out, /\| 2 \| The request path \| visual \| 1000x400 \|/);
});

test('a deck with no visuals says so', () => {
  const result = run(['plan', '--deck', deckFolder('---\nmarp: true\n---\n\n# Only text\n')]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /No visuals are planned/);
});
