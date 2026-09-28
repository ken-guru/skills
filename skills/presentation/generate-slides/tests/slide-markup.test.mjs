import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { prepareThemeProject } from '../scripts/prepare-theme.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../scripts/slide-markup.mjs');
const themesDirectory = path.resolve(here, '../themes');
const editorial = JSON.parse(await readFile(path.join(themesDirectory, 'editorial/theme.json'), 'utf8'));
const { pictureTreatment, diagramTreatment } = editorial.media;

const agenda = `# Collaborative intelligence

1. Opening — Picture, \`images/opening.png\`, Landscape.
2. How work flows — [Visual: Diagram — \`images/flow.svg\`]
3. Five moves — [Visual: None]
4. Glossary — [Visual: None]
5. Design principle — Quotation.
`;
const imageSpec = `## Slide 1 — Opening
- **Filename:** \`images/opening.png\`
`;
const diagramSpec = `## Slide 2 — How work flows
- **Filename:** \`images/flow.svg\`
`;

// Prepares a themed Project Folder the way Theme preparation does before Generation.
async function themedProject({ presentationPath = 'PRESENTASJON.md', rendered = ['images/flow.svg'] } = {}) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'slide-markup-'));
  await writeFile(
    path.join(project, 'DISCOVERY.json'),
    `${JSON.stringify({
      language: 'en',
      theme: { id: 'editorial', fontOverride: null },
      paths: { agenda: 'AGENDA.md', presentation: presentationPath },
    })}\n`,
  );
  await writeFile(path.join(project, 'AGENDA.md'), agenda);
  await writeFile(path.join(project, 'IMAGE_SPEC.md'), imageSpec);
  await writeFile(path.join(project, 'DIAGRAM_SPEC.md'), diagramSpec);
  await prepareThemeProject({ projectDirectory: project, themesDirectory });
  await mkdir(path.join(project, 'images'), { recursive: true });
  for (const file of rendered) await writeFile(path.join(project, file), '<svg viewBox="0 0 1 1"></svg>');
  return project;
}

function runCli(args, stdin = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(typeof stdin === 'string' ? stdin : JSON.stringify(stdin));
  });
}

const diagramSlide = {
  heading: ['How work flows', 'from idea to decision'],
  takeaway: 'Feedback returns to exploration.',
  caption: 'Each stage hands a clearer draft forward.',
  visual: {
    type: 'diagram',
    filename: 'images/flow.svg',
    alt: 'Explore flows to Align and Express; feedback returns to Explore',
    themeTreatment: diagramTreatment,
  },
};

test('--write renders a diagram slide into the configured presentation path', async () => {
  const project = await themedProject({ presentationPath: 'deck/SLIDES.md' });
  await mkdir(path.join(project, 'deck'));
  await mkdir(path.join(project, 'deck/images'));
  await writeFile(path.join(project, 'deck/images/flow.svg'), '<svg viewBox="0 0 1 1"></svg>');

  const result = await runCli([project, '--write'], [diagramSlide]);

  assert.equal(result.code, 0, result.stderr);
  const markdown = await readFile(path.join(project, 'deck/SLIDES.md'), 'utf8');
  assert.match(markdown, /^---\nmarp: true\ntheme: editorial\nsize: 16:9\npaginate: true\nlang: en\n---\n/);
  assert.match(markdown, /<!-- _class: archetype-diagram variation-default tone-light -->/);
  assert.match(markdown, /<h2 class="slot-heading">How work flows<br>from idea to decision<\/h2>/);
  assert.match(markdown, /<img src="images\/flow.svg" alt="Explore flows to Align and Express; feedback returns to Explore">/);
  assert.match(markdown, /<p class="slot-caption">Each stage hands a clearer draft forward.<\/p>/);
});

const textSlide = {
  heading: 'Five moves',
  label: 'Method',
  body: [['Collect the useful mess', 'before narrowing.'], 'Name the decision.', 'Test every slide.'],
  notes: ['Walk through the moves in order.', 'Pause on the second: it is where teams stall.'],
};
const glossarySlide = {
  heading: 'Glossary',
  body: ['Agenda — the approved outline.', 'Theme — the locked visual package.'],
};
const quotationSlide = {
  role: 'quotation',
  context: 'Design principle',
  quote: ['The theme should carry the mood', 'and never obscure the meaning.'],
  attribution: ['Presentation Theme contract', 'Collaborative design system, 2026'],
};

