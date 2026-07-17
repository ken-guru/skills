import assert from 'node:assert/strict';
import test from 'node:test';

import { validateGalleryDocumentation } from '../lib/gallery-contract.mjs';

const expectedAssets = [
  'editorial-title.png',
  'editorial-text-plus-image.png',
  'signal-title.png',
  'signal-text-plus-image.png',
  'field-notes-title.png',
  'field-notes-text-plus-image.png',
];
const asset = (name) => `docs/assets/presentation-themes/${name}`;
const disclosure =
  'The sample artwork was AI-generated for this comparison and is reused unchanged across all themes.';

test('documentation validation accepts portable linked images with unique purpose-based alternatives', () => {
  const readme = `# Skills\n\n${disclosure}\n\n## Presentation themes\n\n` +
    `![Editorial title slide with warm serif typography](${asset('editorial-title.png')})\n` +
    `![Signal title slide with a dark technical grid](${asset('signal-title.png')})\n` +
    `![Field Notes title slide with tactile paper framing](${asset('field-notes-title.png')})\n` +
    `[Explore the complete gallery](docs/presentation-themes.md)\n`;
  const gallery = `# Presentation themes\n\n${disclosure}\n\n## Title\n\n` +
    expectedAssets.map((name) => `![${name.replaceAll('-', ' ')} visual composition](assets/presentation-themes/${name})`).join('\n') +
    '\n\n[Build a presentation](../skills/build-presentation/SKILL.md)\n';
  const existingPaths = new Set([
    ...expectedAssets.map(asset),
    'docs/presentation-themes.md',
    'skills/build-presentation/SKILL.md',
  ]);

  assert.deepEqual(
    validateGalleryDocumentation({ readme, gallery, expectedAssets, existingPaths }),
    [],
  );
});

test('documentation validation reports generic alternatives, missing disclosure, broken links, and layout HTML', () => {
  const issues = validateGalleryDocumentation({
    readme: '# Skills\n\n## Presentation themes\n\n![screenshot](missing.png)\n<table>',
    gallery: '# Presentation themes\n\n![screenshot](missing.png)',
    expectedAssets,
    existingPaths: new Set(),
  });

  assert.ok(issues.some((issue) => issue.includes('AI-generated sample artwork disclosure')));
  assert.ok(issues.some((issue) => issue.includes('generic alternative text')));
  assert.ok(issues.some((issue) => issue.includes('does not resolve')));
  assert.ok(issues.some((issue) => issue.includes('portable Markdown')));
  assert.ok(issues.some((issue) => issue.includes('expected gallery image references')));
});
