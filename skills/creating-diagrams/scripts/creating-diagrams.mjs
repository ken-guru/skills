#!/usr/bin/env node
// creating-diagrams: install D2, render D2 source with Diagram Roles, and check legibility.
//
//   node scripts/creating-diagrams.mjs setup [--status]
//   node scripts/creating-diagrams.mjs render <file.d2> --out <file.svg> [--theme <values.json>] [--slot WxH]
//   node scripts/creating-diagrams.mjs check  <file.d2> [--theme <values.json>] [--slot WxH]
//
// Exit codes: 0 success; 1 the diagram fails a rule or the legibility check;
//             2 usage, prerequisite, or internal error.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cacheRoot, installPinned, missingToolMessage, platformKey, resolveTool } from './tools.mjs';

const SETUP_COMMAND = 'node scripts/creating-diagrams.mjs setup';

// D2 v0.9.0: the first release with a browser-free PNG renderer and bundled TALA.
// Digests are GitHub's published SHA-256 for each release asset.
const D2_VERSION = '0.9.0';
const D2_PINS = {
  'linux-x64': ['d2-v0.9.0-linux-amd64.tar.gz', '5669ddc46b99e942cc96078f4a4e36d5e62103348f4c05179ede27802fdd87a9'],
  'linux-arm64': ['d2-v0.9.0-linux-arm64.tar.gz', 'ac2c028697199479acb321db1e3d68caee9f2ba492ed73caa3cd13f3829bf913'],
  'darwin-x64': ['d2-v0.9.0-macos-amd64.tar.gz', 'cad39576a480d6bb02ea142fef1726647914b0d2da51ccc9b30b660a2b1babf0'],
  'darwin-arm64': ['d2-v0.9.0-macos-arm64.tar.gz', 'eaf6c0c143e56dd9fa97bfb6df25ea9c1ebce40245f056a0768cf1a6c15d3064'],
};
const D2_TOOL = {
  envVar: 'D2_PATH',
  command: 'd2',
  cachePath: (root) => path.join(root, 'd2', D2_VERSION, `d2-v${D2_VERSION}`, 'bin', 'd2'),
};

const NODE_ROLES = ['base', 'emphasis', 'muted', 'risk', 'boundary'];
const EDGE_ROLES = ['flow', 'optional-flow', 'risk-flow'];
const DIAGRAM_ROLES = [...NODE_ROLES, ...EDGE_ROLES];

// The Accessibility Bar's minimum text size on the 1280×720 slide reference.
const MINIMUM_EFFECTIVE_TEXT_SIZE = 20;
// A 16:9 slide's content area: 1280×720 less the default theme padding (58 px sides, 52 px top and bottom).
const DEFAULT_SLOT = { width: 1164, height: 616 };
// D2 leaves code text unsized, so browsers draw it at the SVG default of 16 px.
const UNSIZED_TEXT_PX = 16;
// Role sizes: large enough that a diagram scaled down into a slot keeps 20 px text.
const NODE_FONT_SIZE = 28;
const EDGE_FONT_SIZE = 24;

// Neutral palette for use without a theme; every pair meets the Accessibility Bar.
const NEUTRAL_THEME = {
  '--color-bg': '#ffffff',
  '--color-text': '#1f2328',
  '--color-surface': '#f6f8fa',
  '--color-muted': '#57606a',
  '--color-accent': '#b42318',
  '--color-on-accent': '#ffffff',
};

class UsageError extends Error {}
class RuleError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!['setup', 'render', 'check'].includes(command)) throw new UsageError(`Unknown command "${command ?? ''}". Use setup, render, or check.`);
  const options = { command, input: null, out: null, theme: null, slot: DEFAULT_SLOT, status: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new UsageError(`${argument} needs a value.`);
      index += 1;
      return next;
    };
    if (argument === '--out') options.out = path.resolve(value());
    else if (argument === '--theme') options.theme = path.resolve(value());
    else if (argument === '--slot') {
      const match = value().match(/^(\d+)x(\d+)$/);
      if (!match) throw new UsageError('--slot expects WIDTHxHEIGHT in px on the 1280×720 slide reference, for example 1164x480.');
      options.slot = { width: Number(match[1]), height: Number(match[2]) };
    } else if (argument === '--status') options.status = true;
    else if (argument.startsWith('--')) throw new UsageError(`Unknown option ${argument}.`);
    else if (options.input) throw new UsageError(`Unexpected argument ${argument}.`);
    else options.input = path.resolve(argument);
  }
  if (command !== 'setup' && !options.input) throw new UsageError(`${command} needs a .d2 file.`);
  if (command === 'render' && !options.out) throw new UsageError('render needs --out <file.svg>.');
  if (options.out && !options.out.endsWith('.svg')) throw new UsageError('--out must end in .svg; the PNG and ASCII previews are written beside it.');
  return options;
}

