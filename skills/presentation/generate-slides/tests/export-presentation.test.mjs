import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { marpError } from '../scripts/export-presentation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, '../scripts/export-presentation.mjs');
const stubMarp = path.resolve(here, 'fixtures/stub-marp.mjs');
const marprc = 'allowLocalFiles: true\nhtml: true\nthemeSet:\n  - ./themes/editorial/editorial.css\n';

// A bin directory holding the stub `marp` and one stub binary per browser name.
async function stubBin(browsers = []) {
  const bin = await mkdtemp(path.join(os.tmpdir(), 'stub-marp-bin-'));
  await writeFile(path.join(bin, 'marp'), `#!/bin/sh\nexec "${process.execPath}" "${stubMarp}" "$@"\n`);
  await chmod(path.join(bin, 'marp'), 0o755);
  for (const name of browsers) {
    await writeFile(path.join(bin, name), '#!/bin/sh\nexit 0\n');
    await chmod(path.join(bin, name), 0o755);
  }
  return bin;
}

async function project({ config = marprc } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'export-presentation-'));
  await writeFile(path.join(directory, 'DISCOVERY.json'), JSON.stringify({ paths: { presentation: 'deck.md', html: 'deck.html', pdf: 'deck.pdf' } }));
  await writeFile(path.join(directory, 'deck.md'), '---\nmarp: true\n---\n\n# Slide\n');
  await writeFile(path.join(directory, '.marprc.yml'), config);
  return directory;
}

function exportDeck(directory, { bin, env = {} }) {
  return new Promise((resolve, reject) => {
    const log = path.join(directory, '..', `${path.basename(directory)}-marp.log`);
    const child = spawn(process.execPath, [script, directory], { env: { PATH: bin, STUB_MARP_LOG: log, ...env } });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', async (code) => {
      const calls = existsSync(log) ? (await readFile(log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line)) : [];
      resolve({ code, output, calls });
    });
  });
}

test('HTML and PDF export in one call with the configured browser', async () => {
  const directory = await project();

  const result = await exportDeck(directory, { bin: await stubBin() });

  assert.equal(result.code, 0, result.output);
  assert.ok(existsSync(path.join(directory, 'deck.html')));
  assert.ok(existsSync(path.join(directory, 'deck.pdf')));
  assert.deepEqual(result.calls, [['deck.md', '-o', 'deck.html'], ['deck.md', '--pdf', '-o', 'deck.pdf']]);
  assert.equal(await readFile(path.join(directory, '.marprc.yml'), 'utf8'), marprc);
});

test('a failed PDF export retries stable browsers in order and saves the first that works', async () => {
  const directory = await project();
  const bin = await stubBin(['google-chrome-canary', 'google-chrome-stable', 'chromium', 'firefox']);

  const result = await exportDeck(directory, { bin, env: { STUB_MARP_PDF_DEFAULT: 'fail', STUB_MARP_GOOD: 'chromium,firefox' } });

  assert.equal(result.code, 0, result.output);
  const tried = result.calls.filter((args) => args.includes('--browser-path') && args.at(-1).startsWith(bin)).map((args) => path.basename(args.at(-1)));
  assert.deepEqual(tried, ['google-chrome-stable', 'chromium']);
  const config = await readFile(path.join(directory, '.marprc.yml'), 'utf8');
  assert.equal(config, `${marprc}browser: chrome\nbrowserPath: ${JSON.stringify(path.join(bin, 'chromium'))}\n`);
  assert.match(result.output, /chromium; saved to \.marprc\.yml/);
});

test('a saved browser that stops working is replaced, not retried', async () => {
  const bin = await stubBin(['google-chrome-stable', 'microsoft-edge']);
  const stale = path.join(bin, 'google-chrome-stable');
  const directory = await project({ config: `${marprc}browser: chrome\nbrowserPath: ${JSON.stringify(stale)}\n` });

  const result = await exportDeck(directory, { bin, env: { STUB_MARP_PDF_DEFAULT: 'fail', STUB_MARP_GOOD: 'microsoft-edge' } });

  assert.equal(result.code, 0, result.output);
  const tried = result.calls.filter((args) => args.includes('--browser-path') && args.at(-1).startsWith(bin)).map((args) => path.basename(args.at(-1)));
  assert.deepEqual(tried, ['microsoft-edge']);
  const config = await readFile(path.join(directory, '.marprc.yml'), 'utf8');
  assert.match(config, /^browser: edge$/m);
  assert.equal(config.match(/^browser:/gm).length, 1);
});

test('no working browser blocks with the install message and leaves the config alone', async () => {
  const directory = await project();

  const result = await exportDeck(directory, { bin: await stubBin(['google-chrome-stable']), env: { STUB_MARP_PDF_DEFAULT: 'fail' } });

  assert.equal(result.code, 1);
  assert.match(result.output, /Marp found no local browser that could export the PDF\. Install Chrome, Edge, or Firefox, then rerun\./);
  assert.match(result.output, / {3}Failed converting Markdown\. \(No suitable browser found\. Please ensure one of the following browsers is installed: chrome\)\n/);
  assert.doesNotMatch(result.output, /Node\.js v|errorCode|^\s+at /m);
  assert.equal(await readFile(path.join(directory, '.marprc.yml'), 'utf8'), marprc);
});

