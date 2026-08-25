import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGallerySource } from '../lib/gallery-contract.mjs';

const themes = ['editorial', 'signal', 'compact-signal', 'field-notes'];
const sourceFiles = [
  { path: 'themes/editorial/theme.css', bytes: Buffer.from('editorial') },
  { path: 'fixtures/gallery/media/collaboration-portrait.png', bytes: Buffer.from('portrait') },
  { path: 'fixtures/gallery/deck.mjs', bytes: Buffer.from('deck') },
];

test('gallery source resolution returns the thirty-two semantic documentation assets deterministically', () => {
  const first = resolveGallerySource({ themes, sourceFiles, sampleMediaPresent: true, sampleMediaBytes: Buffer.from('portrait') });
  const second = resolveGallerySource({
    themes,
    sourceFiles: [...sourceFiles].reverse(),
    sampleMediaPresent: true,
    sampleMediaBytes: Buffer.from('portrait'),
  });

  assert.deepEqual(first.assets.map(({ filename }) => filename), [
    'editorial-title.png',
    'editorial-section.png',
    'editorial-text-only.png',
    'editorial-text-plus-image.png',
    'editorial-full-image.png',
    'editorial-data.png',
    'editorial-diagram.png',
    'editorial-quotation.png',
    'signal-title.png',
    'signal-section.png',
    'signal-text-only.png',
    'signal-text-plus-image.png',
    'signal-full-image.png',
    'signal-data.png',
    'signal-diagram.png',
    'signal-quotation.png',
    'compact-signal-title.png',
    'compact-signal-section.png',
    'compact-signal-text-only.png',
    'compact-signal-text-plus-image.png',
    'compact-signal-full-image.png',
    'compact-signal-data.png',
    'compact-signal-diagram.png',
    'compact-signal-quotation.png',
    'field-notes-title.png',
    'field-notes-section.png',
    'field-notes-text-only.png',
    'field-notes-text-plus-image.png',
    'field-notes-full-image.png',
    'field-notes-data.png',
    'field-notes-diagram.png',
    'field-notes-quotation.png',
  ]);
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.notEqual(
    first.sourceFingerprint,
    resolveGallerySource({
      themes,
      sourceFiles: sourceFiles.map((file) =>
        file.path.endsWith('deck.mjs') ? { ...file, bytes: Buffer.from('changed') } : file,
      ),
      sampleMediaPresent: true,
      sampleMediaBytes: Buffer.from('portrait'),
    }).sourceFingerprint,
  );
});

test('gallery source resolution blocks before rendering when paid sample media is absent', () => {
  assert.throws(
    () => resolveGallerySource({ themes, sourceFiles, sampleMediaPresent: false }),
    /Paid image generation required.*explicit confirmation.*generate-images/s,
  );
});
