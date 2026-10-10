#!/usr/bin/env node
// creating-charts: install vl-convert, render a Vega-Lite spec with data from a file, and check legibility.
//
//   node scripts/creating-charts.mjs setup [--status]
//   node scripts/creating-charts.mjs render <spec.vl.json> --data <file.csv|json> --out <file.svg>
//          --alt "<takeaway>" --source "<where the data came from>" [--theme <values.json>] [--slot WxH]
//   node scripts/creating-charts.mjs check  <spec.vl.json> --data <file.csv|json> [--theme <values.json>] [--slot WxH]
//
// Exit codes: 0 success; 1 the chart breaks a rule or the legibility check;
//             2 usage, prerequisite, or internal error.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cacheRoot, installPinned, missingToolMessage, platformKey, resolveTool } from './tools.mjs';

const SETUP_COMMAND = 'node scripts/creating-charts.mjs setup';

// vl-convert 1.9.0: the latest stable release; v2 was still in release candidates.
// Digests are GitHub's published SHA-256 for each release asset.
const VL_VERSION = '1.9.0';
const VL_PINS = {
  'linux-x64': ['vl-convert_linux-64.zip', 'f557637a159c7510a1486e1e41a86c3919abd71c18abc0826b499c76c712aa53'],
  'linux-arm64': ['vl-convert_linux-aarch64.zip', '99a5f96436efbb46fa469b88c28c9c9d864c02c283f18c38fd2b730eeb0ea320'],
  'darwin-x64': ['vl-convert_osx-64.zip', '16c3e64b41fa80dbab219efe1eeb88700cf1ae421c566dbf799f17ecf9ea1084'],
  'darwin-arm64': ['vl-convert_osx-arm64.zip', '794a4182f3717a4730eb0dc8c08f290880a6a56c010f7335e32ceda7a1a3178e'],
};
const VL_TOOL = {
  envVar: 'VL_CONVERT_PATH',
  command: 'vl-convert',
  cachePath: (root) => path.join(root, 'vl-convert', VL_VERSION, 'bin', 'vl-convert'),
};
// Vega-Lite language version passed to vl-convert.
const VEGA_LITE_VERSION = '5.21';

// The Accessibility Bar's minimum text size on the 1280×720 slide reference.
const MINIMUM_TEXT_SIZE = 20;
// A 16:9 slide's content area: 1280×720 less the default theme padding.
const DEFAULT_SLOT = { width: 1164, height: 616 };
// Charts are drawn at their slot size, so these sizes are what the audience sees.
const LABEL_SIZE = 22;
// The Accessibility Bar's contrast minimums: graphics (marks) and text.
const MARK_CONTRAST = 3;
const TEXT_CONTRAST = 4.5;
const TITLE_SIZE = 24;

const NEUTRAL_THEME = {
  '--color-bg': '#ffffff',
  '--color-text': '#1f2328',
  '--color-surface': '#f6f8fa',
  '--color-muted': '#57606a',
  '--color-accent': '#b42318',
  '--color-on-accent': '#ffffff',
  '--font-body': 'Arial, Helvetica, sans-serif',
};

class UsageError extends Error {}
class RuleError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!['setup', 'render', 'check'].includes(command)) throw new UsageError(`Unknown command "${command ?? ''}". Use setup, render, or check.`);
  const options = { command, spec: null, data: null, out: null, theme: null, alt: null, source: null, slot: DEFAULT_SLOT, status: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new UsageError(`${argument} needs a value.`);
      index += 1;
      return next;
    };
    if (argument === '--data') options.data = path.resolve(value());
    else if (argument === '--out') options.out = path.resolve(value());
    else if (argument === '--theme') options.theme = path.resolve(value());
    else if (argument === '--alt') options.alt = value().trim();
    else if (argument === '--source') options.source = value().trim();
    else if (argument === '--slot') {
      const match = value().match(/^(\d+)x(\d+)$/);
      if (!match) throw new UsageError('--slot expects WIDTHxHEIGHT in px on the 1280×720 slide reference, for example 1164x480.');
      options.slot = { width: Number(match[1]), height: Number(match[2]) };
    } else if (argument === '--status') options.status = true;
    else if (argument.startsWith('--')) throw new UsageError(`Unknown option ${argument}.`);
    else if (options.spec) throw new UsageError(`Unexpected argument ${argument}.`);
    else options.spec = path.resolve(argument);
  }
  if (command === 'setup') return options;
  const missing = [];
  if (!options.spec) missing.push('a Vega-Lite spec file');
  if (!options.data) missing.push('--data <file.csv|json>');
  if (command === 'render') {
    if (!options.out) missing.push('--out <file.svg>');
    if (!options.alt) missing.push('--alt "<the chart\'s takeaway>"');
    if (!options.source) missing.push('--source "<where the data came from>"');
  }
  if (missing.length) throw new UsageError(`${command} needs ${missing.join(', ')}.`);
  if (options.out && !options.out.endsWith('.svg')) throw new UsageError('--out must end in .svg; the PNG preview and notes are written beside it.');
  return options;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) => Object.fromEntries(header.map((name, column) => {
    const cell = cells[column] ?? '';
    return [name.trim(), cell.trim() !== '' && !Number.isNaN(Number(cell)) ? Number(cell) : cell];
  })));
}

