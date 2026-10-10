// Exercises creating-diagrams through its command interface only.
// Rendering tests need D2: run `node scripts/creating-diagrams.mjs setup` first,
// or set D2_PATH. They are skipped, loudly, when D2 is unavailable.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'creating-diagrams.mjs');

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function scratch() {
  return mkdtempSync(path.join(os.tmpdir(), 'creating-diagrams-test-'));
}

function write(directory, name, text) {
  const file = path.join(directory, name);
  writeFileSync(file, text);
  return file;
}

const hasD2 = run(['setup', '--status']).code === 0;
const needsD2 = { skip: hasD2 ? false : 'D2 not installed: run `node scripts/creating-diagrams.mjs setup`' };

test('a render without D2 names the exact setup command', () => {
  const directory = scratch();
  const input = write(directory, 'a.d2', 'a: Browser { class: base }\n');
  const result = run(['render', input, '--out', path.join(directory, 'a.svg')], {
    D2_PATH: '', KEN_GURU_SKILLS_CACHE: directory, PATH: path.dirname(process.execPath),
  });
  assert.equal(result.code, 2);
  assert.match(result.out, /node scripts\/creating-diagrams\.mjs setup/);
});

test('colour literals are rejected before anything renders', () => {
  const directory = scratch();
  const input = write(directory, 'a.d2', 'a: Browser { style.fill: "#ff0000" }\n');
  const result = run(['render', input, '--out', path.join(directory, 'a.svg')]);
  assert.equal(result.code, 1);
  assert.match(result.out, /line 1: sets fill directly/);
  assert.equal(existsSync(path.join(directory, 'a.svg')), false);
});

test('unknown role classes and legends are rejected', () => {
  const directory = scratch();
  const input = write(directory, 'a.d2', 'a: A { class: highlight }\nvars: { d2-legend: { x: y } }\n');
  const result = run(['check', input]);
  assert.equal(result.code, 1);
  assert.match(result.out, /unknown role class "highlight"/);
  assert.match(result.out, /legend/);
});

test('silent label pitfalls are caught', () => {
  const directory = scratch();
  const input = write(directory, 'a.d2', 'step: Fix issue #42\nother: Read; then write\n');
  const result = run(['check', input]);
  assert.equal(result.code, 1);
  assert.match(result.out, /line 1: unquoted label contains "#"/);
  assert.match(result.out, /line 2: unquoted label contains ";"/);
});

test('render writes the SVG with PNG and ASCII previews and reports legibility', needsD2, () => {
  const directory = scratch();
  const input = write(directory, 'flow.d2', 'direction: right\na: Browser { class: base }\nb: API { class: emphasis }\na -> b: request { class: flow }\n');
  const out = path.join(directory, 'flow.svg');
  const result = run(['render', input, '--out', out]);
  assert.equal(result.code, 0, result.out);
  for (const extension of ['.svg', '.png', '.txt']) assert.ok(existsSync(out.replace(/\.svg$/, extension)), `missing ${extension}`);
  assert.match(result.out, /Effective Text Size \d+(\.\d)? px/);
  assert.match(result.out, /Labels: Browser, API, request/);
});

test('theme values colour the roles', needsD2, () => {
  const directory = scratch();
  const theme = write(directory, 'theme.json', JSON.stringify({ '--color-bg': '#eee8dc', '--color-text': '#321f2e', '--color-surface': '#fffaf0', '--color-muted': '#5a4653', '--color-accent': '#c63f32', '--color-on-accent': '#fffaf0' }));
  const input = write(directory, 'a.d2', 'a: Risk { class: risk }\n');
  const out = path.join(directory, 'a.svg');
  const result = run(['render', input, '--out', out, '--theme', theme]);
  assert.equal(result.code, 0, result.out);
  assert.match(readFileSync(out, 'utf8').toLowerCase(), /#c63f32/);
});

test('a diagram too wide for its slot fails the check and writes nothing', needsD2, () => {
  const directory = scratch();
  const steps = Array.from({ length: 10 }, (_, index) => `s${index}: Step number ${index} { class: base }`);
  const links = Array.from({ length: 9 }, (_, index) => `s${index} -> s${index + 1} { class: flow }`);
  const input = write(directory, 'wide.d2', ['direction: right', ...steps, ...links, ''].join('\n'));
  const before = readdirSync(directory).length;
  const result = run(['check', input, '--slot', '600x200']);
  assert.equal(result.code, 1);
  assert.match(result.out, /below 20 px/);
  assert.match(result.out, /split it into two diagrams/);
  assert.equal(readdirSync(directory).length, before);
});

test('every shipped example passes the check at the default slot', needsD2, () => {
  const examples = path.join(skill, 'examples');
  for (const name of readdirSync(examples).filter((file) => file.endsWith('.d2'))) {
    const result = run(['check', path.join(examples, name)]);
    assert.equal(result.code, 0, `${name}: ${result.out}`);
  }
});
