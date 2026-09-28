import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
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

test('Discovery asks its questions in three rounds', async () => {
  const skill = await read('skills/presentation/discover-presentation/SKILL.md');
  const questions = await read('skills/presentation/discover-presentation/QUESTIONS.md');
  const evals = JSON.parse(await read('skills/presentation/discover-presentation/evals/discover-presentation.json'));

  for (const document of [skill, questions]) {
    assert.doesNotMatch(document, /one at a time/i);
  }
  for (const round of ['Round 1', 'Round 2', 'Round 3']) {
    assert.match(questions, new RegExp(`\\b${round}\\b`));
  }
  assert.match(questions, /one message/);
  assert.match(questions, /structured question tool/);
  assert.ok(evals.filter((item) => /\bround\b/i.test(item.expected)).length >= 3);
});

test('Structure Agenda collects every Diagram brief in one form', async () => {
  const context = await read('skills/presentation/CONTEXT.md');
  const draft = await read('skills/presentation/structure-agenda/DRAFT_AGENDA.md');
  const evals = JSON.parse(await read('skills/presentation/structure-agenda/evals/structure-agenda.json'));

  assert.match(context, /\*\*Agenda-time diagram briefing\*\*[^\n]*once the draft outline is presented, in one round covering every Diagram slide/);
  assert.doesNotMatch(draft, /one at a time/i);
  assert.match(draft, /Diagram brief form/);
  assert.match(draft, /every Diagram slide/);
  assert.match(draft, /re-ask only the missing fields/i);
  assert.match(draft, /\bdraft\b[^\n]*propose/);
  assert.match(draft, /structured question tool/);

  for (const behaviour of [/one reply/i, /only the missing/i, /to Picture\b.*\bto None\b/]) {
    assert.ok(evals.some((item) => behaviour.test(item.expected)), `missing eval for ${behaviour}`);
  }
  assert.ok(evals.every((item) => item.skill === 'structure-agenda'));
});

test('Generation Mode is Batch by default across the glossary, protocol, and Media Renderers', async () => {
  const context = await read('skills/presentation/CONTEXT.md');
  const mediaProtocol = await read('skills/presentation/MEDIA_RENDERING.md');
  const images = await read('skills/presentation/generate-images/SKILL.md');
  const diagrams = await read('skills/presentation/generate-diagrams/SKILL.md');

  assert.match(context, /\*\*Generation Mode\*\*[^\n]*Batch by default; Interactive on request\./);
  assert.match(mediaProtocol, /Use Batch Generation Mode by default; use Interactive only when the user asks\./);
  for (const renderer of [images, diagrams]) {
    assert.match(renderer, /Protocol: resolve Media Scope, Batch by default \(Interactive on request\)/);
    assert.doesNotMatch(renderer, /choose Generation Mode/);
  }
});

test('Generate Images confirms once before paid generation', async () => {
  const images = await read('skills/presentation/generate-images/SKILL.md');
  const evals = JSON.parse(await read('skills/presentation/generate-images/evals/generate-images.json'));

  assert.match(images, /Generate N images with <provider>\/<model>\? \(yes \/ one at a time \/ cancel\)/);
  assert.doesNotMatch(images, /All at once/);
  assert.match(images, /existing files detected/);

  for (const answer of [/\byes\b/, /one at a time/, /\bcancel\b/]) {
    assert.ok(
      evals.some((item) => answer.test(item.query) && /confirm/i.test(item.precondition)),
      `missing eval answering the confirmation with ${answer}`,
    );
  }
});

// Suite members that must stay user-invoked, each mapped to its reason. Copilot
// CLI's skill tool cannot load a Skill that sets disable-model-invocation, and the
// Orchestrator cannot load it in any harness, so an entry needs a real reason.
const userInvokedMembers = new Map();

async function suiteMembers() {
  const suite = path.join(repositoryDirectory, 'skills/presentation');
  const members = [];
  for (const entry of await readdir(suite, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skill = await readFile(path.join(suite, entry.name, 'SKILL.md'), 'utf8').catch(() => null);
    if (skill) members.push({ name: entry.name, frontMatter: skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '' });
  }
  return members;
}

test('Every suite member has a real Trigger and stays model-invocable unless documented', async () => {
  const members = await suiteMembers();
  assert.ok(members.length >= 8);
  for (const { name, frontMatter } of members) {
    const description = frontMatter.match(/^description:\s*"?(.*?)"?\s*$/m)?.[1] ?? '';
    assert.ok(description.length >= 30, `${name} needs a real Trigger description`);
    assert.doesNotMatch(description, /(\.\.\.|…)$/, `${name} has a placeholder description`);
    if (/^disable-model-invocation:\s*true\b/m.test(frontMatter)) {
      assert.ok(userInvokedMembers.has(name), `${name} sets disable-model-invocation without a documented reason`);
    }
  }
});

test('Proofread loads for review requests and runs as the fourth phase', async () => {
  const proofread = (await suiteMembers()).find((member) => member.name === 'proofread-presentation');
  assert.match(proofread.frontMatter, /^description: "Proofreader\. Load when /m);

  const orchestrator = await read('skills/presentation/build-presentation/SKILL.md');
  assert.match(orchestrator, /\| Proofread pending \|[^\n]*\| Run `proofread-presentation`/);

  const evals = JSON.parse(await read('skills/presentation/proofread-presentation/evals/proofread-presentation.json'));
  assert.ok(evals.some((item) => item.type === 'positive'));
  assert.ok(evals.some((item) => item.type === 'negative' && /Generation is in progress/.test(item.precondition)));
  assert.ok(evals.some((item) => item.type === 'boundary' && /media phase is pending/.test(item.precondition)));

  const orchestratorEvals = JSON.parse(await read('skills/presentation/build-presentation/evals/build-presentation.json'));
  assert.ok(orchestratorEvals.some((item) => /runs proofread-presentation as the fourth phase/.test(item.expected)));
});

test('Proofread reviews local HTML slide images instead of comparing the PDF visually', async () => {
  const proofread = await read('skills/presentation/proofread-presentation/SKILL.md');
  const generation = await read('skills/presentation/generate-slides/SLIDE_GENERATION.md');

  assert.match(proofread, /--images png/);
  assert.match(proofread, /outside the Project Folder/);
  assert.match(proofread, /Delete the temporary directory/);
  for (const member of ['first slide of each Slide Archetype', 'every slide with a Picture or Diagram', 'every slide named in a `presentation-validation` warning']) {
    assert.ok(proofread.includes(member), `inspection set is missing: ${member}`);
  }
  assert.match(proofread, /Inspected slides/);
  assert.match(proofread, /The PDF is not visually reviewed/);
  assert.doesNotMatch(proofread, /Compare PDF visually/i);
  assert.doesNotMatch(proofread, /playwright|qlmanage/i);

  const browserMessage = generation.match(/`(❌ Marp found no local browser[^`]*)`/)?.[1];
  assert.ok(browserMessage, 'Generation names its missing-browser message');
  assert.ok(proofread.includes(browserMessage), 'Proofread blocks with the same missing-browser message as Generation');
});

test('The suite README shows how to invoke a member by name in each harness', async () => {
  const readme = await read('skills/presentation/README.md');
  assert.match(readme, /\| Claude Code \| `\/<skill-name>` \|/);
  assert.match(readme, /\| GitHub Copilot CLI \(interactive\) \| `\/<skill-name>` \|/);
  assert.match(readme, /\| Codex \| `\$<skill-name>`, or pick it from `\/skills` \|/);
});
