import assert from 'node:assert/strict';
import test from 'node:test';

import { presentationThemeInvalidationPlan } from '../../../skills/shared/presentation-theme-invalidation.mjs';

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
  for (const change of ['theme', 'refresh']) {
    const plan = presentationThemeInvalidationPlan({ change, discovery });
    assert.deepEqual(plan.preserve, ['AGENDA.md', 'images/', 'videos/']);
    assert.deepEqual(plan.pendingPhases, [
      'generation',
      'images',
      'diagrams',
      'proofread',
    ]);
    assert.ok(plan.stale.includes('IMAGE_SPEC.md'));
    assert.ok(plan.stale.includes('DIAGRAM_SPEC.md'));
    assert.ok(plan.stale.includes('PRESENTASJON.pdf'));
    assert.ok(plan.stale.includes('themes/'));
  }
});

test('font-only changes preserve media handoffs and generated media', () => {
  const plan = presentationThemeInvalidationPlan({ change: 'font', discovery });
  assert.deepEqual(plan.pendingPhases, ['generation', 'proofread']);
  assert.ok(plan.preserve.includes('IMAGE_SPEC.md'));
  assert.ok(plan.preserve.includes('DIAGRAM_SPEC.md'));
  assert.ok(plan.preserve.includes('images/'));
  assert.deepEqual(plan.stale, ['PRESENTASJON.md', 'PRESENTASJON.html', 'PRESENTASJON.pdf']);
});
