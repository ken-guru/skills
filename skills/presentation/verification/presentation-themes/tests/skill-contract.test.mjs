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

test('Protocol, glossary, and Generate Diagrams agree on Batch by default', async () => {
  const mediaProtocol = await read('skills/presentation/MEDIA_RENDERING.md');
  const context = await read('skills/presentation/CONTEXT.md');
  const diagrams = await read('skills/presentation/generate-diagrams/SKILL.md');
  const diagramEvals = JSON.parse(await read('skills/presentation/generate-diagrams/evals/generate-diagrams.json'));

  assert.match(mediaProtocol, /Batch Generation Mode by default; use Interactive only when the user asks/);
  assert.match(context, /\*\*Generation Mode\*\*[^\n]*Batch by default; Interactive on request\./);
  assert.match(diagrams, /Batch by default \(Interactive on request\)/);
  assert.doesNotMatch(diagrams, /Select generation mode|One at a time\s+—/i);
  assert.match(diagrams, /Next[\s\S]*Redo[\s\S]*Stop/);
  assert.match(diagrams, /A {2}Generate missing only/);
  assert.match(diagrams, /scripts\/render-diagrams\.mjs/);
  assert.doesNotMatch(diagrams, /DISCOVERY\.json[^\n]*dark mode|Dark mode preference/i);
  assert.ok(diagramEvals.some((item) => /asking the user nothing/.test(item.expected)));
  assert.ok(diagramEvals.some((item) => /Media Scope prompt/.test(item.expected)));
});

test('Diagram Specs style through Diagram Roles, checked before Media Spec approval', async () => {
  const slides = await read('skills/presentation/generate-slides/SKILL.md');
  const context = await read('skills/presentation/CONTEXT.md');

  const roleCheck = slides.indexOf('check media-spec');
  assert.ok(roleCheck !== -1, 'Generate Slides runs the Media Spec role check');
  assert.ok(roleCheck < slides.indexOf('ask the user to review or approve'), 'the role check precedes approval');
  assert.doesNotMatch(slides, /Palette and line guidance/);
  assert.match(context, /\*\*Effective Text Size\*\*[^\n]*20 px/);
  for (const role of ['base', 'emphasis', 'muted', 'risk', 'boundary', 'flow', 'optional-flow', 'risk-flow']) {
    assert.match(slides, new RegExp(`\`${role}\``));
    assert.match(context, new RegExp(`\\*\\*Diagram Role\\*\\*[^\\n]*\`${role}\``));
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
