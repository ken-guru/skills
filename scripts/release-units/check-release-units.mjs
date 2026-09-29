#!/usr/bin/env node
// Collection release-unit check. Blocking findings exit 1.
// Warnings (--commits <base>..<head>) never change the exit code.
// Usage: check-release-units.mjs [--root <repo>] [--commits <range>]
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ANNOTATION = 'x-release-please-version';
const CHANGELOG_BASE = 'https://github.com/ken-guru/skills/blob/main';

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') options.root = argv[(i += 1)];
    else if (argv[i] === '--commits') options.commits = argv[(i += 1)];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return options;
}

// A Standalone Skill owns one SKILL.md; a Skill Suite's members sit one level down.
function skillFiles(root, unitPath) {
  const own = path.posix.join(unitPath, 'SKILL.md');
  if (existsSync(path.join(root, own))) return [own];
  return readdirSync(path.join(root, unitPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, unitPath, entry.name, 'SKILL.md')))
    .map((entry) => path.posix.join(unitPath, entry.name, 'SKILL.md'))
    .sort();
}

function readJson(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}

// The version on the line release-please's Generic updater rewrites.
function annotatedVersion(text) {
  const line = text.split('\n').find((candidate) => candidate.includes(ANNOTATION));
  return line?.match(/\d+\.\d+\.\d+/)?.[0];
}

