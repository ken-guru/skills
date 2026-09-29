import assert from 'node:assert/strict';
import test from 'node:test';

import { diagramMediaBoxIssues } from '../lib/diagram-media-box.mjs';

// The rendered-slot measurement runs in CI (scripts/check-diagram-media-box.mjs)
// and in the full render tier; this pins the comparison both apply.
test('a declared diagram media box matching the rendered slot passes', () => {
  assert.deepEqual(diagramMediaBoxIssues({ declared: { width: 1126, height: 252 }, measured: { width: 1126, height: 255 } }), []);
});

test('a declared diagram media box larger than the rendered slot fails', () => {
  const issues = diagramMediaBoxIssues({ declared: { width: 1126, height: 300 }, measured: { width: 1126, height: 252 } });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /height 300px.*252px/);
});

test('a declared diagram media box well under the rendered slot fails', () => {
  const issues = diagramMediaBoxIssues({ declared: { width: 900, height: 252 }, measured: { width: 1126, height: 252 } });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /width 900px.*1126px.*update/);
});

test('a missing declaration fails', () => {
  assert.equal(diagramMediaBoxIssues({ declared: undefined, measured: { width: 1126, height: 252 } }).length, 2);
});
