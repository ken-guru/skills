import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const executable = path.resolve(here, '../scripts/generate-slides');
const stubMarp = path.resolve(here, 'fixtures/stub-marp.mjs');
const marprc = 'allowLocalFiles: true\nhtml: true\nthemeSet:\n  - ./themes/editorial/editorial.css\n';

// A bin directory holding the stub `marp`, `node`, and one stub binary per browser name.
async function stubBin(browsers = []) {
  const bin = await mkdtemp(path.join(os.tmpdir(), 'stub-marp-bin-'));
  await writeFile(path.join(bin, 'marp'), `#!/bin/sh\nexec "${process.execPath}" "${stubMarp}" "$@"\n`);
  await writeFile(path.join(bin, 'node'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`);
  for (const name of ['marp', 'node']) await chmod(path.join(bin, name), 0o755);
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
    const child = spawn(executable, ['export', directory], { env: { PATH: bin, STUB_MARP_LOG: log, ...env } });
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
  await writeFile(path.join(empty, 'node'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`);
  await chmod(path.join(empty, 'node'), 0o755);

  const noMarp = await exportDeck(await project(), { bin: empty });
  assert.equal(noMarp.code, 2);
  assert.match(noMarp.output, /marp-cli not installed/);

  const noDiscovery = await exportDeck(await mkdtemp(path.join(os.tmpdir(), 'no-discovery-')), { bin: await stubBin() });
  assert.equal(noDiscovery.code, 2);
});