// Rules D2 accepts silently but that break the diagram or its styling.
export function sourceProblems(source) {
  const problems = [];
  source.split('\n').forEach((line, index) => {
    const where = `line ${index + 1}`;
    for (const match of line.matchAll(/(?<![\w-])(fill|stroke|font-color)\s*:/g)) problems.push(`${where}: sets ${match[1]} directly (use a role class)`);
    for (const match of line.matchAll(/["']#[0-9a-fA-F]{3,8}["']|\b(?:rgba?|hsla?)\(/g)) problems.push(`${where}: colour literal ${match[0]}`);
    if (/(?<![\w-])font-size\s*:/.test(line)) problems.push(`${where}: font-size literal (role classes set sizes)`);
    if (/(?<![\w-])classes\s*:/.test(line)) problems.push(`${where}: defines its own classes (use the Diagram Roles)`);
    if (/d2-legend/.test(line)) problems.push(`${where}: legend (put meaning in labels and role styles instead)`);
    if (/d2-config/.test(line)) problems.push(`${where}: overrides d2-config (the theme sets it)`);
    for (const match of line.matchAll(/(?<![\w-])class\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s;{}]+)/g)) {
      const names = match[1].replace(/^\[|\]$/g, '').split(/[;,]/).map((name) => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      for (const name of names.filter((item) => !DIAGRAM_ROLES.includes(item))) problems.push(`${where}: unknown role class "${name}"`);
    }
    // An unquoted label runs from the key's colon to the end of the line or an opening brace.
    const label = line.match(/^\s*[^:#'"{}|]+?:\s*([^'"{|][^{]*?)\s*(?:\{.*)?$/)?.[1];
    if (label && !/^[\w-]+\s*:/.test(label)) {
      if (label.includes('#')) problems.push(`${where}: unquoted label contains "#", which starts a comment; quote the label`);
      if (label.includes(';')) problems.push(`${where}: unquoted label contains ";", which splits it into two shapes; quote the label`);
    }
  });
  return problems;
}

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6);
  const channels = [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

async function themeValues(file) {
  if (!file) return NEUTRAL_THEME;
  let values;
  try {
    values = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new UsageError(`Could not read theme values from ${file}: ${error.message}`);
  }
  const merged = { ...NEUTRAL_THEME, ...values };
  for (const key of Object.keys(NEUTRAL_THEME)) {
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(merged[key])) throw new UsageError(`Theme value ${key} must be a hex colour, got "${merged[key]}".`);
  }
  return merged;
}

// D2 source applying the theme: theme-overrides recolour anything unclassed,
// and one class per Diagram Role carries that role's styling.
function rolePreamble(theme) {
  const c = (key) => theme[key];
  const roles = {
    base: { fill: c('--color-surface'), stroke: c('--color-text'), font: c('--color-text'), dash: 0 },
    emphasis: { fill: c('--color-text'), stroke: c('--color-text'), font: c('--color-bg'), dash: 0 },
    muted: { fill: c('--color-bg'), stroke: c('--color-muted'), font: c('--color-muted'), dash: 0 },
    risk: { fill: c('--color-accent'), stroke: c('--color-accent'), font: c('--color-on-accent'), dash: 0 },
    boundary: { fill: c('--color-bg'), stroke: c('--color-muted'), font: c('--color-text'), dash: 4 },
    flow: { stroke: c('--color-text'), font: c('--color-text'), dash: 0 },
    'optional-flow': { stroke: c('--color-muted'), font: c('--color-muted'), dash: 5 },
    'risk-flow': { stroke: c('--color-accent'), font: c('--color-accent'), dash: 0 },
  };
  // D2 theme colour codes: N1 text, N2–N6 secondary text and neutral lines,
  // N7 canvas; B1–B6 shape strokes through fills; AA*/AB* special-shape fills.
  const overrides = {
    N1: c('--color-text'), N2: c('--color-muted'), N3: c('--color-muted'), N4: c('--color-muted'), N5: c('--color-bg'),
    N6: c('--color-bg'), N7: c('--color-bg'), B1: c('--color-text'), B2: c('--color-text'), B3: c('--color-text'),
    B4: c('--color-bg'), B5: c('--color-bg'), B6: c('--color-surface'), AA2: c('--color-text'), AA4: c('--color-bg'),
    AA5: c('--color-surface'), AB4: c('--color-bg'), AB5: c('--color-surface'),
  };
  const lines = ['vars: {', '  d2-config: {', '    theme-overrides: {'];
  for (const [code, colour] of Object.entries(overrides)) lines.push(`      ${code}: "${colour}"`);
  lines.push('    }', '  }', '}', 'classes: {');
  for (const role of DIAGRAM_ROLES) {
    const r = roles[role];
    const style = [];
    if (NODE_ROLES.includes(role)) style.push(`fill: "${r.fill}"`);
    style.push(`stroke: "${r.stroke}"`, `font-color: "${r.font}"`, `stroke-dash: ${r.dash}`, `font-size: ${NODE_ROLES.includes(role) ? NODE_FONT_SIZE : EDGE_FONT_SIZE}`);
    if (role === 'emphasis' || role === 'risk-flow') style.push('stroke-width: 3');
    lines.push(`  ${role}: {style: {${style.join('; ')}}}`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

function svgRootTag(svg) {
  const body = svg.replace(/^﻿?(?:\s+|<\?xml\b[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE\b[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i, '');
  return body.match(/^<svg\b[^>]*>/i)?.[0];
}

// Effective Text Size: the smallest <text> size times the contain scale into the slot.
export function effectiveTextSize(svg, slot) {
  const viewBox = svgRootTag(svg)?.match(/\sviewBox=["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const [width, height] = viewBox?.slice(2) ?? [];
  if (!(width > 0 && height > 0)) return null;
  const tags = [...svg.matchAll(/<text\b[^>]*>/gi)].map(([tag]) => tag);
  if (!tags.length) return { none: true, svgAspect: width / height };
  const sizes = tags.map((tag) => Number(tag.match(/font-size\s*[:=]\s*["']?\s*([\d.]+)(?:px)?(?![\w%.])/i)?.[1]) || UNSIZED_TEXT_PX);
  const smallest = Math.min(...sizes);
  const scale = Math.min(slot.width / width, slot.height / height);
  const effective = smallest * scale;
  return { smallest, scale, effective, svgAspect: width / height, slotAspect: slot.width / slot.height, pass: effective >= MINIMUM_EFFECTIVE_TEXT_SIZE };
}

function legibilityMessage(result, slot) {
  const wider = result.svgAspect > result.slotAspect;
  const fixes = wider
    ? ['shorten or wrap labels', 'use `direction: down`', 'keep about four nodes per row', 'split it into two diagrams']
    : ['use `direction: right`', 'reduce the number of rows', 'split it into two diagrams'];
  return `Effective Text Size ${result.effective.toFixed(1)} px is below ${MINIMUM_EFFECTIVE_TEXT_SIZE} px: smallest text ${+result.smallest.toFixed(2)} px × scale ${result.scale.toFixed(2)} into the ${slot.width}×${slot.height} slot (diagram ${result.svgAspect.toFixed(2)}:1, slot ${result.slotAspect.toFixed(2)}:1). The diagram is ${wider ? 'wider' : 'taller'} than its slot; ${fixes.join(', ')}.`;
}

function labels(svg) {
  const texts = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map(([, inner]) => inner.replace(/<[^>]+>/g, '').replace(/&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
    .filter(Boolean);
  return [...new Set(texts)];
}

function d2(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8' });
  if (result.error) throw new UsageError(`Could not run D2 at ${binary}: ${result.error.message}`);
  return { code: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

function d2Message(output, input, preamble) {
  const offset = preamble.split('\n').length - 1;
  return output
    .split(input).join('D2 source')
    .replace(/(^|\s)(\d+):(\d+):/gm, (_, lead, line, column) => `${lead}line ${Math.max(1, Number(line) - offset)}, column ${column}:`)
    .replace(/^(err|success):\s*/gm, '');
}

async function setup(options) {
  const binaryPath = D2_TOOL.cachePath(cacheRoot());
  if (options.status) {
    const resolution = resolveTool(D2_TOOL);
    if (!resolution.path) {
      console.log(missingToolMessage('D2', resolution, SETUP_COMMAND));
      return 1;
    }
    console.log(`✅ D2 at ${resolution.path} (from ${resolution.source})`);
    return 0;
  }
  const pin = D2_PINS[platformKey()];
  if (!pin) throw new UsageError(`No pinned D2 build for ${platformKey()}. Install D2 ${D2_VERSION} yourself and set D2_PATH.`);
  const [asset, digest] = pin;
  await installPinned({
    name: `D2 ${D2_VERSION}`,
    url: `https://github.com/terrastruct/d2/releases/download/v${D2_VERSION}/${asset}`,
    sha256: digest,
    installDirectory: path.dirname(path.dirname(path.dirname(binaryPath))),
    binaryPath,
  });
  return 0;
}

async function renderOrCheck(options) {
  if (!existsSync(options.input)) throw new UsageError(`${options.input} not found.`);
  const source = await readFile(options.input, 'utf8');
  const problems = sourceProblems(source);
  if (problems.length) throw new RuleError(`The diagram breaks ${problems.length} rule${problems.length === 1 ? '' : 's'}; nothing was written:\n${problems.map((p) => `   • ${p}`).join('\n')}\nUse role classes (${DIAGRAM_ROLES.join(', ')}) and quote labels with special characters, then rerun.`);

  const resolution = resolveTool(D2_TOOL);
  if (!resolution.path) throw new UsageError(missingToolMessage('D2', resolution, SETUP_COMMAND));
  if (resolution.source !== 'cache') {
    // Layouts change between D2 releases; checks were tuned on the pinned version.
    const version = d2(resolution.path, ['--version']).output.trim();
    if (!version.includes(D2_VERSION)) console.log(`⚠️  D2 from ${resolution.source} is ${version || 'an unknown version'}; this skill is tested with ${D2_VERSION}. Run \`${SETUP_COMMAND}\` to use the pinned version.`);
  }
  const theme = await themeValues(options.theme);
  const preamble = rolePreamble(theme);
  const darkCanvas = relativeLuminance(theme['--color-bg']) < 0.2;

  const work = mkdtempSync(path.join(os.tmpdir(), 'creating-diagrams-'));
  try {
    const input = path.join(work, 'diagram.d2');
    await writeFile(input, `${preamble}${source.endsWith('\n') ? source : `${source}\n`}`);
    const baseArgs = ['--layout=elk', '--pad=0', `--theme=${darkCanvas ? 200 : 0}`];
    const svgPath = path.join(work, 'diagram.svg');
    const rendered = d2(resolution.path, [...baseArgs, input, svgPath]);
    if (rendered.code !== 0) throw new RuleError(`D2 could not render the diagram:\n${d2Message(rendered.output, input, preamble)}`);
    const svg = await readFile(svgPath, 'utf8');
    const legibility = effectiveTextSize(svg, options.slot);
    if (!legibility) throw new RuleError('The rendered SVG has no usable viewBox.');
    if (!legibility.none && !legibility.pass) throw new RuleError(legibilityMessage(legibility, options.slot));
    const summary = legibility.none
      ? `no text to measure; fits the ${options.slot.width}×${options.slot.height} slot`
      : `Effective Text Size ${legibility.effective.toFixed(1)} px in the ${options.slot.width}×${options.slot.height} slot (diagram ${legibility.svgAspect.toFixed(2)}:1)`;

    if (options.command === 'check') {
      console.log(`✅ ${path.basename(options.input)}: ${summary} (nothing was written)`);
      console.log(`Labels: ${labels(svg).join(', ')}`);
      return 0;
    }

    const pngPath = path.join(work, 'diagram.png');
    const txtPath = path.join(work, 'diagram.txt');
    for (const [target, extraArgs] of [[pngPath, []], [txtPath, []]]) {
      const preview = d2(resolution.path, [...baseArgs, ...extraArgs, input, target]);
      if (preview.code !== 0) throw new RuleError(`D2 could not write the ${path.extname(target)} preview:\n${d2Message(preview.output, input, preamble)}`);
    }
    await mkdir(path.dirname(options.out), { recursive: true });
    const stem = options.out.replace(/\.svg$/, '');
    await rename(svgPath, options.out).catch(async () => writeFile(options.out, svg));
    await writeFile(`${stem}.png`, await readFile(pngPath));
    await writeFile(`${stem}.txt`, await readFile(txtPath));
    console.log(`✅ ${path.basename(options.out)}: ${summary}`);
    console.log(`Previews: ${path.basename(stem)}.png (look at it), ${path.basename(stem)}.txt (ASCII layout)`);
    console.log(`Labels: ${labels(svg).join(', ')}`);
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.command === 'setup') return setup(options);
  return renderOrCheck(options);
}

main(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    if (error instanceof RuleError) {
      process.stdout.write(`❌ ${error.message}\n`);
      process.exitCode = 1;
    } else if (error instanceof UsageError) {
      process.stderr.write(`❌ ${error.message}\n`);
      process.exitCode = 2;
    } else {
      process.stderr.write(`❌ ${error.stack ?? error.message}\n`);
      process.exitCode = 2;
    }
  });