async function readData(file) {
  if (!existsSync(file)) throw new UsageError(`${file} not found.`);
  const text = await readFile(file, 'utf8');
  if (/\.json$/i.test(file)) {
    const values = JSON.parse(text);
    if (!Array.isArray(values)) throw new UsageError(`${file} must hold a JSON array of rows.`);
    return values;
  }
  if (/\.csv$/i.test(file)) return parseCsv(text);
  throw new UsageError(`--data must be a .csv or .json file, got ${path.basename(file)}.`);
}

function specProblems(spec) {
  const problems = [];
  const walk = (node, where) => {
    if (!node || typeof node !== 'object') return;
    if (node.data && (node.data.values !== undefined || node.data.url !== undefined)) problems.push(`${where}: data must come from the --data file, not from values or a URL in the spec`);
    if (Array.isArray(node)) node.forEach((item, index) => walk(item, `${where}[${index}]`));
    else for (const [key, value] of Object.entries(node)) if (key !== 'data') walk(value, `${where}.${key}`);
  };
  walk(spec, 'spec');
  if (spec.params?.some?.((param) => param.select || param.bind)) problems.push('spec.params: interactive selections and bindings are out of scope; charts are static');
  return problems;
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
  for (const key of ['--color-bg', '--color-text', '--color-muted', '--color-accent']) {
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(merged[key])) throw new UsageError(`Theme value ${key} must be a hex colour, got "${merged[key]}".`);
  }
  return merged;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Marks and their labels use these colours on the chart background (WCAG 1.4.11 and 1.4.3).
function contrastProblems(theme) {
  const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const problems = [];
  for (const [key, minimum] of [['--color-accent', MARK_CONTRAST], ['--color-muted', MARK_CONTRAST], ['--color-text', TEXT_CONTRAST]]) {
    const value = ratio(theme[key], theme['--color-bg']);
    if (value < minimum) problems.push(`${key} (${theme[key]}) on --color-bg (${theme['--color-bg']}) is ${value.toFixed(2)}:1; chart ${key === '--color-text' ? 'text' : 'marks'} need ${minimum}:1`);
  }
  return problems;
}

// A Vega-Lite config from the theme values: colours by meaning, slot-size text.
function themeConfig(theme) {
  const text = theme['--color-text'];
  const muted = theme['--color-muted'];
  const font = theme['--font-body'];
  return {
    background: theme['--color-bg'],
    font,
    padding: 8,
    view: { stroke: null },
    axis: {
      labelFontSize: LABEL_SIZE, titleFontSize: TITLE_SIZE, labelColor: text, titleColor: text,
      domainColor: muted, tickColor: muted, gridColor: muted, gridOpacity: 0.35, titleFontWeight: 'normal',
    },
    // Rotated labels slow reading; long category names should be shortened instead.
    axisX: { labelAngle: 0 },
    legend: { labelFontSize: LABEL_SIZE, titleFontSize: TITLE_SIZE, labelColor: text, titleColor: text, symbolSize: 300 },
    header: { labelFontSize: LABEL_SIZE, titleFontSize: TITLE_SIZE, labelColor: text, titleColor: text },
    title: { fontSize: TITLE_SIZE + 4, color: text, fontWeight: 'normal' },
    text: { fontSize: LABEL_SIZE, color: text },
    mark: { color: theme['--color-accent'] },
    range: { category: [theme['--color-accent'], text, muted] },
  };
}

// A spec's own config refines the theme's per section (axis, legend, …) rather than replacing it.
function mergeConfig(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object'
      ? { ...base[key], ...value }
      : value;
  }
  return merged;
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Gives the SVG an accessible name, so it carries its alt text wherever it is used.
function withTitle(svg, alt) {
  return svg.replace(/^(\s*<svg\b[^>]*>)/, `$1<title>${escapeXml(alt)}</title>`);
}

function markdownTable(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (value) => String(value).replace(/\|/g, '\\|');
  return [
    `| ${columns.map(escape).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => escape(row[column] ?? '')).join(' | ')} |`),
  ].join('\n');
}

