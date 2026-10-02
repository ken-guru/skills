#!/usr/bin/env node

// Exports the presentation Markdown to HTML and PDF with Marp CLI, from the
// Project Folder so Marp reads its `.marprc.yml`.
//
//   node export-presentation.mjs <project-folder>
//
// HTML needs no browser. When the PDF export fails under the configured or
// auto-selected browser, each installed stable-channel browser is tried in
// order; the first that works is saved to `.marprc.yml` as `browser` and
// `browserPath`, so later Marp calls (including Proofread's slide images)
// use the same browser.
//
// Exit 0: HTML and PDF written. Exit 1: an export failed. Exit 2: usage or
// prerequisite error.

import { spawn } from 'node:child_process';
import { accessSync, constants, realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = 'Usage: export-presentation.mjs <project-folder>';
const NO_BROWSER = '❌ Marp found no local browser that could export the PDF. Install Chrome, Edge, or Firefox, then rerun.';

// Stable channels only, in preference order. Marp's own `chrome` choice can
// resolve to a Canary or beta build, so every candidate names its binary.
const MAC_CANDIDATES = [
  ['chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  ['chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  ['edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  ['firefox', '/Applications/Firefox.app/Contents/MacOS/firefox'],
];
const PATH_CANDIDATES = [
  ['chrome', 'google-chrome-stable'],
  ['chrome', 'google-chrome'],
  ['chrome', 'chromium'],
  ['chrome', 'chromium-browser'],
  ['edge', 'microsoft-edge-stable'],
  ['edge', 'microsoft-edge'],
  ['firefox', 'firefox'],
];

class UsageError extends Error {}

function executable(file) {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function onPath(name) {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (directory && executable(path.join(directory, name))) return path.join(directory, name);
  }
  return null;
}

export function browserCandidates() {
  const found = [];
  if (process.platform === 'darwin') {
    for (const [kind, file] of MAC_CANDIDATES) if (executable(file)) found.push({ kind, path: file });
  }
  for (const [kind, name] of PATH_CANDIDATES) {
    const file = onPath(name);
    if (file && !found.some((candidate) => candidate.path === file)) found.push({ kind, path: file });
  }
  return found;
}

function marp(args, cwd) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn('marp', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ code: null, output: error.message, missing: error.code === 'ENOENT' }));
    child.on('close', (code) => resolve({ code, output: output.trim() }));
  });
}

// Marp's own `[ ERROR ]` message, which wraps onto indented lines. When Marp
// crashes, a Node stack trace follows it; that trace never reaches the report.
export function marpError(output) {
  const lines = output.split('\n');
  const start = lines.findIndex((line) => /^\[\s*ERROR\s*\]/.test(line));
  if (start !== -1) {
    const message = [lines[start].replace(/^\[\s*ERROR\s*\]\s*/, '')];
    for (const line of lines.slice(start + 1)) {
      if (!/^ {4,}\S/.test(line) || /^\s+at /.test(line)) break;
      message.push(line.trim());
    }
    return `   ${message.join(' ')}`;
  }
  const readable = lines.filter((line) => line.trim() && !/^\s+at |^Node\.js v|^\s*[{}]\s*$|^\s*\^+\s*$/.test(line));
  return readable.slice(-3).map((line) => `   ${line.trim()}`).join('\n');
}

// Replaces any existing browser keys; every other line of the Marp config is kept.
export function withBrowser(config, { kind, path: browserPath }) {
  const kept = config.split('\n').filter((line) => line && !/^browser(Path)?\s*:/.test(line));
  return `${[...kept, `browser: ${kind}`, `browserPath: ${JSON.stringify(browserPath)}`].join('\n')}\n`;
}

async function main(argv) {
  const positional = argv.filter((argument) => !argument.startsWith('--'));
  if (positional.length !== 1 || positional.length !== argv.length) throw new UsageError(USAGE);
  const projectDirectory = path.resolve(positional[0]);

  let discovery;
  try {
    discovery = JSON.parse(await readFile(path.join(projectDirectory, 'DISCOVERY.json'), 'utf8'));
  } catch {
    throw new UsageError(`Cannot read DISCOVERY.json in ${projectDirectory}.`);
  }
  const presentation = discovery.paths?.presentation ?? 'PRESENTASJON.md';
  const html = discovery.paths?.html ?? 'PRESENTASJON.html';
  const pdf = discovery.paths?.pdf ?? 'PRESENTASJON.pdf';

  const htmlResult = await marp([presentation, '-o', html], projectDirectory);
  if (htmlResult.missing) throw new UsageError('marp-cli not installed. Run npm install -g @marp-team/marp-cli');
  if (htmlResult.code !== 0) {
    console.log(`❌ HTML export failed:\n${marpError(htmlResult.output)}`);
    return 1;
  }
  console.log(`✅ ${html}`);

  const pdfArgs = [presentation, '--pdf', '-o', pdf];
  const first = await marp(pdfArgs, projectDirectory);
  if (first.code === 0) {
    console.log(`✅ ${pdf}`);
    return 0;
  }
  console.log(`⚠️  PDF export failed with the configured browser:\n${marpError(first.output)}`);

  const configPath = path.join(projectDirectory, '.marprc.yml');
  const config = await readFile(configPath, 'utf8').catch(() => '');
  const current = config.match(/^browserPath:\s*"?(.*?)"?\s*$/m)?.[1];
  for (const candidate of browserCandidates().filter(({ path: file }) => file !== current)) {
    const retry = await marp([...pdfArgs, '--browser', candidate.kind, '--browser-path', candidate.path], projectDirectory);
    if (retry.code !== 0) {
      console.log(`⚠️  ${candidate.path} also failed.`);
      continue;
    }
    await writeFile(configPath, withBrowser(config, candidate));
    console.log(`✅ ${pdf} (browser: ${candidate.path}; saved to .marprc.yml${candidate.kind === 'firefox' ? '; Firefox PDF output is the least tested, so check the PDF' : ''})`);
    return 0;
  }
  console.log(NO_BROWSER);
  return 1;
}

// import.meta.url is the resolved path; argv[1] keeps symlinks (macOS /var,
// symlinked skill installs), so resolve it before comparing.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(`${error instanceof UsageError ? `❌ ${error.message}` : error.stack}\n`);
      process.exitCode = 2;
    });
}
