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
// After both exports succeed, `export-lock.json` records a SHA-256 of every
// file they were built from: the Markdown, each local media file it
// references, and the theme CSS `.marprc.yml` loads. A referenced file that
// doesn't exist yet (media rendered after Generation) is recorded as null.
// presentation-validation compares it to tell a stale export from a current one.
//
// Exit 0: HTML and PDF written. Exit 1: an export failed. Exit 2: usage or
// prerequisite error.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
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

// Marp's own `[ ERROR ]` message, which wraps onto indented lines and may hold
// blank ones. When Marp crashes, a Node stack trace follows it; that trace never
// reaches the report.
export function marpError(output) {
  const lines = output.split('\n');
  const start = lines.findIndex((line) => /^\[\s*ERROR\s*\]/.test(line));
  if (start !== -1) {
    const message = [lines[start].replace(/^\[\s*ERROR\s*\]\s*/, '')];
    for (const line of lines.slice(start + 1)) {
      if (!line.trim()) continue;
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

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function decoded(reference) {
  try {
    return decodeURI(reference);
  } catch {
    return reference;
  }
}

// Local files the Markdown references as images: Markdown image syntax (with
// or without <angle brackets>) and src attributes outside <style> and
// <script>. Remote and data URLs are skipped.
function mediaReferences(markdown) {
  const text = markdown.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '');
  const references = [
    ...[...text.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)\s]+))/g)].map((match) => match[1] ?? match[2]),
    ...[...text.matchAll(/\ssrc=["']([^"']+)["']/g)].map((match) => match[1]),
  ];
  return references.filter((reference) => !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)).map((reference) => decoded(reference.split(/[?#]/)[0]));
}

// Theme CSS files from `.marprc.yml`'s themeSet: a path, a [flow, list] or a
// block list, each a file or a directory of CSS.
async function themeFiles(config, projectDirectory) {
  const uncommented = config.split('\n').map((line) => line.replace(/\s+#.*$/, '')).join('\n');
  const block = uncommented.match(/^themeSet:[ \t]*(.*)(?:\n((?:[ \t]+-.*(?:\n|$))*))?/m);
  if (!block) return [];
  const inline = block[1].trim().replace(/^\[|\]$/g, '').split(',');
  const listed = (block[2] ?? '').split('\n').map((line) => line.replace(/^\s*-\s*/, ''));
  const entries = [...inline, ...listed]
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
  const files = [];
  for (const entry of entries) {
    const target = path.resolve(projectDirectory, entry);
    if (isFile(target)) files.push(target);
    else {
      const names = await readdir(target).catch(() => []);
      files.push(...names.filter((name) => name.endsWith('.css')).sort().map((name) => path.join(target, name)));
    }
  }
  return files;
}

async function recordExport(projectDirectory, presentation, config) {
  const markdownPath = path.resolve(projectDirectory, presentation);
  const markdown = await readFile(markdownPath, 'utf8');
  const sources = [
    markdownPath,
    ...mediaReferences(markdown).map((reference) => path.resolve(path.dirname(markdownPath), reference)),
    ...(await themeFiles(config, projectDirectory)),
  ];
  const files = {};
  for (const file of sources) {
    const key = path.relative(projectDirectory, file).split(path.sep).join('/');
    files[key] = isFile(file) ? createHash('sha256').update(await readFile(file)).digest('hex') : null;
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path.join(projectDirectory, 'export-lock.json'), `${JSON.stringify({ schemaVersion: 1, files: sorted }, null, 2)}\n`);
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
  const configPath = path.join(projectDirectory, '.marprc.yml');
  const config = await readFile(configPath, 'utf8').catch(() => '');

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
    await recordExport(projectDirectory, presentation, config);
    console.log(`✅ ${pdf}`);
    return 0;
  }
  console.log(`⚠️  PDF export failed with the configured browser:\n${marpError(first.output)}`);

  const current = config.match(/^browserPath:\s*"?(.*?)"?\s*$/m)?.[1];
  for (const candidate of browserCandidates().filter(({ path: file }) => file !== current)) {
    const retry = await marp([...pdfArgs, '--browser', candidate.kind, '--browser-path', candidate.path], projectDirectory);
    if (retry.code !== 0) {
      console.log(`⚠️  ${candidate.path} also failed.`);
      continue;
    }
    await writeFile(configPath, withBrowser(config, candidate));
    await recordExport(projectDirectory, presentation, config);
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
