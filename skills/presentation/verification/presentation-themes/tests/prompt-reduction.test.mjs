// Contracts from the prompt-reduction decisions (Wayfinder map #450): named
// Media Scope, the diagram archetype rule, checked layouts, and browser
// selection for exports.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryDirectory = path.resolve(process.cwd(), '../../../..');
const suite = path.join(repositoryDirectory, 'skills/presentation');

async function read(relativePath) {
  return readFile(path.join(suite, relativePath), 'utf8');
}

test('a named Media Scope skips the menu and the slide numbers come inline', async () => {
  const protocol = await read('MEDIA_RENDERING.md');
  assert.match(protocol, /\*\*Named:\*\*/);
  assert.match(protocol, /Overwriting <file> \(Slide N\)/);
  assert.match(protocol, /only after a\s+bare `C`/);
  for (const renderer of ['generate-diagrams', 'generate-images']) {
    const skill = await read(`${renderer}/SKILL.md`);
    assert.match(skill, /\*\*Named( scope)?:\*\*/, renderer);
    assert.match(skill, /Overwriting images\/foo\.(svg|png) \(Slide N\)/, renderer);
    assert.match(skill, /only after a bare `C`/, renderer);
    assert.doesNotMatch(skill, /I'll tell you which slide numbers/, renderer);
  }
});

test('diagrams stay on the diagram archetype and layouts are checked before they are offered', async () => {
  assert.match(await read('structure-agenda/DRAFT_AGENDA.md'), /Give every Diagram its own Diagram slide/);
  const diagrams = await read('generate-diagrams/SKILL.md');
  assert.match(diagrams, /only place diagram layout options are\s+offered/);
  assert.match(diagrams, /render-diagrams\.mjs" "<DIAGRAM_SPEC\.md path>" --check --slide=N --candidate="<temp file>"/);
  assert.match(diagrams, /Offer only candidates that exit `0`/);
  assert.match(await read('presentation-validation/scripts/presentation-validation.mjs'), /'structure\.diagram-archetype', 'warning'/);
});

test('exports pick a working browser once and Proofread inherits it', async () => {
  assert.match(await read('generate-slides/SKILL.md'), /scripts\/export-presentation\.mjs" "<project folder>"/);
  const proofread = await read('proofread-presentation/SKILL.md');
  assert.match(proofread, /rerun Generate Slides' export to select a working browser/);
  assert.match(proofread, /\.marprc\.yml/);
});

test('each decision has a documented eval', async () => {
  const evals = async (name) => JSON.parse(await read(`${name}/evals/${name}.json`));
  const expect = async (name, pattern) => {
    assert.ok((await evals(name)).some((item) => pattern.test(item.expected)), `${name}: no eval for ${pattern}`);
  };
  await expect('generate-diagrams', /no Media Scope prompt, prints "Overwriting/);
  await expect('generate-diagrams', /Media Scope prompt because the description matches more than one entry/);
  await expect('generate-diagrams', /--check --candidate/);
  await expect('generate-images', /one combined question/);
  await expect('generate-images', /without asking which slide numbers/);
  await expect('generate-slides', /export-presentation\.mjs/);
  await expect('structure-agenda', /own Diagram slide/);
  await expect('proofread-presentation', /structure\.diagram-archetype warning/);
});
