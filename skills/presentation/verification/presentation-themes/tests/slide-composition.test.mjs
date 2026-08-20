import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifySlide,
  planSlide,
} from '../../../generate-slides/scripts/slide-composition.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const editorial = JSON.parse(
  await readFile(
    path.resolve(here, '../../../generate-slides/themes/editorial/theme.json'),
    'utf8',
  ),
);

test('ordered classification deterministically covers all seven archetypes', () => {
  assert.equal(classifySlide({ role: 'opener', visual: { type: 'diagram' } }), 'title');
  assert.equal(classifySlide({ role: 'section-boundary' }), 'section');
  assert.equal(classifySlide({ visual: { type: 'diagram' } }), 'diagram');
  assert.equal(classifySlide({ quantitative: true }), 'data');
  assert.equal(classifySlide({ visual: { type: 'picture' } }), 'text-plus-image');
  assert.equal(classifySlide({ role: 'quotation' }), 'quotation');
  assert.equal(classifySlide({}), 'text-only');
});

test('picture orientation selects the persisted variation and mismatches block', () => {
  const plan = planSlide({
    manifest: editorial,
    slide: {
      visual: {
        type: 'picture',
        themeTreatment: editorial.media.pictureTreatment,
        intendedOrientation: 'portrait',
        actualOrientation: 'portrait',
      },
    },
  });
  assert.equal(plan.variation, 'portrait');
  assert.match(plan.directive, /archetype-text-plus-image variation-portrait tone-light/);
  assert.equal(plan.themeTreatment, editorial.media.pictureTreatment);

  const fullImagePlan = planSlide({
    manifest: editorial,
    slide: {
      visual: {
        type: 'picture',
        themeTreatment: editorial.media.pictureTreatment,
        intendedOrientation: 'full-image',
        actualOrientation: 'full-image',
      },
    },
  });
  assert.equal(fullImagePlan.variation, 'full-image');
  assert.match(fullImagePlan.directive, /archetype-text-plus-image variation-full-image tone-light/);

  assert.throws(
    () =>
      planSlide({
        manifest: editorial,
        slide: {
          visual: {
            type: 'picture',
            themeTreatment: editorial.media.pictureTreatment,
            intendedOrientation: 'portrait',
            actualOrientation: 'landscape',
          },
        },
      }),
    { code: 'ORIENTATION_MISMATCH' },
  );
});

test('over-capacity content splits instead of shrinking below the contract', () => {
  const plan = planSlide({
    manifest: editorial,
    slide: {
      heading: ['Over capacity', 'must split'],
      body: Array.from({ length: 6 }, () => ['Two-line', 'bullet']),
    },
  });
  assert.equal(plan.archetype, 'text-only');
  assert.equal(plan.action, 'split');
  assert.deepEqual(plan.exceeded, ['bullets']);
});

test('chart visuals classify as Data and use the protected media composition', () => {
  const plan = planSlide({
    manifest: editorial,
    slide: { heading: 'Chart', takeaway: 'One takeaway', visual: { type: 'chart' } },
  });
  assert.equal(plan.archetype, 'data');
  assert.equal(plan.action, 'compose');
  assert.ok(editorial.archetypes.data.slots.includes('media'));
});
