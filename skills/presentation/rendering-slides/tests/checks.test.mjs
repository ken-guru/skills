// The Accessibility Bar's scripted checks and the untrusted-Deck-Folder rules, through
// `check` and `render`. Each rule has a deck that breaks it and must fail with a specific message.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

// The Deck Folder is untrusted: nothing in it may pull files from outside it into a render.
test('an image path that leaves the Deck Folder fails', () => {
  expectFinding(deck('# One\n\n![A key](../secret.png)\n'), /Slide 1 \[asset-path\]: .*\.\.\/secret\.png/);
});

test('a deck style that loads a local file by URL fails', needsTools, () => {
  expectFinding(deck('# One\n\n<style scoped>section { background: url("file:///etc/key.png"); }</style>\n'), /\[asset-path\]: .*file:\/\/\/etc\/key\.png.*scheme other than https:/);
});

test('a theme that imports a stylesheet from outside the Deck Folder fails', needsTools, () => {
  const directory = deck('# One\n');
  writeFileSync(path.join(directory, 'theme.css'), `${readFileSync(path.join(directory, 'theme.css'), 'utf8')}\n@import url("/home/someone/notes.css");\n`);
  expectFinding(directory, /\[asset-path\]: .*\/home\/someone\/notes\.css.*absolute path/);
});

// The asset check reads Marp's own output, so every way Markdown or CSS can name a file is covered.
test('every Markdown and CSS form of a reference that leaves the Deck Folder fails', needsTools, () => {
  const cases = [
    ['a reference-style image', '# One\n\n![A key][k]\n\n[k]: ../ref.png\n', /Slide 1 \[asset-path\]: .*\.\.\/ref\.png/],
    ['an angle-bracket destination', '# One\n\n![A key](<../angle.png>)\n', /Slide 1 \[asset-path\]: .*\.\.\/angle\.png/],
    ['a single-quoted title', "# One\n\n![A key](../titled.png 'x')\n", /Slide 1 \[asset-path\]: .*\.\.\/titled\.png/],
    ['a backslash path', '# One\n\n![A key](..\\back.png)\n', /\[asset-path\]: .*back\.png/],
    ['an indented fence before the image', '# One\n\ntext\n    ```\n![A key](../fence.png)\n', /\[asset-path\]: .*\.\.\/fence\.png/],
    ['a front-matter style block', '# One\n', /\[asset-path\]: .*\/etc\/fm\.png/, `${FRONT.replace(/---\n\n$/, '')}style: |\n  section { background: url("/etc/fm.png"); }\n---\n\n`],
    ['image-set()', '# One\n\n<style scoped>section { background-image: image-set("/etc/set.png" 1x); }</style>\n', /\[asset-path\]: .*\/etc\/set\.png/],
    ['an escaped url()', '# One\n\n<style scoped>section { background: u\\72l("../esc.png"); }</style>\n', /\[asset-path\]: .*\.\.\/esc\.png/],
    ['escaped dots', '# One\n\n<style scoped>section { background: url("a/\\2e\\2e/\\2e\\2e/x.png"); }</style>\n', /\[asset-path\]: .*leaves the Deck Folder/],
    ['@import without a space', '# One\n\n<style>@import"../x.css";</style>\n', /\[asset-path\]: .*\.\.\/x\.css/],
  ];
  for (const [form, body, pattern, front] of cases) {
    const result = run(['check', '--deck', deck(body, front ? { front } : {})]);
    assert.equal(result.code, 1, `${form}: ${result.out}`);
    assert.match(result.out, pattern, form);
  }
});

