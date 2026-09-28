#!/usr/bin/env node
// Renders the selected DIAGRAM_SPEC.md entries to SVG with the local D2 binary.
// Dependency-free; never prompts and never writes PROJECT.json.
//
// Usage: render-diagrams.mjs <DIAGRAM_SPEC.md> [--force] [--slides=N,M,...] [--slide=N]
// Exit codes: 0 every selected entry rendered (or already present)
//             1 at least one entry failed; nothing is written when an entry is
//               malformed, styles D2 outside the Diagram Roles, or fails
//               `d2 validate`
//             2 usage or prerequisite error, or an unexpected internal error
//             130 interrupted

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const USAGE = 'Usage: render-diagrams.mjs <DIAGRAM_SPEC.md> [--force] [--slides=N,M,...] [--slide=N]';
const D2_THEME_BY_TONE = { 'tone-light': 0, 'tone-dark': 200 };
const CANVAS_BY_TONE = { 'tone-light': 'light', 'tone-dark': 'dark' };
const NODE_ROLES = ['base', 'emphasis', 'muted', 'risk', 'boundary'];
const EDGE_ROLES = ['flow', 'optional-flow', 'risk-flow'];
const DIAGRAM_ROLES = [...NODE_ROLES, ...EDGE_ROLES];

class UsageError extends Error {}

const temporaryPaths = new Set();
let activeChild = null;

function cleanupSync() {
  for (const file of temporaryPaths) rmSync(file, { recursive: true, force: true });
  temporaryPaths.clear();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    activeChild?.kill('SIGTERM');
    cleanupSync();
    process.stderr.write(`\nInterrupted: temporary files removed; diagrams already promoted are kept.\n`);
    process.exit(130);
  });
}
process.on('exit', cleanupSync);

function parseArguments(argv) {
  const options = { specPath: null, force: false, slides: null };
  const slideList = (value, flag) => {
    const numbers = value.split(',').map((item) => item.trim());
    if (!numbers.length || numbers.some((item) => !/^\d+$/.test(item))) throw new UsageError(`${flag} expects slide numbers, got "${value}".`);
    return numbers.map(Number);
  };
  for (const argument of argv) {
    if (argument === '--force') options.force = true;
    else if (argument.startsWith('--slides=')) options.slides = slideList(argument.slice(9), '--slides');
    else if (argument.startsWith('--slide=')) {
      options.slides = slideList(argument.slice(8), '--slide');
      if (options.slides.length !== 1) throw new UsageError('--slide takes one slide number; use --slides=N,M for several.');
    }
    else if (argument.startsWith('--')) throw new UsageError(`Unknown option ${argument}.`);
    else if (options.specPath) throw new UsageError(`Unexpected argument ${argument}.`);
    else options.specPath = path.resolve(argument);
  }
  if (!options.specPath) throw new UsageError('Missing the DIAGRAM_SPEC.md path.');
  return options;
}

function run(command, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: null, output: error.message, error });
      return;
    }
    activeChild = child;
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => { activeChild = null; resolve({ code: null, output: error.message, error }); });
    child.on('close', (code) => { activeChild = null; resolve({ code, output: output.trim() }); });
  });
}

