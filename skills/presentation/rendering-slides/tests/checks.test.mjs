// The Accessibility Bar's scripted checks, through `check` and `render`.
// Each rule has a deck that breaks it and must fail with a specific message.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'rendering-slides.mjs');

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 240_000 });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const FRONT = '---\nmarp: true\ntheme: deck\ntitle: Test deck\nlang: en\npaginate: true\n---\n\n';

function deck(body, { front = FRONT, files = {} } = {}) {
  const directory = path.join(mkdtempSync(path.join(os.tmpdir(), 'rendering-slides-check-')), 'deck');
  mkdirSync(path.join(directory, 'media'), { recursive: true });
  writeFileSync(path.join(directory, 'deck.md'), `${front}${body}`);
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(directory, name), content);
  const themed = run(['theme', '--deck', directory, '--name', 'editorial']);
  assert.equal(themed.code, 0, themed.out);
  return directory;
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const hasTools = run(['setup', '--status']).code === 0;
const needsTools = { skip: hasTools ? false : 'Marp CLI or browser missing: run `node scripts/rendering-slides.mjs setup`' };

function expectFinding(directory, pattern) {
  const result = run(['check', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, pattern);
  return result;
}

test('a clean deck passes the source checks', () => {
  const directory = deck('# Hello\n\nA slide.\n\n---\n\n## Second\n\n![A bar chart of revenue rising](media/a.svg)\n', { files: { 'media/a.svg': SVG } });
  const result = run(['check', '--deck', directory]);
  assert.equal(result.code, 0, result.out);
});

test('a slide without a heading fails', () => {
  expectFinding(deck('# One\n\n---\n\nJust text, no heading.\n'), /Slide 2 \[heading\]: has no visible heading/);
});

test('repeated headings on split slides are allowed', () => {
  const result = run(['check', '--deck', deck('## Results\n\nPart one.\n\n---\n\n## Results\n\nPart two.\n')]);
  assert.equal(result.code, 0, result.out);
});

test('an image without alt text fails unless marked decorative', () => {
  expectFinding(deck('# One\n\n![](media/a.svg)\n', { files: { 'media/a.svg': SVG } }), /Slide 1 \[alt-text\]/);
  const marked = run(['check', '--deck', deck('# One\n\n![](media/a.svg) <!-- decorative -->\n', { files: { 'media/a.svg': SVG } })]);
  assert.equal(marked.code, 0, marked.out);
});

test('an image that does not exist in the Deck Folder fails', () => {
  expectFinding(deck('# One\n\n![A diagram of the request path](media/request-path.svg)\n'), /Slide 1 \[missing-image\]: .*media\/request-path\.svg/);
});

test('content in a background image fails', () => {
  expectFinding(deck('# One\n\n![bg right A chart of sales](media/a.svg)\n', { files: { 'media/a.svg': SVG } }), /\[background-image\]/);
});

test('missing lang and title fail', () => {
  const result = expectFinding(deck('# One\n', { front: '---\nmarp: true\ntheme: deck\n---\n\n' }), /\[lang\]/);
  assert.match(result.out, /\[title\]/);
});

test('bare URLs and "click here" as link text fail', () => {
  const result = expectFinding(deck('# One\n\nSee https://example.com/report and [click here](https://example.com).\n'), /\[link-text\]: has a bare URL/);
  assert.match(result.out, /link text "click here"/);
});

test('a generated image needs the AI-generated alt prefix and a visible label', () => {
  const directory = deck('# One\n\n![A harbour at dawn](media/h.png)\n', {
    files: { 'media/h.png': 'x', 'media/h.json': JSON.stringify({ provider: 'openai', model: 'gpt-image-1-mini', prompt: 'p', date: '2026-10-09' }) },
  });
  const result = expectFinding(directory, /alt text does not start with "AI-generated:"/);
  assert.match(result.out, /without a visible "AI-generated illustration" label/);
});

test('theme colours below the contrast bar are reported with a passing shade', () => {
  const directory = deck('# One\n');
  const css = readFileSync(path.join(directory, 'theme.css'), 'utf8').replace(/--color-muted:\s*#[0-9a-f]+;/i, '--color-muted: #b8aeb2;');
  writeFileSync(path.join(directory, 'theme.css'), css);
  const result = expectFinding(directory, /--color-muted \(#b8aeb2\) on --color-bg .* needs 4\.5:1\. A shade that passes: --color-muted: #[0-9a-f]{6}/);
  assert.match(result.out, /\[theme-contrast\]/);
});

test('render ends with the checks and reports rendered text below 20 px', needsTools, () => {
  const directory = deck('# One\n\n<span style="font-size:12px">tiny print</span>\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /Slide 1 \[text-size\]: has 12px text/);
});

test('render reports low-contrast rendered text', needsTools, () => {
  const directory = deck('# One\n\n<span style="color:#d8d0c4">faint text</span>\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /Slide 1 \[contrast\]: has text \("faint text"\)/);
});

test('a clean render passes every check, including the tagged PDF and its outline', needsTools, () => {
  const directory = deck('# One\n\nBody text.\n\n---\n\n## Two\n\n- A point\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Accessibility Bar: all scripted checks pass/);
});
