import assert from 'node:assert/strict';
import test from 'node:test';

import { validateGalleryDocumentation } from '../lib/gallery-documentation.mjs';

const expectedAssets = [
  'editorial-title.png',
  'editorial-text-plus-image.png',
  'signal-title.png',
  'signal-text-plus-image.png',
  'field-notes-title.png',
  'field-notes-text-plus-image.png',
];
const asset = (name) =>
  `skills/presentation/docs/assets/presentation-themes/${name}`;
const disclosure =
  'The sample artwork was AI-generated for this comparison and is reused unchanged across all themes.';
const guidance = `Editorial is the default. Choose a theme during Discovery. Theme identity stays stable while composition varies with content. Media Specs own image generation and diagrams.`;

test('documentation validation accepts portable linked images with unique purpose-based alternatives', () => {
  const readme = `# Skills\n\n${disclosure}\n\n${guidance}\n\n## Presentation themes\n\n` +
    `![Editorial title slide with warm serif typography](docs/assets/presentation-themes/editorial-title.png)\n` +
    `![Signal title slide with a dark technical grid](docs/assets/presentation-themes/signal-title.png)\n` +
    `![Field Notes title slide with tactile paper framing](docs/assets/presentation-themes/field-notes-title.png)\n` +
    `[Explore the complete gallery](docs/presentation-themes.md)\n`;
  const gallery = `# Presentation themes\n\n${disclosure}\n\n${guidance}\n\n## Title\n\n` +
    expectedAssets.map((name) => {
      const theme = name.startsWith('field-notes-') ? 'field notes' : name.split('-')[0];
      const archetype = name.replace(/^(?:field-notes|editorial|signal)-/, '').replace('.png', '').split('-');
      const property = theme === 'editorial' ? 'warm serif typography' : theme === 'signal' ? 'dark technical grid' : 'textured paper framing';
      return `![${theme} ${archetype.join(' ')} slide with ${property}](assets/presentation-themes/${name})`;
    }).join('\n') +
    '\n\n[Build a presentation](../build-presentation/SKILL.md)\n';
  const existingPaths = new Set([
    ...expectedAssets.map(asset),
    'skills/presentation/docs/presentation-themes.md',
    'skills/presentation/build-presentation/SKILL.md',
  ]);

  assert.deepEqual(
    validateGalleryDocumentation({ readme, gallery, expectedAssets, existingPaths }),
    [],
  );
});

test('documentation validation requires guidance and theme/archetype-specific alt text', () => {
  const images = expectedAssets
    .map((name) => `![Polished themed composition](assets/presentation-themes/${name})`)
    .join('\n');
  const issues = validateGalleryDocumentation({
    readme: `# Skills\n\n${disclosure}\n\n${images}`,
    gallery: `# Presentation themes\n\n${disclosure}\n\n${images}`,
    expectedAssets,
    existingPaths: new Set(expectedAssets.map(asset)),
  });
  assert.ok(issues.some((issue) => issue.includes('selection and behavior guidance')));
  assert.ok(issues.some((issue) => issue.includes('name its Theme and Slide Archetype')));
  assert.ok(issues.some((issue) => issue.includes('distinguishing visual property')));
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
  assert.ok(issues.some((issue) => issue.includes('expected twelve gallery images')));
});

test('documentation validation requires the exact README and gallery image reference sets', () => {
  const validAlternative = (name) => `Editorial title slide with warm serif typography for ${name}`;
  const issues = validateGalleryDocumentation({
    readme: `# Skills\n\n${disclosure}\n\n${guidance}\n\n` +
      `![${validAlternative('first')}](${asset('editorial-title.png')})\n` +
      `![${validAlternative('duplicate')}](${asset('editorial-title.png')})\n` +
      `![Unexpected image with a dark grid](${asset('unexpected.png')})`,
    gallery: `# Themes\n\n${disclosure}\n\n${guidance}\n\n` +
      expectedAssets.map((name) => `![Editorial title slide with warm serif typography ${name}](${asset(name)})`).join('\n') +
      `\n![Unexpected image with a dark grid](${asset('unexpected.png')})`,
    expectedAssets,
    existingPaths: new Set([...expectedAssets.map(asset), asset('unexpected.png')]),
  });
  assert.ok(issues.some((issue) => issue.includes('exactly the three expected title images')));
  assert.ok(issues.some((issue) => issue.includes('exactly the expected twelve gallery images')));
});
