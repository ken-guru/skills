// Diagram checks through the public CLI: the Media Spec role check
// (media.diagram-roles) and Effective Text Size (media.svg-legibility).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
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

const clean = 'a: Explore {class: emphasis}\nb: Align {class: base}\ng: Team {class: boundary}\na -> b: next {class: flow}\nb -> g: maybe {class: [optional-flow]}';

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