// Entries are `## Slide N — Title` sections with a **Filename:** field and a
// fenced ```d2 block, which may be indented under a list item.
function parseDiagramSpec(text) {
  const entries = [];
  for (const section of text.split(/^## /m).slice(1)) {
    const lines = section.split('\n');
    const heading = lines[0].match(/^Slide (\d+)\s+[—–-]\s+(.+?)\s*$/);
    if (!heading) continue;
    const entry = { slide: Number(heading[1]), title: heading[2], source: null, problems: [] };
    entry.filename = section.match(/\*\*Filename:\*\*\s*`([^`]+)`/)?.[1] ?? null;
    if (!entry.filename) entry.problems.push('missing **Filename:**');
    const open = lines.findIndex((line) => /^\s*(`{3,}|~{3,})\s*d2\s*$/.test(line));
    const [, indent = '', fence] = open === -1 ? [] : lines[open].match(/^(\s*)(`{3,}|~{3,})/);
    // A closing fence repeats the opening character at least as many times.
    const close = open === -1 ? -1 : lines.findIndex((line, index) => index > open && new RegExp(`^${fence[0]}{${fence.length},}$`).test(line.trim()));
    if (open !== -1 && close === -1) {
      entry.problems.push('its D2 block has no closing fence');
    } else {
      const body = open === -1 ? [] : lines.slice(open + 1, close).map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line.trimStart()));
      if (body.join('').trim()) entry.source = `${body.join('\n')}\n`;
      else entry.problems.push('missing a D2 block');
    }
    entries.push(entry);
  }
  return entries;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function lockedManifest(projectDirectory) {
  let themesPath = 'themes/';
  try {
    themesPath = (await readJson(path.join(projectDirectory, 'DISCOVERY.json'))).paths?.themes ?? themesPath;
  } catch {
    // DISCOVERY.json is optional here; fall back to the documented default.
  }
  const themesDirectory = path.resolve(projectDirectory, themesPath);
  let lock;
  try {
    lock = await readJson(path.join(themesDirectory, 'theme-lock.json'));
  } catch {
    throw new UsageError(`No locked Presentation Theme at ${path.join(themesDirectory, 'theme-lock.json')}. Run generate-slides to lock the theme, then rerun.`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(lock.id ?? '')) {
    throw new UsageError(`theme-lock.json names an invalid theme identifier. Refresh the theme in generate-slides, then rerun.`);
  }
  try {
    return await readJson(path.join(themesDirectory, lock.id, 'theme.json'));
  } catch {
    throw new UsageError(`The locked Theme Manifest for "${lock.id}" is missing or unreadable. Refresh the theme in generate-slides, then rerun.`);
  }
}

// Styling comes only from Diagram Roles: no color or font-size literals, no
// class definitions, and only role classes. presentation-validation's
// media.diagram-roles finding applies the same rule.
function roleProblems(source) {
  const problems = [];
  source.split('\n').forEach((line, index) => {
    const where = `line ${index + 1}`;
    for (const match of line.matchAll(/(?<![\w-])(fill|stroke|font-color)\s*:/g)) problems.push(`${where}: sets ${match[1]} directly (color literal)`);
    for (const match of line.matchAll(/["']#[0-9a-fA-F]{3,8}["']|\b(?:rgba?|hsla?)\(/g)) problems.push(`${where}: color literal ${match[0]}`);
    if (/(?<![\w-])font-size\s*:/.test(line)) problems.push(`${where}: font-size literal`);
    if (/(?<![\w-])classes\s*:/.test(line)) problems.push(`${where}: defines its own classes`);
    for (const match of line.matchAll(/(?<![\w-])class\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s;{}]+)/g)) {
      const names = match[1].replace(/^\[|\]$/g, '').split(/[;,]/).map((name) => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      for (const name of names.filter((item) => !DIAGRAM_ROLES.includes(item))) problems.push(`${where}: unknown role class "${name}"`);
    }
  });
  return problems;
}

// D2 source that applies the locked theme: theme-overrides recolor anything
// unclassed, and one class per Diagram Role carries the role's styling.
function rolePreamble(manifest, tone) {
  const roles = manifest.diagramRoles;
  const color = (key) => manifest.palette[key];
  const canvas = color(CANVAS_BY_TONE[tone]) ?? color('background') ?? color(roles.base.fill);
  // D2 theme color codes: N1 text, N2–N6 secondary text and neutral lines, N7
  // canvas; B1–B6 default shape strokes (B1) through fills (B6), with B4/B5
  // container fills; AA*/AB* accent fills for special shapes.
  const overrides = {
    N1: roles.base.fontColor, N2: roles.muted.fontColor, N3: roles.muted.stroke, N4: roles.muted.stroke,
    N5: roles.boundary.fill, N6: roles.boundary.fill, B1: roles.base.stroke, B2: roles.flow.stroke,
    B3: roles.base.stroke, B4: roles.boundary.fill, B5: roles.boundary.fill, B6: roles.base.fill,
    AA2: roles.emphasis.fill, AA4: roles.boundary.fill, AA5: roles.base.fill, AB4: roles.boundary.fill, AB5: roles.base.fill,
  };
  const lines = ['vars: {', '  d2-config: {', '    theme-overrides: {', `      N7: "${canvas}"`];
  for (const [code, key] of Object.entries(overrides)) lines.push(`      ${code}: "${color(key)}"`);
  lines.push('    }', '  }', '}', 'classes: {');
  for (const role of DIAGRAM_ROLES) {
    const definition = roles[role];
    const style = [];
    if (NODE_ROLES.includes(role)) style.push(`fill: "${color(definition.fill)}"`);
    style.push(`stroke: "${color(definition.stroke)}"`, `font-color: "${color(definition.fontColor)}"`, `stroke-dash: ${definition.strokeDash}`, `font-size: ${definition.fontSize}`);
    lines.push(`  ${role}: {style: {${style.join('; ')}}}`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

function missingRoleStyling(manifest) {
  const roles = manifest.diagramRoles;
  if (!roles) return 'has no Diagram Roles';
  for (const role of DIAGRAM_ROLES) {
    const definition = roles[role];
    const keys = [...(NODE_ROLES.includes(role) ? ['fill'] : []), 'stroke', 'fontColor'].map((field) => definition?.[field]);
    if (!definition || keys.some((key) => !manifest.palette?.[key]) || typeof definition.fontSize !== 'number' || typeof definition.strokeDash !== 'number') {
      return `has an incomplete Diagram Role "${role}"`;
    }
  }
  return null;
}

// Valid SVG may open with a BOM, XML declaration, comments, or DOCTYPE.
function svgRootTag(svg) {
  const body = svg.replace(/^﻿?(?:\s+|<\?xml\b[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE\b[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i, '');
  return body.match(/^<svg\b[^>]*>/i)?.[0];
}

function svgProblem(svg) {
  const root = svgRootTag(svg);
  if (!root) return 'the rendered file\'s root element is not <svg>';
  if (!/\sviewBox=["'][^"']+["']/i.test(root)) return 'the rendered root <svg> has no viewBox';
  return null;
}

// Points D2's messages at the entry's own D2 Source lines, not the temp file
// with the injected role preamble.
function d2Message(output, input, preamble) {
  const offset = preamble.split('\n').length - 1;
  return output
    .split(`${input}:`).join('')
    .split(input).join('D2 Source')
    .replace(/\S*d2cli\.\w+: /g, '')
    .replace(/(^|\s)(\d+):(\d+):/gm, (_, lead, line, column) => `${lead}D2 Source line ${Math.max(1, Number(line) - offset)}, column ${column}:`);
}

// Effective Text Size: the smallest <text> font-size times the contain scale
// into the diagram media box. presentation-validation's media.svg-legibility
// keeps an identical copy; the two must reach the same verdict.
const MINIMUM_EFFECTIVE_TEXT_SIZE = 20;

function effectiveTextSize(svg, box) {
  const viewBox = svgRootTag(svg)?.match(/\sviewBox=["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const [width, height] = viewBox?.slice(2) ?? [];
  if (!(width > 0 && height > 0)) return null;
  const tags = [...svg.matchAll(/<text\b[^>]*>/gi)].map(([tag]) => tag);
  if (!tags.length) return null;
  // Only px (or unitless) sizes are measurable; any other <text> fails closed.
  const sizes = tags.map((tag) => Number(tag.match(/font-size\s*[:=]\s*["']?\s*([\d.]+)(?:px)?(?![\w%.])/i)?.[1]));
  const unmeasured = sizes.filter((size) => !(size > 0)).length;
  const measured = sizes.filter((size) => size > 0);
  const smallest = measured.length ? Math.min(...measured) : 0;
  const scale = Math.min(box.width / width, box.height / height);
  const effective = smallest * scale;
  return { smallest, scale, effective, unmeasured, svgAspect: width / height, boxAspect: box.width / box.height, pass: !unmeasured && effective >= MINIMUM_EFFECTIVE_TEXT_SIZE };
}

function legibilityMessage(result, box, roleMinimum) {
  if (result.unmeasured) {
    return `Effective Text Size cannot be measured: ${result.unmeasured} <text> element(s) have no px font-size. Re-render from DIAGRAM_SPEC.md so D2 sets every size.`;
  }
  const wider = result.svgAspect > result.boxAspect;
  const fixes = wider
    ? ['shorten labels', 'use `direction: down`', 'split it into two diagrams']
    : ['use `direction: right`', 'reduce the number of rows', 'split it into two diagrams'];
  if (result.smallest < roleMinimum) fixes.unshift('give every shape and connection a role class');
  fixes.push('or ask for a larger role font size in the Theme Package');
  return `Effective Text Size ${result.effective.toFixed(1)} px is below ${MINIMUM_EFFECTIVE_TEXT_SIZE} px: smallest text ${+result.smallest.toFixed(2)} px × scale ${result.scale.toFixed(2)} into the ${box.width}×${box.height} diagram media box (SVG ${result.svgAspect.toFixed(2)}:1, box ${result.boxAspect.toFixed(2)}:1). The diagram is ${wider ? 'wider' : 'taller'} than the media box; ${fixes.join(', ')}.`;
}

function label(entry) {
  return `Slide ${entry.slide} — ${entry.title} (${entry.filename ?? 'no filename'})`;
}

async function main(argv) {
  const options = parseArguments(argv);
  if (!existsSync(options.specPath)) throw new UsageError(`${options.specPath} not found. Create and approve DIAGRAM_SPEC.md first.`);
  const projectDirectory = path.dirname(options.specPath);

  const version = await run('d2', ['--version']);
  if (version.code !== 0) throw new UsageError('d2 is not available on PATH. Install D2, then rerun.');

  const manifest = await lockedManifest(projectDirectory);
  const tone = manifest.archetypes?.diagram?.tone;
  const d2Theme = D2_THEME_BY_TONE[tone];
  if (d2Theme === undefined) throw new UsageError(`The locked Theme Manifest's diagram tone "${tone}" is not tone-light or tone-dark. Refresh the theme in generate-slides.`);
  const stylingProblem = missingRoleStyling(manifest);
  if (stylingProblem) {
    throw new UsageError(`The locked Theme Manifest for "${manifest.id}" ${stylingProblem}, so diagrams cannot use the Presentation Theme. Refresh the theme in generate-slides, then rerun.`);
  }
  const box = manifest.archetypes.diagram.mediaBox;
  if (!(box?.width > 0 && box?.height > 0)) {
    throw new UsageError(`The locked Theme Manifest for "${manifest.id}" has no diagram media box, so diagram legibility cannot be checked. Refresh the theme in generate-slides, then rerun.`);
  }
  const roleMinimum = Math.min(...DIAGRAM_ROLES.map((role) => manifest.diagramRoles[role].fontSize));
  const preamble = rolePreamble(manifest, tone);

  let entries = parseDiagramSpec(await readFile(options.specPath, 'utf8'));
  if (options.slides) {
    const missing = options.slides.filter((slide) => !entries.some((item) => item.slide === slide));
    if (missing.length) throw new UsageError(`No diagram entry for slide ${missing.join(', ')} in ${path.basename(options.specPath)}.`);
    entries = entries.filter((item) => options.slides.includes(item.slide));
  }
  if (!entries.length) throw new UsageError(`No diagram entries found in ${path.basename(options.specPath)}.`);

  const boundary = `${path.resolve(projectDirectory)}${path.sep}`;
  for (const item of entries) {
    if (!item.filename) continue;
    item.target = path.resolve(projectDirectory, item.filename);
    if (!item.target.startsWith(boundary)) item.problems.push('its Filename escapes the Project Folder');
    else if (!/\.svg$/i.test(item.filename)) item.problems.push('its Filename does not end in .svg');
  }
  const malformed = entries.filter((item) => item.problems.length);
  if (malformed.length) {
    console.log(`❌ ${malformed.length} malformed DIAGRAM_SPEC.md entr${malformed.length === 1 ? 'y' : 'ies'}; nothing was written:`);
    for (const item of malformed) console.log(`   • ${label(item)}: ${item.problems.join('; ')}`);
    return 1;
  }

  const offTheme = entries.map((item) => ({ item, problems: roleProblems(item.source) })).filter(({ problems }) => problems.length);
  if (offTheme.length) {
    console.log(`❌ ${offTheme.length} diagram${offTheme.length === 1 ? '' : 's'} style D2 outside the Diagram Roles; nothing was written:`);
    for (const { item, problems } of offTheme) console.log(`   • ${label(item)}: ${problems.join('; ')}`);
    console.log(`   Replace colors, font sizes, and custom classes with class: <role> (${DIAGRAM_ROLES.join(', ')}), then rerun.`);
    return 1;
  }

  const selected = [];
  for (const item of entries) {
    if (!options.force && existsSync(item.target)) console.log(`⏭️  ${label(item)}: exists — pass --force to re-render`);
    else selected.push(item);
  }
  if (!selected.length) {
    console.log('✅ Every selected diagram already exists; nothing to render.');
    return 0;
  }

  const workDirectory = mkdtempSync(path.join(os.tmpdir(), 'render-diagrams-'));
  temporaryPaths.add(workDirectory);
  for (const item of selected) {
    item.input = path.join(workDirectory, `entry-${selected.indexOf(item) + 1}-slide-${item.slide}.d2`);
    await writeFile(item.input, `${preamble}${item.source}`);
  }

  const invalid = [];
  for (const item of selected) {
    const result = await run('d2', ['validate', item.input]);
    if (result.code !== 0) invalid.push({ item, message: d2Message(result.output, item.input, preamble) });
  }
  if (invalid.length) {
    console.log(`❌ ${invalid.length} diagram${invalid.length === 1 ? '' : 's'} failed d2 validate; nothing was written:`);
    for (const { item, message } of invalid) console.log(`   • ${label(item)}: ${message}`);
    console.log('   Fix the D2 Source in DIAGRAM_SPEC.md, then rerun.');
    return 1;
  }

  const failures = [];
  let rendered = 0;
  for (const item of selected) {
    const temporary = path.join(path.dirname(item.target), `.${path.basename(item.target)}.${process.pid}.tmp.svg`);
    try {
      await mkdir(path.dirname(item.target), { recursive: true });
      temporaryPaths.add(temporary);
      const result = await run('d2', ['--layout=elk', `--theme=${d2Theme}`, item.input, temporary]);
      if (result.code !== 0) throw new Error(`d2 failed: ${d2Message(result.output, item.input, preamble)}`);
      const svg = await readFile(temporary, 'utf8');
      const problem = svgProblem(svg);
      if (problem) throw new Error(problem);
      const legibility = effectiveTextSize(svg, box);
      if (legibility && !legibility.pass) throw new Error(legibilityMessage(legibility, box, roleMinimum));
      await rename(temporary, item.target);
      temporaryPaths.delete(temporary);
      rendered += 1;
      console.log(`✅ ${label(item)}`);
    } catch (error) {
      failures.push({ item, message: error.message });
      console.log(`❌ ${label(item)}: ${error.message}`);
    } finally {
      await rm(temporary, { force: true });
      temporaryPaths.delete(temporary);
    }
  }

  console.log('─'.repeat(40));
  console.log(`Rendered: ${rendered}   Failed: ${failures.length}   Skipped: ${entries.length - selected.length}`);
  if (failures.length) {
    console.log('Failed diagrams (rendered ones were kept):');
    for (const { item, message } of failures) console.log(`   • ${label(item)}: ${message}`);
    return 1;
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => { cleanupSync(); process.exitCode = code; })
  .catch((error) => {
    cleanupSync();
    if (error instanceof UsageError) {
      process.stderr.write(`❌ ${error.message}\n${USAGE}\n`);
      process.exitCode = 2;
    } else {
      process.stderr.write(`❌ ${error.stack ?? error.message}\n`);
      process.exitCode = 2;
    }
  });
