#!/usr/bin/env node
// Collection release-unit check. Blocking findings exit 1.
// Usage: check-release-units.mjs [--root <repo>]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ANNOTATION = 'x-release-please-version';
const CHANGELOG_BASE = 'https://github.com/ken-guru/skills/blob/main';

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') options.root = argv[(i += 1)];
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
  if (error) return errors.push(`${file}: ${error}`);
  for (const [key, raw] of entries) {
    if (quotedValue(raw) === undefined) errors.push(`${file}: metadata.${key} must be a quoted string`);
  }
  const version = entries.get('version');
  if (version === undefined) errors.push(`${file}: metadata.version is missing`);
  else if (!version.includes(`# ${ANNOTATION}`)) errors.push(`${file}: metadata.version must carry the ${ANNOTATION} annotation`);
  const changelog = `${CHANGELOG_BASE}/${unitPath}/CHANGELOG.md`;
  if (quotedValue(entries.get('changelog') ?? '') !== changelog) errors.push(`${file}: metadata.changelog must be "${changelog}"`);
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

export function checkReleaseUnits(root) {
  const errors = [];
  const config = readJson(root, 'release-please-config.json');
  const manifest = readJson(root, '.release-please-manifest.json');
  const packages = config.packages ?? {};
  checkRegistration(root, packages, manifest, errors);
  for (const [packagePath, settings] of Object.entries(packages)) {
    const extraFiles = settings['extra-files'] ?? [];
    if (packagePath in manifest) checkAgreement(root, packagePath, manifest[packagePath], extraFiles, errors);
    const written = new Set(extraFiles.map((entry) => extraFilePath(packagePath, entry)));
    for (const file of skillFiles(root, packagePath)) {
      if (!written.has(file)) errors.push(`${file}: not listed in extra-files for ${packagePath}`);
      checkShape(root, packagePath, file, errors);
    }
    const changelog = path.posix.join(packagePath, 'CHANGELOG.md');
    if (!existsSync(path.join(root, changelog))) errors.push(`${changelog}: missing`);
  }
  return { errors };
}

const { root } = parseArgs(process.argv.slice(2));
const { errors } = checkReleaseUnits(root);
for (const error of errors) console.log(`error ${error}`);
process.exit(errors.length ? 1 : 0);