// The `metadata:` block of a SKILL.md frontmatter, read line by line so that
// quoting is visible: a YAML parser would hide the difference that matters.
function metadataBlock(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return { error: 'has no frontmatter' };
  const end = lines.indexOf('---', 1);
  const frontmatter = lines.slice(1, end);
  const start = frontmatter.findIndex((line) => /^metadata:/.test(line));
  if (start === -1) return { error: 'has no metadata map' };
  if (frontmatter[start].replace(/#.*$/, '').trim() !== 'metadata:') return { error: 'metadata must be a map' };
  const entries = new Map();
  for (const line of frontmatter.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    if (/^\s*(#.*)?$/.test(line)) continue;
    const match = line.match(/^(\s+)([\w-]+):\s*(.*)$/);
    if (!match || match[1] !== '  ') return { error: `metadata must be a flat map of strings (unexpected line "${line.trim()}")` };
    entries.set(match[2], match[3]);
  }
  return { entries };
}

// A quoted YAML string value, optionally followed by a comment.
function quotedValue(raw) {
  return raw.match(/^"([^"]*)"\s*(#.*)?$/)?.[1];
}

function checkShape(root, unitPath, file, errors) {
  const { entries, error } = metadataBlock(readFileSync(path.join(root, file), 'utf8'));
  if (error) {
    errors.push(`${file}: ${error}`);
    return undefined;
  }
  for (const [key, raw] of entries) {
    if (quotedValue(raw) === undefined) errors.push(`${file}: metadata.${key} must be a quoted string`);
  }
  const version = entries.get('version');
  if (version === undefined) errors.push(`${file}: metadata.version is missing`);
  else if (!version.includes(`# ${ANNOTATION}`)) errors.push(`${file}: metadata.version must carry the ${ANNOTATION} annotation`);
  const changelog = `${CHANGELOG_BASE}/${unitPath}/CHANGELOG.md`;
  if (quotedValue(entries.get('changelog') ?? '') !== changelog) errors.push(`${file}: metadata.changelog must be "${changelog}"`);
  return entries;
}

// npm caret semantics: the leftmost non-zero component of the floor is fixed.
function satisfiesCaret(version, range) {
  const floor = range.match(/^\^(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  const actual = version.split('.').map(Number);
  const fixed = floor[0] > 0 ? 1 : floor[1] > 0 ? 2 : 3;
  for (let i = 0; i < fixed; i += 1) if (actual[i] !== floor[i]) return false;
  for (let i = fixed; i < 3; i += 1) if (actual[i] !== floor[i]) return actual[i] > floor[i];
  return true;
}

// metadata.requires-<unit>: a caret range that must include <unit>'s current version.
function checkRequirements(file, entries, versionsByComponent, errors) {
  for (const [key, raw] of entries ?? []) {
    const unit = key.match(/^requires-(.+)$/)?.[1];
    const range = quotedValue(raw);
    if (!unit || range === undefined) continue; // unquoted values are reported by checkShape
    const current = versionsByComponent.get(unit);
    if (current === undefined) errors.push(`${file}: metadata.${key} names no Release Unit`);
    else if (!/^\^\d+\.\d+\.\d+$/.test(range)) errors.push(`${file}: metadata.${key} must be a caret range such as "^1.0.0"`);
    else if (!satisfiesCaret(current, range)) errors.push(`${file}: metadata.${key} "${range}" excludes ${unit}'s current version ${current}`);
  }
}

// extra-files paths are package-relative unless they start with '/'.
function extraFilePath(packagePath, entry) {
  const relative = typeof entry === 'string' ? entry : entry.path;
  return relative.startsWith('/') ? relative.slice(1) : path.posix.join(packagePath, relative);
}

// The version an extra-file carries: a JSON path for `type: json`, otherwise
// the annotated line the Generic updater rewrites. Only `$.a.b` paths are used.
function extraFileVersion(text, entry) {
  if (entry.type !== 'json') return annotatedVersion(text);
  return entry.jsonpath.replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((value, key) => value?.[key], JSON.parse(text));
}

function checkAgreement(root, packagePath, expected, extraFiles, errors) {
  for (const entry of extraFiles) {
    const file = extraFilePath(packagePath, entry);
    const actual = extraFileVersion(readFileSync(path.join(root, file), 'utf8'), entry);
    if (actual === undefined && file.endsWith('SKILL.md')) continue; // reported by checkShape
    if (actual !== expected) errors.push(`${file}: version ${actual} does not match the manifest's ${expected} for ${packagePath}`);
  }
}

// Every Release Unit under skills/, by the Collection's placement rules: a
// Standalone Skill has its own SKILL.md; a Skill Suite has a README.md and none.
function releaseUnits(root) {
  return readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const unitPath = `skills/${entry.name}`;
      if (existsSync(path.join(root, unitPath, 'SKILL.md'))) return { unitPath, kind: 'Standalone Skill' };
      if (existsSync(path.join(root, unitPath, 'README.md'))) return { unitPath, kind: 'Skill Suite' };
      return undefined;
    })
    .filter(Boolean);
}

function checkRegistration(root, packages, manifest, errors) {
  for (const { unitPath, kind } of releaseUnits(root)) {
    if (!(unitPath in packages)) errors.push(`${unitPath}: ${kind} is not registered in release-please-config.json`);
  }
  for (const packagePath of Object.keys(packages)) {
    if (!(packagePath in manifest)) errors.push(`${packagePath}: registered in release-please-config.json but missing from .release-please-manifest.json`);
  }
  for (const packagePath of Object.keys(manifest)) {
    if (!(packagePath in packages)) errors.push(`${packagePath}: listed in .release-please-manifest.json but not registered in release-please-config.json`);
  }
}

const NON_RELEASING = /^(docs|test|ci|chore)(\([^)]*\))?!?:/;
const BREAKING = /^\w+(\([^)]*\))?!:/;
const UNSHIPPED = /(^|\/)(tests|verification|docs)\/|(^|\/)(README|CHANGELOG)\.md$/;

// The non-merge commits in <range>, each with its subject, body and files.
function commitsIn(root, range) {
  const result = spawnSync('git', ['-C', root, 'log', '--no-merges', '--format=%x1e%h%x1f%s%x1f%b%x1f', '--name-only', range], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git log ${range} failed: ${result.stderr}`);
  return result.stdout.split('\x1e').filter(Boolean).map((record) => {
    const [sha, subject, body, files] = record.split('\x1f');
    return { sha, subject, body, files: files.split('\n').filter(Boolean) };
  });
}

// Non-blocking: fixed in the Release PR, never by rewriting commits.
function commitWarnings(root, range, packagePaths) {
  const warnings = [];
  for (const { sha, subject, body, files } of commitsIn(root, range)) {
    if (NON_RELEASING.test(subject)) {
      const shipped = files.filter((file) => packagePaths.some((unit) => file.startsWith(`${unit}/`)) && !UNSHIPPED.test(file));
      if (shipped.length) warnings.push(`${sha} "${subject}" touches shipped Skill files (${shipped.join(', ')}) but its type is never released; correct it in the Release PR`);
    }
    if (BREAKING.test(subject) && !/^BREAKING[ -]CHANGE: \S/m.test(body)) {
      warnings.push(`${sha} "${subject}" is breaking but has no BREAKING CHANGE: footer saying what consumers must do; add the upgrade note in the Release PR`);
    }
  }
  return warnings;
}

export function checkReleaseUnits(root) {
  const errors = [];
  const config = readJson(root, 'release-please-config.json');
  const manifest = readJson(root, '.release-please-manifest.json');
  const packages = config.packages ?? {};
  checkRegistration(root, packages, manifest, errors);
  const versionsByComponent = new Map(Object.entries(packages).map(([packagePath, settings]) => [settings.component, manifest[packagePath]]));
  for (const [packagePath, settings] of Object.entries(packages)) {
    const extraFiles = settings['extra-files'] ?? [];
    if (packagePath in manifest) checkAgreement(root, packagePath, manifest[packagePath], extraFiles, errors);
    const written = new Set(extraFiles.map((entry) => extraFilePath(packagePath, entry)));
    for (const file of skillFiles(root, packagePath)) {
      if (!written.has(file)) errors.push(`${file}: not listed in extra-files for ${packagePath}`);
      checkRequirements(file, checkShape(root, packagePath, file, errors), versionsByComponent, errors);
    }
    const changelog = path.posix.join(packagePath, 'CHANGELOG.md');
    if (!existsSync(path.join(root, changelog))) errors.push(`${changelog}: missing`);
  }
  return { errors };
}

const { root, commits } = parseArgs(process.argv.slice(2));
const { errors } = checkReleaseUnits(root);
const packagePaths = Object.keys(readJson(root, 'release-please-config.json').packages ?? {});
const warnings = commits ? commitWarnings(root, commits, packagePaths) : [];
for (const warning of warnings) {
  console.log(`warning ${warning}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Release units::${warning}`);
}
for (const error of errors) {
  console.log(`error ${error}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Release units::${error}`);
}
if (process.env.GITHUB_STEP_SUMMARY && (warnings.length || errors.length)) {
  const lines = ['## Release units', '', ...errors.map((e) => `- ❌ ${e}`), ...warnings.map((w) => `- ⚠️ ${w}`), ''];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
}
process.exit(errors.length ? 1 : 0);
