// Diagram checks through the public CLI: the Media Spec role check
// (media.diagram-roles) and Effective Text Size (media.svg-legibility).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = path.resolve('skills/presentation/presentation-validation/scripts/presentation-validation.mjs');

// Returns the JSON report whatever the exit status, so findings can be
// asserted without Marp or D2 installed.
async function jsonReport(...args) {
  const { stdout } = await run(process.execPath, [cli, ...args, '--format', 'json'])
    .catch((error) => (error.code === 1 ? error : Promise.reject(error)));
  return JSON.parse(stdout);
}

async function specProject(entries) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'diagram-checks-'));
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify({ language: 'en', theme: { id: 'editorial' } }));
  await writeFile(path.join(project, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  const spec = entries.map(({ slide, d2 }) => [
    `## Slide ${slide} — Diagram ${slide}`,
    `- **Filename:** \`images/diagram-${slide}.svg\``,
    '- **D2 Source:**',
    '  ```d2',
    ...d2.split('\n').map((line) => `  ${line}`),
    '  ```',
  ].join('\n'));
  await writeFile(path.join(project, 'DIAGRAM_SPEC.md'), `# Diagram Spec\n\n${spec.join('\n\n')}\n`);
  return project;
}

async function roleFindings(entries) {
  const report = await jsonReport('check', 'media-spec', '--project-dir', await specProject(entries), '--profile', 'generation');
  return report.findings.filter((finding) => finding.check === 'media.diagram-roles' && finding.severity !== 'info');
}

async function legibilityFindings(svg, { manifest = (value) => value } = {}) {
  const project = await specProject([{ slide: 4, d2: 'a -> b {class: flow}' }]);
  const themes = path.resolve('skills/presentation/generate-slides/themes');
  await cp(path.join(themes, 'editorial'), path.join(project, 'themes', 'editorial'), { recursive: true });
  const manifestPath = path.join(project, 'themes', 'editorial', 'theme.json');
  await writeFile(manifestPath, JSON.stringify(manifest(JSON.parse(await readFile(manifestPath, 'utf8')))));
  await writeFile(path.join(project, 'themes', 'theme-lock.json'), JSON.stringify({ lockVersion: 1, id: 'editorial' }));
  await mkdir(path.join(project, 'images'));
  await writeFile(path.join(project, 'images', 'diagram-4.svg'), svg);
  const report = await jsonReport('check', 'media', '--project-dir', project, '--profile', 'proofread');
  return report.findings.filter((finding) => finding.check === 'media.svg-legibility' && finding.severity !== 'info');
}

const d2Svg = (width, height, font) => `<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg" data-d2-version="0.7.1" viewBox="0 0 ${width} ${height}"><svg class="d2-svg" viewBox="-89 -89 ${width} ${height}"><text x="10" y="40" style="text-anchor:middle;font-size:${font}px">Label</text><text x="10" y="90" style="text-anchor:middle;font-size:28px">Other</text></svg></svg>`;

test('media.svg-legibility passes a diagram sized through role font sizes', async () => {
  assert.deepEqual(await legibilityFindings(d2Svg(900, 240, 24)), []);
});

test('media.svg-legibility blocks a wide 16 px diagram with the numbers and a fix', async () => {
  const findings = await legibilityFindings(d2Svg(1800, 200, 16));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'blocking');
  assert.equal(findings[0].slide, 4);
  assert.equal(findings[0].path, 'images/diagram-4.svg');
  assert.match(findings[0].message, /Effective Text Size 10\.0 px is below 20 px/);
  assert.match(findings[0].evidence, /smallest text 16 px × scale 0\.63 into the 1126×252 diagram media box \(SVG 9\.00:1, box 4\.47:1\)/);
  assert.match(findings[0].remediation, /direction: down/);
});