function textSizes(svg) {
  return [...svg.matchAll(/<text\b[^>]*>/gi)].map(([tag]) => Number(tag.match(/font-size\s*[:=]\s*["']?\s*([\d.]+)/i)?.[1])).filter((size) => size > 0);
}

function vl(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8' });
  if (result.error) throw new UsageError(`Could not run vl-convert at ${binary}: ${result.error.message}`);
  return { code: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

async function setup(options) {
  if (options.status) {
    const resolution = resolveTool(VL_TOOL);
    if (!resolution.path) {
      console.log(missingToolMessage('vl-convert', resolution, SETUP_COMMAND));
      return 1;
    }
    console.log(`✅ vl-convert at ${resolution.path} (from ${resolution.source})`);
    return 0;
  }
  const pin = VL_PINS[platformKey()];
  if (!pin) throw new UsageError(`No pinned vl-convert build for ${platformKey()}. Install vl-convert ${VL_VERSION} yourself and set VL_CONVERT_PATH.`);
  const [asset, digest] = pin;
  const binaryPath = VL_TOOL.cachePath(cacheRoot());
  await installPinned({
    name: `vl-convert ${VL_VERSION}`,
    url: `https://github.com/vega/vl-convert/releases/download/v${VL_VERSION}/${asset}`,
    sha256: digest,
    installDirectory: path.dirname(path.dirname(binaryPath)),
    binaryPath,
  });
  return 0;
}

async function renderOrCheck(options) {
  if (!existsSync(options.spec)) throw new UsageError(`${options.spec} not found.`);
  let spec;
  try {
    spec = JSON.parse(await readFile(options.spec, 'utf8'));
  } catch (error) {
    throw new UsageError(`${options.spec} is not valid JSON: ${error.message}`);
  }
  const problems = specProblems(spec);
  if (problems.length) throw new RuleError(`The chart breaks ${problems.length} rule${problems.length === 1 ? '' : 's'}; nothing was written:\n${problems.map((p) => `   • ${p}`).join('\n')}`);
  const rows = await readData(options.data);
  if (!rows.length) throw new RuleError(`${path.basename(options.data)} has no data rows.`);

  const theme = await themeValues(options.theme);
  const faint = contrastProblems(theme);
  if (faint.length) throw new RuleError(`The theme's colours would make the chart hard to read; nothing was written:\n${faint.map((p) => `   • ${p}`).join('\n')}\nUse darker (or, on a dark background, lighter) shades.`);
  const resolution = resolveTool(VL_TOOL);
  if (!resolution.path) throw new UsageError(missingToolMessage('vl-convert', resolution, SETUP_COMMAND));

  const full = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    ...spec,
    data: { values: rows },
    width: spec.width ?? 'container',
    height: spec.height ?? 'container',
    autosize: { type: 'fit', contains: 'padding' },
    ...(options.alt ? { description: options.alt } : {}),
    config: mergeConfig(themeConfig(theme), spec.config ?? {}),
  };
  // vl-convert has no container, so give it the slot size explicitly.
  if (full.width === 'container') full.width = options.slot.width;
  if (full.height === 'container') full.height = options.slot.height;

  const work = mkdtempSync(path.join(os.tmpdir(), 'creating-charts-'));
  try {
    const input = path.join(work, 'chart.vl.json');
    await writeFile(input, JSON.stringify(full));
    const svgPath = path.join(work, 'chart.svg');
    // No external data: every number comes from the --data file.
    const common = ['--input', input, '--vl-version', VEGA_LITE_VERSION, '--allowed-base-url', 'https://data.invalid/'];
    const rendered = vl(resolution.path, ['vl2svg', ...common, '--output', svgPath]);
    if (rendered.code !== 0) throw new RuleError(`vl-convert could not render the chart:\n${rendered.output}`);
    const svg = await readFile(svgPath, 'utf8');
    const sizes = textSizes(svg);
    const smallest = sizes.length ? Math.min(...sizes) : null;
    if (smallest !== null && smallest < MINIMUM_TEXT_SIZE) {
      throw new RuleError(`Chart text of ${smallest} px is below ${MINIMUM_TEXT_SIZE} px at the ${options.slot.width}×${options.slot.height} slot. Remove font-size overrides below ${MINIMUM_TEXT_SIZE} px, shorten labels, or give the chart a larger slot.`);
    }
    const summary = smallest === null ? 'no text to measure' : `smallest text ${smallest} px at the ${options.slot.width}×${options.slot.height} slot`;

    if (options.command === 'check') {
      console.log(`✅ ${path.basename(options.spec)}: ${summary} (nothing was written)`);
      return 0;
    }

    const pngPath = path.join(work, 'chart.png');
    const png = vl(resolution.path, ['vl2png', ...common, '--output', pngPath]);
    if (png.code !== 0) throw new RuleError(`vl-convert could not write the PNG preview:\n${png.output}`);
    const stem = options.out.replace(/\.svg$/, '');
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, withTitle(svg, options.alt));
    await copyFile(pngPath, `${stem}.png`);
    if (path.resolve(options.spec) !== path.resolve(`${stem}.vl.json`)) await copyFile(options.spec, `${stem}.vl.json`);
    const dataTarget = `${stem}${path.extname(options.data).toLowerCase()}`;
    if (path.resolve(options.data) !== path.resolve(dataTarget)) await copyFile(options.data, dataTarget);
    const notes = [
      `Alt text: ${options.alt}`,
      '',
      `Source: ${options.source}`,
      '',
      'Data:',
      '',
      markdownTable(rows),
      '',
    ].join('\n');
    await writeFile(`${stem}.md`, notes);
    console.log(`✅ ${path.basename(options.out)}: ${summary}`);
    console.log(`Wrote ${path.basename(stem)}.png (look at it), ${path.basename(stem)}.md (alt text, source, data table), and the spec and data beside the SVG.`);
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
