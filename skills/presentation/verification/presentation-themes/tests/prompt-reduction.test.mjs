// Contracts from the prompt-reduction decisions (Wayfinder map #450): named
// Media Scope, the diagram archetype rule, checked layouts, browser selection
// for exports, and Proofread fixes that answer the Restart Guard.
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

test('Proofread proposes a fix that needs another phase in one Decision Prompt', async () => {
  const proofread = await read('proofread-presentation/SKILL.md');
  const section = proofread.match(/## Fixes that need another phase\n([\s\S]*?)\n## /)?.[1];
  assert.ok(section, 'missing the "Fixes that need another phase" section');
  for (const listed of [/Skills\s+to\s+run,\s+in\s+order/, /slide\s+scope/, /files\s+to\s+overwrite/, /files\s+to\s+keep/]) {
    assert.match(section, listed);
  }
  assert.match(section, /\bone\s+Decision\s+Prompt\b/);
  assert.match(section, /changes\s+nothing\s+before\s+the\s+answer/i);
  assert.match(section, /layout\s+choices\s+to\s+`generate-diagrams`/);
});

test('the Restart Guard takes an earlier fix as its answer only on an exact match', async () => {
  const guard = await read('generate-slides/RESTART-GUARD.md');
  const rule = guard.split(/\n\s*\n/).find((paragraph) => /earlier\s+in\s+this\s+conversation/.test(paragraph));
  assert.ok(rule, 'missing the earlier-answer rule');
  assert.match(rule, /latest/);
  assert.match(rule, /exactly\s+the\s+files/);
  assert.match(rule, /keeping\s+media/);
  assert.match(rule, /`Overwriting <file>`/);
  // The rule may answer only the non-destructive option.
  assert.match(rule, /\*\*Regenerate\s+presentation\s+text\*\*/);
  assert.doesNotMatch(rule, /Delete\s+generated\s+media|Keep\s+everything/);
  // A theme refresh always asks for its own confirmation.
  const refresh = guard.split(/\n\s*\n/).find((paragraph) => /--confirm-refresh/.test(paragraph));
  assert.match(refresh ?? '', /even\s+after\s+an\s+earlier\s+answer/);
});

test('a media fix refreshes only the exports, without regenerating the slides', async () => {
  const slides = await read('generate-slides/SKILL.md');
  const exportOnly = slides.match(/## Refresh the exports only\n([\s\S]*?)\n## /)?.[1];
  assert.ok(exportOnly, 'missing the "Refresh the exports only" section');
  assert.match(exportOnly, /skip\s+Steps\s+1–5\s+and\s+the\s+Restart\s+Guard/i);
  assert.match(exportOnly, /Step\s+6/);
  assert.match(exportOnly, /`Overwriting <file>`/);
  assert.match(exportOnly, /overwrites\s+only\s+the\s+HTML\s+and\s+PDF/);
  assert.match(exportOnly, /`phases\.generation`\s+stays\s+`done`/);
  assert.match(exportOnly, /export\s+fails[\s\S]*every\s+phase\s+unchanged/);

  const proofread = await read('proofread-presentation/SKILL.md');
  const fix = proofread.match(/## Fixes that need another phase\n([\s\S]*?)\n## /)[1];
  assert.match(fix, /rerenders\s+media/);
  assert.match(fix, /`generate-slides`\s+export\s+and\s+the\s+HTML\s+and\s+PDF\s+to\s+overwrite/);
});

test('a reset commit names the fix the user chose', async () => {
  assert.match(await read('build-presentation/GIT_CHECKPOINTS.md'), /name\s+the\s+fix\s+the\s+user\s+chose/);
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
  await expect('proofread-presentation', /proposes one fix naming generate-diagrams and generate-slides/);
  await expect('generate-slides', /without asking the Restart Guard question/);
  await expect('generate-slides', /asks the Restart Guard question because/);
  await expect('generate-slides', /refreshes only the HTML and PDF/);
  await expect('proofread-presentation', /then generate-slides export/);
});
