#!/usr/bin/env node
// reviewing-presentation: estimate a deck's speaking time from its notes.
//
//   node scripts/reviewing-presentation.mjs timing --deck <folder>
//
// Exit codes: 0 fits (or no length to compare); 1 runs over the Brief's length; 2 usage error.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDeck } from './deck.mjs';

// A comfortable presenting pace; a script read aloud runs about 120–150 words a minute.
const WORDS_PER_MINUTE = 130;

class UsageError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (command !== 'timing') throw new UsageError(`Unknown command "${command ?? ''}". Use timing.`);
  const index = rest.indexOf('--deck');
  const deck = index === -1 ? null : rest[index + 1];
  if (!deck) throw new UsageError('timing needs --deck <Deck Folder>.');
  return { deck: path.resolve(deck) };
}

function briefMinutes(folder) {
  const brief = path.join(folder, 'brief.md');
  if (!existsSync(brief)) return null;
  const line = readFileSync(brief, 'utf8').match(/^\s*-\s*Length:\s*(.+)$/im)?.[1];
  const minutes = line?.match(/(\d+(?:\.\d+)?)\s*min/i)?.[1];
  return minutes ? Number(minutes) : null;
}

const countWords = (text) => text.replace(/\[S\d+\]/g, '').split(/\s+/).filter((word) => /\w/.test(word)).length;

function timing({ deck: folder }) {
  const file = path.join(folder, 'deck.md');
  if (!existsSync(file)) throw new UsageError(`${file} not found.`);
  const deck = parseDeck(readFileSync(file, 'utf8'));
  let total = 0;
  const rows = [];
  const silent = [];
  for (const slide of deck.slides) {
    const words = countWords(slide.notes.join(' '));
    const minutes = words / WORDS_PER_MINUTE;
    total += minutes;
    rows.push(`| ${slide.number} | ${slide.heading ?? '(no heading)'} | ${words} | ${minutes.toFixed(1)} |`);
    if (!words) silent.push(slide.number);
  }
  console.log(`About ${total.toFixed(1)} minutes of speaking at ${WORDS_PER_MINUTE} words per minute (${deck.slides.length} slides).`);
  console.log('| Slide | Heading | Words in notes | Minutes |');
  console.log('| --- | --- | --- | --- |');
  for (const row of rows) console.log(row);
  for (const number of silent) console.log(`⚠️  Slide ${number} has no speaker notes, so its time is unknown.`);
  const target = briefMinutes(folder);
  if (target === null) {
    console.log('No length found in brief.md to compare with.');
    return 0;
  }
  const over = total - target;
  if (over > 0.5) {
    console.log(`❌ The talk runs about ${over.toFixed(1)} minutes over the ${target} minutes in the Brief. Cut or merge slides, or shorten the notes.`);
    return 1;
  }
  console.log(`✅ Fits the ${target} minutes in the Brief${over < -2 ? `, with about ${(-over).toFixed(1)} minutes to spare` : ''}.`);
  return 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = timing(parseArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`❌ ${error.message}\n`);
    process.exitCode = 2;
  }
}
