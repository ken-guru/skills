#!/usr/bin/env node
// drafting-slides: list the visuals plan of a Deck Source for approval.
//
//   node scripts/drafting-slides.mjs plan --deck <folder>
//
// Exit codes: 0 success; 2 usage error.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDeck } from './deck.mjs';

// Editorial's slots on the 1280×720 reference, used when the deck has no theme.css yet.
const DEFAULT_SLOTS = { default: '1164x480', split: '520x504', visual: '1164x452' };

class UsageError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (command !== 'plan') throw new UsageError(`Unknown command "${command ?? ''}". Use plan.`);
  const index = rest.indexOf('--deck');
  const deck = index === -1 ? null : rest[index + 1];
  if (!deck) throw new UsageError('plan needs --deck <Deck Folder>.');
  return { command, deck: path.resolve(deck) };
}

function slots(folder) {
  const theme = path.join(folder, 'theme.css');
  if (!existsSync(theme)) return DEFAULT_SLOTS;
  const css = readFileSync(theme, 'utf8');
  const found = { ...DEFAULT_SLOTS };
  for (const name of Object.keys(DEFAULT_SLOTS)) {
    const value = css.match(new RegExp(`--slot-${name}\\s*:\\s*(\\d+x\\d+)`))?.[1];
    if (value) found[name] = value;
  }
  return found;
}

function plan({ deck: folder }) {
  const file = path.join(folder, 'deck.md');
  if (!existsSync(file)) throw new UsageError(`${file} not found.`);
  const deck = parseDeck(readFileSync(file, 'utf8'));
  const slot = slots(folder);
  const rows = [];
  const warnings = [];
  for (const slide of deck.slides) {
    const layout = ['split', 'visual'].find((name) => slide.classes.includes(name)) ?? 'default';
    const media = slide.images.filter((image) => !image.decorative);
    slide.visualIntents.forEach((intent, index) => {
      rows.push(`| ${slide.number} | ${slide.heading ?? '(no heading)'} | ${layout} | ${slot[layout]} | ${intent} | ${media[index]?.src ?? 'to make'} |`);
    });
    for (const image of media.slice(slide.visualIntents.length)) {
      warnings.push(`Slide ${slide.number} shows ${image.src} without a Visual Intent; add one so the visuals plan covers it.`);
    }
  }
  if (!rows.length) console.log('No visuals are planned: no slide has a Visual Intent.');
  else {
    console.log('| Slide | Heading | Layout | Slot | Visual Intent | Media |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    for (const row of rows) console.log(row);
  }
  for (const warning of warnings) console.log(`⚠️  ${warning}`);
  return 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = plan(parseArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`❌ ${error.message}\n`);
    process.exitCode = 2;
  }
}
