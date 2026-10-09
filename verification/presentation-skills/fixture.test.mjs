// End-to-end fixture: a Deck Folder with a diagram, a chart, and a decorative
// image is built with creating-diagrams and creating-charts, rendered by
// rendering-slides in each shipped theme, and must pass every scripted check.
// Needs the pinned tools: run each skill's `setup` first. Skipped, loudly, otherwise.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = path.join(root, 'verification', 'presentation-skills', 'fixture');
const scripts = {
  diagrams: path.join(root, 'skills', 'creating-diagrams', 'scripts', 'creating-diagrams.mjs'),
  charts: path.join(root, 'skills', 'creating-charts', 'scripts', 'creating-charts.mjs'),
  rendering: path.join(root, 'skills', 'presentation', 'rendering-slides', 'scripts', 'rendering-slides.mjs'),
};

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 300_000 });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const ready = Object.values(scripts).every(existsSync) && Object.values(scripts).every((script) => run(script, ['setup', '--status']).code === 0);
const needsTools = { skip: ready ? false : 'pinned tools missing: run setup for creating-diagrams, creating-charts, and rendering-slides' };
const themes = existsSync(path.join(root, 'skills', 'presentation', 'rendering-slides', 'themes', 'editorial-inverse.css')) ? ['editorial', 'editorial-inverse'] : ['editorial'];

for (const theme of themes) {
  test(`the fixture deck renders and passes every scripted check in ${theme}`, needsTools, () => {
    const deck = path.join(mkdtempSync(path.join(os.tmpdir(), 'fixture-deck-')), 'deck');
    cpSync(fixture, deck, { recursive: true });
    const step = (script, args) => {
      const result = run(script, args);
      assert.equal(result.code, 0, `${path.basename(script)} ${args[0]}: ${result.out}`);
      return result.out;
    };
    step(scripts.rendering, ['theme', '--deck', deck, '--name', theme]);
    const values = path.join(deck, 'theme-values.json');
    writeFileSync(values, step(scripts.rendering, ['theme-values', '--deck', deck]));
    const slots = JSON.parse(step(scripts.rendering, ['theme-values', '--deck', deck]));
    step(scripts.diagrams, ['render', path.join(deck, 'media', 'request-path.d2'), '--out', path.join(deck, 'media', 'request-path.svg'), '--theme', values, '--slot', slots['--slot-visual']]);
    step(scripts.charts, ['render', path.join(deck, 'media', 'requests.vl.json'), '--data', path.join(deck, 'media', 'requests.csv'), '--out', path.join(deck, 'media', 'requests.svg'), '--theme', values, '--slot', slots['--slot-split'], '--alt', 'Requests rose from 12 to 24 million per month between Q1 and Q4', '--source', 'platform metrics, 2026']);
    const rendered = step(scripts.rendering, ['render', '--deck', deck, '--images']);
    assert.match(rendered, /Accessibility Bar: all scripted checks pass/);
    for (const file of ['deck.html', 'deck.pdf', 'deck-notes.md']) assert.ok(existsSync(path.join(deck, 'dist', file)), file);
    // dist/ is self-contained: every image the HTML deck uses is found from dist/.
    const html = readFileSync(path.join(deck, 'dist', 'deck.html'), 'utf8');
    const sources = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]).filter((src) => !/^(data|https?):/.test(src));
    assert.ok(sources.length >= 3, `expected the fixture's images in deck.html, found ${sources.length}`);
    for (const src of sources) assert.ok(existsSync(path.join(deck, 'dist', decodeURI(src))), `dist/${src} is missing, so the HTML deck shows a broken image`);
    // CI keeps the slide images so a person can review them when themes or pins change.
    if (process.env.FIXTURE_SLIDES_DIR) cpSync(path.join(deck, 'dist', 'slides'), path.join(process.env.FIXTURE_SLIDES_DIR, theme), { recursive: true });
  });
}
