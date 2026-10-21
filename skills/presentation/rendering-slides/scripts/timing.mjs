// The speaking-time estimate that `check` prints beside the Accessibility Bar. It is advice, not a
// finding: none of these lines changes the exit code. reviewing-presentation's timing uses the same
// rate and comparison, so each skill works alone.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// A script read aloud runs about 120–150 words a minute; reviewing-presentation holds the same rate.
const WORDS_PER_MINUTE = 130;

const countWords = (text) => text.replace(/\[S\d+\]/g, '').split(/\s+/).filter((word) => /\w/.test(word)).length;

// The length in minutes from brief.md's "Length:" line, or null when there is none.
export function briefLength(folder) {
  const brief = path.join(folder, 'brief.md');
  if (!existsSync(brief)) return null;
  const line = readFileSync(brief, 'utf8').match(/^\s*-\s*Length:\s*(.+)$/im)?.[1];
  const minutes = line?.match(/(\d+(?:\.\d+)?)\s*min/i)?.[1];
  return minutes ? Number(minutes) : null;
}

// Info lines for a parsed deck. With no target length, only the estimate is printed.
export function speakingTimeNotes(deck, target) {
  const words = deck.slides.reduce((sum, slide) => sum + countWords(slide.notes.join(' ')), 0);
  const minutes = words / WORDS_PER_MINUTE;
  const notes = [`About ${minutes.toFixed(1)} minutes of speaking at ${WORDS_PER_MINUTE} words per minute (${words} words in the notes).`];
  if (target === null) return notes;
  const over = minutes - target;
  if (over > 0.5) notes.push(`Warning: the talk runs about ${over.toFixed(1)} minutes over the ${target}-minute length. Cut or merge slides, or shorten the notes.`);
  else if (over < -1) notes.push(`Warning: the talk runs about ${(-over).toFixed(1)} minutes short of the ${target}-minute length. Lengthen the notes or add a slide, unless the spare time is meant for questions.`);
  else notes.push(`Fits the ${target}-minute length.`);
  return notes;
}
