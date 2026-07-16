import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { capacityDeck } from '../fixtures/capacity-deck.mjs';
import { renderPresentationMarkdown } from '../../../skills/generate-slides/scripts/semantic-markup.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.resolve(here, '../../../skills/generate-slides/themes/editorial/theme.json'), 'utf8'));

test('canonical fixture populates every archetype at the shared capacity floor', () => {
  const deck = capacityDeck('editorial', manifest);
  const slides = deck.split('\n---\n').slice(1);
  assert.equal(slides.length, 8);
  for (const archetype of [
    'title',
    'section',
    'text-only',
    'text-plus-image',
    'data',
    'diagram',
    'quotation',
  ]) {
    assert.match(deck, new RegExp(`archetype-${archetype}`));
  }
  assert.match(slides[0], /slot-title[^>]*>[^<]*<br>[^<]*<br>/);
  assert.match(slides[1], /slot-title[^>]*>[^<]*<br>[^<]*<br>/);
  assert.equal((slides[2].match(/<li>/g) ?? []).length, 5);
  assert.equal((slides[2].match(/<br>/g) ?? []).length, 6);
  assert.equal((slides[3].match(/<li>/g) ?? []).length, 4);
  assert.equal((slides[4].match(/<li>/g) ?? []).length, 4);
  assert.equal((slides[5].match(/class="metric"/g) ?? []).length, 4);
  assert.match(slides[7], /slot-quote[^>]*>[^<]*<br>[^<]*<br>[^<]*<br>/);
});

test('Semantic Slide Markup blocks missing meaningful media alternatives', () => {
  assert.throws(
    () =>
      renderPresentationMarkdown({
        frontMatter: { marp: true, theme: 'editorial' },
        manifest,
        slides: [
          {
            role: 'opener',
            title: 'Title',
            subtitle: 'Subtitle',
            label: 'Label',
            visual: {
              type: 'picture',
              filename: 'image.svg',
              themeTreatment: manifest.media.pictureTreatment,
            },
          },
        ],
      }),
    { code: 'MISSING_MEDIA_ALTERNATIVE' },
  );
});