test('media.svg-legibility names a missing theme lock as the reason it cannot check', async () => {
  const project = await specProject([{ slide: 4, d2: 'a -> b {class: flow}' }]);
  await mkdir(path.join(project, 'images'));
  await writeFile(path.join(project, 'images', 'diagram-4.svg'), d2Svg(900, 240, 24));
  const report = await jsonReport('check', 'media', '--project-dir', project, '--profile', 'proofread');
  const findings = report.findings.filter((finding) => finding.check === 'media.svg-legibility');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /no readable theme-lock\.json/);
});

test('media.diagram-roles blocks an unclosed D2 block', async () => {
  const project = await specProject([]);
  await writeFile(path.join(project, 'DIAGRAM_SPEC.md'), '## Slide 6 — Open\n- **Filename:** `images/open.svg`\n- **D2 Source:**\n  ```d2\n  a: A {style.fill: red}\n');
  const report = await jsonReport('check', 'media-spec', '--project-dir', project, '--profile', 'generation');
  const findings = report.findings.filter((finding) => finding.check === 'media.diagram-roles' && finding.severity === 'blocking');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].slide, 6);
  assert.match(findings[0].evidence, /closing fence/);
});

test('media.svg-legibility blocks when the locked theme has no diagram media box', async () => {
  const findings = await legibilityFindings(d2Svg(900, 240, 24), { manifest: (value) => { delete value.archetypes.diagram.mediaBox; return value; } });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'blocking');
  assert.match(findings[0].remediation, /refresh the theme in generate-slides/i);
});

const clean ='a: Explore {class: emphasis}\nb: Align {class: base}\ng: Team {class: boundary}\na -> b: next {class: flow}\nb -> g: maybe {class: [optional-flow]}';

test('media.diagram-roles passes a spec that styles only through Diagram Roles', async () => {
  assert.deepEqual(await roleFindings([{ slide: 2, d2: clean }]), []);
});

for (const [name, d2, evidence] of [
  ['a color literal', 'a: A {class: base}\na.style.fill: "#ff0000"', /color/],
  ['a named color', 'a: A {style.stroke: red}', /stroke/],
  ['a font-size literal', 'a: A {class: base; style.font-size: 12}', /font-size/],
  ['an unknown role class', 'a: A {class: sparkly}', /sparkly/],
  ['its own class definitions', 'classes: {base: {style.bold: true}}\na: A {class: base}', /classes/],
]) {
  test(`media.diagram-roles blocks ${name} and names the slide`, async () => {
    const findings = await roleFindings([{ slide: 2, d2: clean }, { slide: 5, d2 }]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'blocking');
    assert.equal(findings[0].slide, 5);
    assert.match(findings[0].evidence, evidence);
    assert.match(findings[0].remediation, /class: <role>/);
  });
}

async function archetypeFindings(slideClass) {
  const project = await specProject([{ slide: 1, d2: 'a -> b {class: flow}' }]);
  await writeFile(path.join(project, 'PRESENTASJON.md'), [
    '---', 'marp: true', 'theme: editorial', 'size: 16:9', 'paginate: true', 'lang: en', '---', '',
    `<!-- _class: ${slideClass} variation-default tone-dark -->`,
    '<h1 class="slot-title">Opening</h1><h2 class="slot-heading">Opening</h2>',
    '<img src="images/diagram-1.svg" alt="How work flows">', '',
  ].join('\n'));
  const report = await jsonReport('check', 'structure', '--project-dir', project, '--profile', 'generation');
  return report.findings.filter((finding) => finding.check === 'structure.diagram-archetype');
}

test('structure.diagram-archetype blocks a Diagram on a non-diagram archetype', async () => {
  const findings = await archetypeFindings('archetype-title');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'blocking');
  assert.equal(findings[0].slide, 1);
  assert.match(findings[0].message, /title archetype/);
  assert.match(findings[0].evidence, /images\/diagram-1\.svg/);
  assert.match(findings[0].remediation, /diagram archetype/);
});

test('structure.diagram-archetype passes a Diagram on the diagram archetype', async () => {
  assert.deepEqual(await archetypeFindings('archetype-diagram'), []);
});
