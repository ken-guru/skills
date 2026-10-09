// Shipped themes and brand themes, through `theme` and `check`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'rendering-slides.mjs');

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function folder() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'rendering-slides-themes-'));
  writeFileSync(path.join(directory, 'deck.md'), '---\nmarp: true\ntheme: deck\ntitle: T\nlang: en\n---\n\n# One\n');
  return directory;
}

function values(directory) {
  return JSON.parse(run(['theme-values', '--deck', directory]).out);
}

test('Editorial Inverse is a self-contained dark theme with Editorial\'s layout', () => {
  const directory = folder();
  assert.equal(run(['theme', '--deck', directory, '--name', 'editorial-inverse']).code, 0);
  const css = readFileSync(path.join(directory, 'theme.css'), 'utf8');
  assert.doesNotMatch(css, /@import\s+["']editorial["']/);
  assert.match(css, /section\.split/);
  const theme = values(directory);
  assert.notEqual(theme['--color-bg'], '#eee8dc');
  assert.equal(theme['--slot-visual'], '1164x452');
});

test('both shipped themes meet the Accessibility Bar\'s colour pairs', () => {
  for (const name of ['editorial', 'editorial-inverse']) {
    const directory = folder();
    run(['theme', '--deck', directory, '--name', name]);
    const result = run(['check', '--deck', directory]);
    assert.equal(result.code, 0, `${name}: ${result.out}`);
  }
});

function brand(directory, spec, files = {}) {
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(directory, name), content);
  writeFileSync(path.join(directory, 'brand.json'), JSON.stringify(spec));
  return run(['theme', '--deck', directory, '--brand', path.join(directory, 'brand.json')]);
}

test('a brand theme overrides colours, fonts, and the logo, and nothing else', () => {
  const directory = folder();
  const result = brand(directory, {
    base: 'editorial',
    colours: { '--color-accent': '#0b5394' },
    fonts: { '--font-heading': '"Brand Serif", Georgia, serif' },
    fontFiles: [{ family: 'Brand Serif', file: 'BrandSerif.woff2', weight: 400 }],
    logo: 'logo.svg',
  }, { 'BrandSerif.woff2': 'fake font', 'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>' });
  assert.equal(result.code, 0, result.out);
  const theme = values(directory);
  assert.equal(theme['--color-accent'], '#0b5394');
  assert.match(theme['--font-heading'], /Brand Serif/);
  assert.match(theme['--logo'], /url\("media\/brand-logo\.svg"\)/);
  assert.equal(theme['--slot-split'], '520x504');
  const css = readFileSync(path.join(directory, 'theme.css'), 'utf8');
  assert.match(css, /@font-face\s*\{[^}]*font-family:\s*"Brand Serif"[^}]*url\("fonts\/BrandSerif\.woff2"\)/);
  assert.ok(existsSync(path.join(directory, 'fonts', 'BrandSerif.woff2')));
  assert.ok(existsSync(path.join(directory, 'media', 'brand-logo.svg')));
});

test('brand colours below the bar are written as given, reported, and given a passing shade', () => {
  const directory = folder();
  const result = brand(directory, { base: 'editorial', colours: { '--color-muted': '#c8bfb5' } });
  assert.equal(result.code, 1);
  assert.match(result.out, /--color-muted \(#c8bfb5\) on --color-bg .* A shade that passes: --color-muted: #[0-9a-f]{6}/);
  assert.equal(values(directory)['--color-muted'], '#c8bfb5');
  // One colour fails several pairs; every finding must suggest the same shade, and it must pass them all.
  const shades = new Set([...result.out.matchAll(/A shade that passes: --color-muted: (#[0-9a-f]{6})/g)].map((match) => match[1]));
  assert.equal(shades.size, 1, `expected one suggested shade, got ${[...shades].join(', ')}`);
  const fixed = brand(directory, { base: 'editorial', colours: { '--color-muted': [...shades][0] } });
  assert.equal(fixed.code, 0, fixed.out);
});

test('a brand theme cannot change layout or sizing', () => {
  const directory = folder();
  const result = brand(directory, { base: 'editorial', colours: { '--slot-visual': '1280x720', '--font-size': '12px' } });
  assert.equal(result.code, 2);
  assert.match(result.out, /only colours, fonts, and the logo; it cannot set --slot-visual, --font-size/);
});