test('--check reports each slide composition and writes nothing', async () => {
  const project = await themedProject();
  const before = (await readdir(project, { recursive: true })).sort();

  const result = await runCli([project, '--check'], [diagramSlide, textSlide, glossarySlide, quotationSlide]);

  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Slide 1: diagram \(default\) — headingLines 2\/2, diagrams 1\/1, captionLines 1\/2/);
  assert.match(result.stdout, /Slide 2: text-only \(default\) — headingLines 1\/2, bullets 3\/5, bulletLines 2\/2/);
  assert.match(result.stdout, /Slide 3: text-only \(default\) — headingLines 1\/2, bullets 2\/5, bulletLines 1\/2/);
  assert.match(result.stdout, /Slide 4: quotation \(default\) — quoteLines 2\/4, attributionLines 2\/2, contextLines 1\/1/);
  assert.deepEqual((await readdir(project, { recursive: true })).sort(), before);
});

test('--write renders text-only, glossary, speaker-notes, and source-attribution slides', async () => {
  const project = await themedProject();

  const result = await runCli([project, '--write'], [textSlide, glossarySlide, quotationSlide]);

  assert.equal(result.code, 0, result.stdout + result.stderr);
  const slides = (await readFile(path.join(project, 'PRESENTASJON.md'), 'utf8')).split('\n\n---\n\n');
  assert.equal(slides.length, 3);
  assert.match(slides[0], /<p class="slot-label">Method<\/p>/);
  assert.match(slides[0], /<li>Collect the useful mess<br>before narrowing.<\/li>/);
  assert.match(slides[0], /<!--\n- Walk through the moves in order.\n- Pause on the second: it is where teams stall.\n-->$/);
  assert.match(slides[1], /archetype-text-only/);
  assert.match(slides[1], /<li>Agenda — the approved outline.<\/li>\n<li>Theme — the locked visual package.<\/li>/);
  assert.doesNotMatch(slides[1], /<!--\n-/);
  assert.match(slides[2], /archetype-quotation variation-default tone-dark/);
  assert.match(slides[2], /<p class="slot-attribution">Presentation Theme contract<br>Collaborative design system, 2026<\/p>/);
});

const brokenDeck = [
  { heading: 'Too much', body: Array.from({ length: 6 }, () => 'A point') },
  { ...diagramSlide, visual: { ...diagramSlide.visual, alt: '' } },
  { quantitative: true, heading: 'Adoption', takeaway: 'Most teams adopt.', metrics: [{ value: '80%', label: 'Teams' }] },
  { heading: 'Clip', body: ['Watch this'], visual: { type: 'video', filename: 'images/flow.svg', alt: 'A clip' } },
  { role: 'closing', heading: 'Thanks', body: ['Questions?'] },
  { archetype: 'timeline', heading: 'Roadmap', body: ['Q1'] },
  textSlide,
];

test('--write reports every blocking error with its slide number and writes nothing', async () => {
  const project = await themedProject();

  const result = await runCli([project, '--write'], brokenDeck);

  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /error: slide 1: SLIDE_SPLIT_REQUIRED: .*bullets 6\/5/);
  assert.match(result.stdout, /error: slide 2: MISSING_MEDIA_ALTERNATIVE/);
  assert.match(result.stdout, /error: slide 3: MISSING_METRICS_ALTERNATIVE/);
  assert.match(result.stdout, /error: slide 4: UNKNOWN_VISUAL_TYPE: .*video/);
  assert.match(result.stdout, /error: slide 5: UNKNOWN_ROLE: .*closing/);
  assert.match(result.stdout, /error: slide 6: UNKNOWN_ARCHETYPE: .*timeline/);
  assert.doesNotMatch(result.stdout, /error: slide 7/);
  await assert.rejects(readFile(path.join(project, 'PRESENTASJON.md')), { code: 'ENOENT' });
});

test('--check reports the same errors and exits 1', async () => {
  const project = await themedProject();

  const result = await runCli([project, '--check'], brokenDeck);

  assert.equal(result.code, 1);
  assert.equal(result.stdout.match(/^error: /gm)?.length, 6);
});

