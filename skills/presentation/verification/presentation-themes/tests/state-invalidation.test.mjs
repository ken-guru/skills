import assert from 'node:assert/strict';
import test from 'node:test';

import {
  presentationThemeInvalidationPlan as discoveryInvalidationPlan,
} from '../../../discover-presentation/scripts/presentation-theme-invalidation.mjs';
import {
  presentationThemeInvalidationPlan as generationInvalidationPlan,
} from '../../../generate-slides/scripts/presentation-theme-invalidation.mjs';

const implementations = [
  ['Discovery', discoveryInvalidationPlan],
  ['Generate Slides', generationInvalidationPlan],
];

const discovery = {
  paths: {
    agenda: 'AGENDA.md',
    imageSpec: 'IMAGE_SPEC.md',
    diagramSpec: 'DIAGRAM_SPEC.md',
    presentation: 'PRESENTASJON.md',
    html: 'PRESENTASJON.html',
    pdf: 'PRESENTASJON.pdf',
    images: 'images/',
    videos: 'videos/',
    themes: 'themes/',
  },
};

test('theme changes and refreshes invalidate media handoffs and presentation phases', () => {
  for (const [owner, invalidationPlan] of implementations) {
    for (const change of ['theme', 'refresh']) {
      const plan = invalidationPlan({ change, discovery });
      assert.deepEqual(plan.preserve, ['AGENDA.md', 'images/', 'videos/'], owner);
      assert.deepEqual(
        plan.pendingPhases,
        ['generation', 'images', 'diagrams', 'proofread'],
        owner,
      );
      assert.ok(plan.stale.includes('IMAGE_SPEC.md'), owner);
      assert.ok(plan.stale.includes('DIAGRAM_SPEC.md'), owner);
      assert.ok(plan.stale.includes('PRESENTASJON.pdf'), owner);
      assert.ok(plan.stale.includes('themes/'), owner);
    }
  }
});

test('font-only changes preserve media handoffs and generated media', () => {
  for (const [owner, invalidationPlan] of implementations) {
    const plan = invalidationPlan({ change: 'font', discovery });
    assert.deepEqual(plan.pendingPhases, ['generation', 'proofread'], owner);
    assert.ok(plan.preserve.includes('IMAGE_SPEC.md'), owner);
    assert.ok(plan.preserve.includes('DIAGRAM_SPEC.md'), owner);
    assert.ok(plan.preserve.includes('images/'), owner);
    assert.deepEqual(
      plan.stale,
      ['PRESENTASJON.md', 'PRESENTASJON.html', 'PRESENTASJON.pdf'],
      owner,
    );
  }
});
