import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryDirectory = path.resolve(process.cwd(), '../../../..');

async function read(relativePath) {
  return readFile(path.join(repositoryDirectory, relativePath), 'utf8');
}

test('Presentation documentation agrees on lifecycle and media phases', async () => {
  const context = await read('skills/presentation/CONTEXT.md');
  const schema = await read('skills/presentation/docs/state-schema.md');
  const orchestrator = await read('skills/presentation/build-presentation/SKILL.md');

  for (const term of ['Discovery', 'Structure', 'Generation', 'Proofread', 'Images', 'Diagrams']) {
    assert.match(context, new RegExp(`\\b${term}\\b`, 'i'));
    assert.match(schema, new RegExp(`\\b${term}\\b`, 'i'));
    assert.match(orchestrator, new RegExp(`\\b${term}\\b`, 'i'));
  }

  assert.match(schema, /phases\.images/);
  assert.match(schema, /phases\.diagrams/);
  assert.match(schema, /Media complete/);
  assert.match(schema, /neither `"done"` nor `"skipped"`/);
});

test('Orchestrator pointers and Media Renderer triggers are branch-specific', async () => {
  const orchestrator = await read('skills/presentation/build-presentation/SKILL.md');
  const images = await read('skills/presentation/generate-images/SKILL.md');
  const diagrams = await read('skills/presentation/generate-diagrams/SKILL.md');
  const mediaProtocol = await read('skills/presentation/MEDIA_RENDERING.md');

  assert.match(orchestrator, /GIT_CHECKPOINTS\.md/);
  assert.match(orchestrator, /ROUTING\.md/);
  assert.ok(!orchestrator.includes('Token cost hints'));
  assert.match(images, /IMAGE_SPEC\.md exists or the user explicitly requests/);
  assert.match(diagrams, /DIAGRAM_SPEC\.md exists or the user explicitly requests/);
  assert.ok(!images.includes('after generate-slides'));
  assert.ok(!diagrams.includes('after generate-slides'));

  for (const term of ['Media Scope', 'Generation Mode', 'pending', 'unrelated']) {
    assert.match(mediaProtocol, new RegExp(term));
  }
});

test('Media Renderer evals cover trigger ambiguity and incomplete outcomes', async () => {
  const imageEvals = JSON.parse(await read('skills/presentation/generate-images/evals/generate-images.json'));
  const diagramEvals = JSON.parse(await read('skills/presentation/generate-diagrams/evals/generate-diagrams.json'));

  for (const evals of [imageEvals, diagramEvals]) {
    assert.ok(evals.some((item) => item.query.includes('render the visuals')));
    assert.ok(evals.some((item) => item.query.includes('stop rendering')));
    assert.ok(evals.some((item) => item.precondition.includes('One selected')));
  }
});

test('Compact Signal pagination shows only the current slide number', async () => {
  const compactSignal = await read('skills/presentation/generate-slides/themes/compact-signal/theme.css');

  assert.match(compactSignal, /content:\s*attr\(data-marpit-pagination\);/);
  assert.doesNotMatch(compactSignal, /counter\(marpit-slide/);
});