test('render refuses a deck holding a script and a file:// iframe before anything is rendered', needsTools, () => {
  const directory = deck('# One\n\n<script>fetch("file:///etc/hostname")</script>\n\n<iframe src="file:///etc/hostname"></iframe>\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /\[raw-html\]: .*<script>/);
  assert.match(result.out, /\[raw-html\]: .*<iframe>/);
  assert.equal(existsSync(path.join(directory, 'dist')), false);
});

test('a <span> with attributes other than lang fails', () => {
  expectFinding(deck('# One\n\n<span style="font-size:12px">tiny</span>\n'), /Slide 1 \[raw-html\]: .*<span style>/);
});

test('render refuses a deck that reaches outside its folder before anything is rendered', needsTools, () => {
  const directory = deck('# One\n\n![A key](../secret.png)\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /Slide 1 \[asset-path\]/);
  assert.equal(existsSync(path.join(directory, 'dist')), false);
});

test('raw HTML other than <span lang> and <br> fails, naming the tag', () => {
  const result = expectFinding(deck('# One\n\n<div class="note">Hi</div>\n\n<script>alert(1)</script>\n'), /Slide 1 \[raw-html\]: .*<div>/);
  assert.match(result.out, /Slide 1 \[raw-html\]: .*<script>/);
});

test('<span lang>, <br>, scoped styles, comments, code, and autolinks are not raw HTML', () => {
  const body = '# One <span lang="fr">bonjour</span>\n\nLine<br>break, see <https://example.com/report>.\n\n<style scoped>p { color: #1f2328; }</style>\n\n<!-- A speaker note with <b>tags</b> -->\n\n`<div>` inline\n\n```html\n<div>shown as code</div>\n```\n';
  const result = run(['check', '--deck', deck(body)]);
  assert.equal(result.code, 0, result.out);
});

test('theme colours below the contrast bar are reported with a passing shade', () => {
  const directory = deck('# One\n');
  const css = readFileSync(path.join(directory, 'theme.css'), 'utf8').replace(/--color-muted:\s*#[0-9a-f]+;/i, '--color-muted: #b8aeb2;');
  writeFileSync(path.join(directory, 'theme.css'), css);
  const result = expectFinding(directory, /--color-muted \(#b8aeb2\) on --color-bg .* needs 4\.5:1\. A shade that passes: --color-muted: #[0-9a-f]{6}/);
  assert.match(result.out, /\[theme-contrast\]/);
});

test('render ends with the checks and reports rendered text below 20 px', needsTools, () => {
  const directory = deck('# One\n\n<style scoped>p { font-size: 12px; }</style>\n\ntiny print\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /Slide 1 \[text-size\]: has 12px text/);
});

test('render reports low-contrast rendered text', needsTools, () => {
  const directory = deck('# One\n\n<style scoped>p { color: #d8d0c4; }</style>\n\nfaint text\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /Slide 1 \[contrast\]: has text \("faint text"\)/);
});

test('render ignores a Marp config file in the Deck Folder', needsTools, () => {
  const directory = deck('# One\n\nBody text.\n');
  const marker = path.join(directory, 'config-ran');
  writeFileSync(path.join(directory, 'marp.config.mjs'), `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'ran');\nexport default { html: true };\n`);
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 0, result.out);
  assert.equal(existsSync(marker), false, 'marp.config.mjs from the Deck Folder ran');
});

// MARP_TEST_CI turns off Marp's "inside a container" guess, so this behaves as on an ordinary host.
test('Marp keeps the browser sandbox on and its temp files out of $HOME', { skip: needsTools.skip || (process.platform !== 'linux' && 'Linux only') }, () => {
  const directory = deck('# One\n\nBody text.\n');
  const status = run(['setup', '--status']).out;
  const browser = status.match(/Browser at (.+) \(from/)[1];
  const marp = status.match(/Marp CLI at (.+) \(from/)[1];
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'logged-browser-'));
  const log = path.join(scratch, 'args.log');
  const wrapper = path.join(scratch, 'chrome');
  writeFileSync(wrapper, `#!/bin/sh\necho "$@" >> ${JSON.stringify(log)}\nexec ${JSON.stringify(browser)} "$@"\n`);
  chmodSync(wrapper, 0o755);
  // Sandboxes make $HOME read-only, and Marp writes its temp page there on Linux.
  const home = mkdtempSync(path.join(os.tmpdir(), 'home-'));
  chmodSync(home, 0o555);
  const result = run(['render', '--deck', directory], { CHROME_PATH: wrapper, MARP_CLI_PATH: marp, HOME: home, MARP_TEST_CI: '1', MARP_USER: '' });
  chmodSync(home, 0o755);
  assert.equal(result.code, 0, result.out);
  assert.doesNotMatch(readFileSync(log, 'utf8'), /--no-sandbox/);
});

test('a clean render passes every check, including the tagged PDF and its outline', needsTools, () => {
  const directory = deck('# One\n\nBody text.\n\n---\n\n## Two\n\n- A point\n');
  const result = run(['render', '--deck', directory]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Accessibility Bar: all scripted checks pass/);
});