test('missing Marp, missing Discovery, and bad arguments exit 2', async () => {
  const empty = await mkdtemp(path.join(os.tmpdir(), 'empty-bin-'));

  const noMarp = await exportDeck(await project(), { bin: empty });
  assert.equal(noMarp.code, 2);
  assert.match(noMarp.output, /marp-cli not installed/);

  const noDiscovery = await exportDeck(await mkdtemp(path.join(os.tmpdir(), 'no-discovery-')), { bin: await stubBin() });
  assert.equal(noDiscovery.code, 2);
});

// A project whose Markdown references local media in both forms Generation uses,
// plus a remote image, and whose Marp configuration loads one theme CSS file.
async function projectWithMedia() {
  const directory = await project();
  await mkdir(path.join(directory, 'images'));
  await mkdir(path.join(directory, 'themes/editorial'), { recursive: true });
  await writeFile(path.join(directory, 'images/flow.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(path.join(directory, 'images/photo.png'), 'png bytes');
  await writeFile(path.join(directory, 'themes/editorial/editorial.css'), '/* @theme editorial */');
  await writeFile(path.join(directory, 'deck.md'), [
    '---', 'marp: true', '---', '',
    '<img src="images/flow.svg" alt="Flow">', '',
    '![Photo](images/photo.png)', '',
    '![Remote](https://example.com/remote.png)', '',
  ].join('\n'));
  return directory;
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

test('a successful export records what it was built from in export-lock.json', async () => {
  const directory = await projectWithMedia();

  const result = await exportDeck(directory, { bin: await stubBin() });

  assert.equal(result.code, 0, result.output);
  const lock = JSON.parse(await readFile(path.join(directory, 'export-lock.json'), 'utf8'));
  assert.deepEqual(Object.keys(lock.files).sort(), ['deck.md', 'images/flow.svg', 'images/photo.png', 'themes/editorial/editorial.css']);
  assert.equal(lock.files['images/flow.svg'], sha256('<svg xmlns="http://www.w3.org/2000/svg"/>'));
  assert.equal(lock.files['themes/editorial/editorial.css'], sha256('/* @theme editorial */'));
});

test('the lock reads every reference form and records media not rendered yet as null', async () => {
  const directory = await project({ config: 'themeSet: [./themes/a.css, "./themes/b.css"] # two themes\n' });
  await mkdir(path.join(directory, 'images'));
  await mkdir(path.join(directory, 'themes'));
  await writeFile(path.join(directory, 'images/my photo.png'), 'png');
  await writeFile(path.join(directory, 'themes/a.css'), '/* a */');
  await writeFile(path.join(directory, 'themes/b.css'), '/* b */');
  await writeFile(path.join(directory, 'deck.md'), [
    '---', 'marp: true', '---', '',
    '![Photo](<images/my photo.png>)', '',
    '<img src="images/later.svg" alt="Rendered after Generation">', '',
    '![Odd](images/100%zz.png)', '',
    '<style>section { background: url(src="images/not-media.png") }</style>', '',
  ].join('\n'));

  const result = await exportDeck(directory, { bin: await stubBin() });

  assert.equal(result.code, 0, result.output);
  const { files } = JSON.parse(await readFile(path.join(directory, 'export-lock.json'), 'utf8'));
  assert.deepEqual(Object.keys(files).sort(), ['deck.md', 'images/100%zz.png', 'images/later.svg', 'images/my photo.png', 'themes/a.css', 'themes/b.css']);
  assert.equal(files['images/later.svg'], null);
  assert.equal(files['images/my photo.png'], sha256('png'));
});

test('a failed export leaves export-lock.json untouched', async () => {
  const directory = await projectWithMedia();
  await writeFile(path.join(directory, 'export-lock.json'), '{"previous":true}');

  for (const env of [{ STUB_MARP_HTML: 'fail' }, { STUB_MARP_PDF_DEFAULT: 'fail' }]) {
    const result = await exportDeck(directory, { bin: await stubBin(), env });
    assert.equal(result.code, 1, result.output);
    assert.equal(await readFile(path.join(directory, 'export-lock.json'), 'utf8'), '{"previous":true}');
  }
});

test('a browser saved to the Marp configuration does not change the fingerprints', async () => {
  const directory = await projectWithMedia();
  const bin = await stubBin(['chromium']);
  await exportDeck(directory, { bin });
  const before = await readFile(path.join(directory, 'export-lock.json'), 'utf8');

  const fallback = await exportDeck(directory, { bin, env: { STUB_MARP_PDF_DEFAULT: 'fail', STUB_MARP_GOOD: 'chromium' } });

  assert.equal(fallback.code, 0, fallback.output);
  assert.match(await readFile(path.join(directory, '.marprc.yml'), 'utf8'), /^browserPath:/m);
  assert.equal(await readFile(path.join(directory, 'export-lock.json'), 'utf8'), before);
});

test('a Marp error keeps its indented lines across blank ones', () => {
  const output = [
    '[ ERROR ] Failed converting Markdown. (Failed to launch the browser process!',
    '          Code: 1',
    '',
    '          stderr:',
    '          Trace/breakpoint trap)',
    'Error: Failed to launch the browser process!',
    '    at onClose (/opt/marp-cli/lib/launcher.js:1:1)',
  ].join('\n');
  assert.equal(marpError(output), '   Failed converting Markdown. (Failed to launch the browser process! Code: 1 stderr: Trace/breakpoint trap)');
});
