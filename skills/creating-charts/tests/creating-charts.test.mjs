// Exercises creating-charts through its command interface only.
// Rendering tests need vl-convert: run `node scripts/creating-charts.mjs setup`
// first, or set VL_CONVERT_PATH. They are skipped, loudly, when it is missing.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'creating-charts.mjs');

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function scratch() {
  return mkdtempSync(path.join(os.tmpdir(), 'creating-charts-test-'));
}

function write(directory, name, text) {
  const file = path.join(directory, name);
  writeFileSync(file, typeof text === 'string' ? text : JSON.stringify(text, null, 2));
  return file;
}

const BAR = {
  mark: 'bar',
  encoding: {
    x: { field: 'quarter', type: 'nominal', title: 'Quarter' },
    y: { field: 'revenue', type: 'quantitative', title: 'Revenue (MNOK)' },
  },
};
const CSV = 'quarter,revenue\nQ1,12\nQ2,15\nQ3,21\nQ4,24\n';

const hasTool = run(['setup', '--status']).code === 0;
const needsTool = { skip: hasTool ? false : 'vl-convert not installed: run `node scripts/creating-charts.mjs setup`' };

function chart(directory, extra = []) {
  const spec = write(directory, 'revenue.vl.json', BAR);
  const data = write(directory, 'revenue.csv', CSV);
  const out = path.join(directory, 'out', 'revenue.svg');
  return { spec, data, out, result: run(['render', spec, '--data', data, '--out', out, '--alt', 'Revenue doubled from Q1 to Q4.', '--source', 'Finance report 2026', ...extra]) };
}

test('a render without vl-convert names the exact setup command', () => {
  const directory = scratch();
  const spec = write(directory, 'a.vl.json', BAR);
  const data = write(directory, 'a.csv', CSV);
  const result = run(['render', spec, '--data', data, '--out', path.join(directory, 'a.svg'), '--alt', 'x', '--source', 'y'], {
    VL_CONVERT_PATH: '', KEN_GURU_SKILLS_CACHE: directory, PATH: path.dirname(process.execPath),
  });
  assert.equal(result.code, 2);
  assert.match(result.out, /node scripts\/creating-charts\.mjs setup/);
});

test('numbers typed into the spec are rejected: data must come from a file', () => {
  const directory = scratch();
  const spec = write(directory, 'a.vl.json', { ...BAR, data: { values: [{ quarter: 'Q1', revenue: 12 }] } });
  const result = run(['check', spec, '--data', write(directory, 'a.csv', CSV)]);
  assert.equal(result.code, 1);
  assert.match(result.out, /data must come from the --data file/);
});

test('a render needs alt text and a source', () => {
  const directory = scratch();
  const spec = write(directory, 'a.vl.json', BAR);
  const result = run(['render', spec, '--data', write(directory, 'a.csv', CSV), '--out', path.join(directory, 'a.svg')]);
  assert.equal(result.code, 2);
  assert.match(result.out, /--alt/);
  assert.match(result.out, /--source/);
});

test('render writes the SVG, a PNG preview, and a notes block with alt text, source, and data table', needsTool, () => {
  const directory = scratch();
  const { out, result } = chart(directory);
  assert.equal(result.code, 0, result.out);
  for (const extension of ['.svg', '.png', '.md', '.vl.json', '.csv']) assert.ok(existsSync(out.replace(/\.svg$/, extension)), `missing ${extension}`);
  const notes = readFileSync(out.replace(/\.svg$/, '.md'), 'utf8');
  assert.match(notes, /Revenue doubled from Q1 to Q4\./);
  assert.match(notes, /Source: Finance report 2026/);
  assert.match(notes, /\| Q3 \| 21 \|/);
  assert.match(readFileSync(out, 'utf8'), /^<svg\b[^>]*><title>Revenue doubled from Q1 to Q4\.<\/title>/);
});

test('text smaller than 20 px at slot size fails the check', needsTool, () => {
  const directory = scratch();
  const spec = write(directory, 'a.vl.json', { ...BAR, config: { axis: { labelFontSize: 12 } } });
  const result = run(['check', spec, '--data', write(directory, 'a.csv', CSV)]);
  assert.equal(result.code, 1);
  assert.match(result.out, /12 px.*below 20 px/);
});

test('every shipped example passes the check', needsTool, () => {
  const examples = path.join(skill, 'examples');
  for (const name of readdirSync(examples).filter((file) => file.endsWith('.vl.json'))) {
    const result = run(['check', path.join(examples, name), '--data', path.join(examples, name.replace('.vl.json', '.csv'))]);
    assert.equal(result.code, 0, `${name}: ${result.out}`);
  }
});

test('theme colours that would make marks too faint are refused before rendering', () => {
  const directory = scratch();
  const theme = write(directory, 'theme.json', { '--color-bg': '#ffffff', '--color-accent': '#f4f4f4' });
  const result = run(['check', write(directory, 'a.vl.json', BAR), '--data', write(directory, 'a.csv', CSV), '--theme', theme]);
  assert.equal(result.code, 1);
  assert.match(result.out, /--color-accent \(#f4f4f4\).*3:1/);
});

test('theme values colour the marks', needsTool, () => {
  const directory = scratch();
  const theme = write(directory, 'theme.json', { '--color-bg': '#eee8dc', '--color-text': '#321f2e', '--color-surface': '#fffaf0', '--color-muted': '#5a4653', '--color-accent': '#c63f32', '--color-on-accent': '#fffaf0' });
  const { out, result } = chart(directory, ['--theme', theme]);
  assert.equal(result.code, 0, result.out);
  assert.match(readFileSync(out, 'utf8').toLowerCase(), /#c63f32/);
});