test('a missing required field blocks instead of rendering "undefined"', async () => {
  const project = await themedProject();

  const result = await runCli([project, '--check'], [{ role: 'quotation', quote: 'Only a quote' }]);

  assert.equal(result.code, 1);
  assert.match(result.stdout, /error: slide 1: MISSING_FIELD: .*context/);
  assert.match(result.stdout, /error: slide 1: MISSING_FIELD: .*attribution/);
});

test('a malformed field blocks with one precise error', async () => {
  const project = await themedProject();

  const result = await runCli([project, '--check'], [{ heading: 'Points', body: 'Not a list' }]);

  assert.equal(result.code, 1);
  assert.deepEqual(result.stdout.match(/^error: .*$/gm), ['error: slide 1: INVALID_FIELD: "body" must be an array.']);
});

const pictureSlide = {
  role: 'opener',
  title: 'Collaborative intelligence',
  label: 'Keynote',
  subtitle: 'How teams shape ideas together',
  visual: {
    type: 'picture',
    filename: 'images/opening.png',
    alt: 'Two collaborators shaping a model at a shared table',
    themeTreatment: pictureTreatment,
  },
};

test('media not rendered yet warns and --write still succeeds', async () => {
  const project = await themedProject({ rendered: ['images/flow.svg'] });

  const result = await runCli([project, '--write'], [pictureSlide, diagramSlide]);

  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /warning: slide 1: MEDIA_NOT_RENDERED: .*images\/opening.png/);
  assert.doesNotMatch(result.stdout, /slide 2: MEDIA_NOT_RENDERED/);
  assert.match(await readFile(path.join(project, 'PRESENTASJON.md'), 'utf8'), /src="images\/opening.png"/);
});

test('a media filename with no Agenda or Media Spec entry blocks with its slide number', async () => {
  const project = await themedProject();
  const stray = { ...diagramSlide, visual: { ...diagramSlide.visual, filename: 'images/stray.svg' } };

  const result = await runCli([project, '--write'], [textSlide, stray]);

  assert.equal(result.code, 1);
  assert.match(result.stdout, /error: slide 2: MEDIA_NOT_SPECIFIED: .*images\/stray.svg/);
  await assert.rejects(readFile(path.join(project, 'PRESENTASJON.md')), { code: 'ENOENT' });
});

test('media named only in a Media Spec is accepted', async () => {
  const project = await themedProject();
  await writeFile(path.join(project, 'AGENDA.md'), '# Outline without filenames\n');

  const result = await runCli([project, '--check'], [diagramSlide]);

  assert.equal(result.code, 0, result.stdout + result.stderr);
});

test('identical input writes byte-identical Markdown and no slide-plan file', async () => {
  const project = await themedProject();
  const deck = [pictureSlide, diagramSlide, textSlide, glossarySlide, quotationSlide];
  const before = new Set(await readdir(project, { recursive: true }));

  assert.equal((await runCli([project, '--write'], deck)).code, 0);
  const first = await readFile(path.join(project, 'PRESENTASJON.md'));
  assert.equal((await runCli([project, '--write'], deck)).code, 0);
  const second = await readFile(path.join(project, 'PRESENTASJON.md'));

  assert.ok(first.equals(second));
  const added = (await readdir(project, { recursive: true })).filter((entry) => !before.has(entry));
  assert.deepEqual(added, ['PRESENTASJON.md']);
});

test('usage and prerequisite problems exit 2 without writing', async () => {
  const project = await themedProject();
  const unprepared = await mkdtemp(path.join(os.tmpdir(), 'slide-markup-unprepared-'));
  await writeFile(path.join(unprepared, 'DISCOVERY.json'), JSON.stringify({ language: 'en', theme: { id: 'editorial' } }));
  await writeFile(path.join(unprepared, 'AGENDA.md'), agenda);

  const cases = [
    [[project], [textSlide], /Usage/],
    [[project, '--check', '--write'], [textSlide], /Usage/],
    [[project, '--check'], 'not json', /not valid JSON/],
    [[project, '--check'], [], /non-empty JSON array/],
    [[unprepared, '--check'], [textSlide], /prepare-theme\.mjs/],
    [[path.join(project, 'missing'), '--check'], [textSlide], /DISCOVERY\.json/],
  ];
  for (const [args, stdin, message] of cases) {
    const result = await runCli(args, stdin);
    assert.equal(result.code, 2, `${args.join(' ')}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, message);
  }
  await assert.rejects(readFile(path.join(project, 'PRESENTASJON.md')), { code: 'ENOENT' });
});
