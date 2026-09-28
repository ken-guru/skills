#!/usr/bin/env node

import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveTheme } from '../../generate-slides/scripts/theme-resolution.mjs';

export const RUNTIME_VERSION = '1.0.0';
export const REPORT_SCHEMA_VERSION = 1;

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const THEMES_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '../../generate-slides/themes');
const PROFILES = new Set(['generation', 'proofread']);
const CHECKS = ['env', 'structure', 'media', 'media-spec', 'theme', 'exports', 'sources'];

const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const readText = async (file) => readFile(file, 'utf8');
const readJson = async (file) => JSON.parse(await readText(file));
const rel = (projectDirectory, file) => path.relative(projectDirectory, file) || '.';

function createReport(projectDirectory, profile) {
  const findings = [];
  const finding = (check, severity, message, details = {}) => {
    findings.push({
      check,
      severity,
      message,
      path: details.path ?? null,
      slide: details.slide ?? null,
      evidence: details.evidence ?? null,
      remediation: details.remediation ?? null,
      skipped: details.skipped ?? false,
      reason: details.reason ?? null,
      ...details,
    });
  };
  return {
    projectDirectory,
    profile,
    findings,
    finding,
    summary() {
      return {
        blocking: findings.filter((item) => item.severity === 'blocking').length,
        warning: findings.filter((item) => item.severity === 'warning').length,
        info: findings.filter((item) => item.severity === 'info').length,
        skipped: findings.filter((item) => item.skipped).length,
      };
    },
  };
}

async function projectInputs(projectDirectory, report) {
  let discovery;
  let project;
  try {
    discovery = await readJson(path.join(projectDirectory, 'DISCOVERY.json'));
  } catch (error) {
    report.finding('structure.project', 'blocking', 'DISCOVERY.json is missing or invalid.', {
      path: 'DISCOVERY.json',
      evidence: error.message,
      remediation: 'Run discover-presentation or repair the Project Folder.',
    });
  }
  try {
    project = await readJson(path.join(projectDirectory, 'PROJECT.json'));
  } catch (error) {
    report.finding('structure.project', 'blocking', 'PROJECT.json is missing or invalid.', {
      path: 'PROJECT.json',
      evidence: error.message,
      remediation: 'Run discover-presentation or repair the Project Folder.',
    });
  }
  if (project && project.projectType !== 'presentation') {
    report.finding('structure.project', 'blocking', 'PROJECT.json is not a presentation Project Type.', {
      path: 'PROJECT.json',
      evidence: `projectType=${project.projectType}`,
      remediation: 'Use a Project Folder with projectType presentation.',
    });
  }
  const paths = discovery?.paths ?? {};
  const projectPath = (key, fallback) => path.resolve(projectDirectory, paths[key] ?? fallback);
  return {
    projectDirectory,
    discovery,
    project,
    agenda: projectPath('agenda', 'AGENDA.md'),
    presentation: projectPath('presentation', 'PRESENTASJON.md'),
    html: projectPath('html', 'PRESENTASJON.html'),
    pdf: projectPath('pdf', 'PRESENTASJON.pdf'),
    imageSpec: projectPath('imageSpec', 'IMAGE_SPEC.md'),
    diagramSpec: projectPath('diagramSpec', 'DIAGRAM_SPEC.md'),
    images: projectPath('images', 'images/'),
    sources: projectPath('sources', 'docs/sources/'),
    themes: projectPath('themes', 'themes/'),
  };
}

function frontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { values: {}, body: markdown };
  const values = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { values, body: markdown.slice(match[0].length) };
}

function slidesFrom(markdown) {
  return frontMatter(markdown).body.split(/^---\s*$/m).map((slide) => slide.trim()).filter(Boolean);
}

async function checkEnvironment(inputs, report) {
  const commands = ['node'];
  if (report.profile === 'generation' || report.profile === 'proofread') commands.push('marp');
  const needsD2 = (await exists(inputs.diagramSpec)) || mediaReferences(await readTextIfPresent(inputs.presentation)).some((file) => /\.svg$/i.test(file));
  if (needsD2) commands.push('d2');
  for (const command of commands) {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    if (result.error || result.status !== 0) {
      report.finding('env.prerequisites', 'blocking', `${command} is unavailable.`, {
        evidence: result.error?.message ?? `exit ${result.status}`,
        remediation: `Install or expose ${command}, then rerun validation.`,
      });
      report.missingPrerequisites.add(command);
    } else {
      report.finding('env.prerequisites', 'info', `${command} is available.`);
    }
  }
  return report.missingPrerequisites;
}

async function readTextIfPresent(file) {
  return (await exists(file)) ? readText(file) : '';
}

async function checkStructure(inputs, report) {
  if (!(await exists(inputs.presentation))) {
    report.finding('structure.presentation', 'blocking', 'Presentation Markdown is missing.', {
      path: rel(report.projectDirectory, inputs.presentation),
      remediation: 'Run generate-slides before validating generated structure.',
    });
    return;
  }
  const markdown = await readText(inputs.presentation);
  const { values } = frontMatter(markdown);
  const expected = { marp: 'true', theme: inputs.discovery?.theme?.id, size: '16:9', paginate: 'true' };
  for (const [key, value] of Object.entries(expected)) {
    if (value !== undefined && values[key] !== value) {
      report.finding('structure.front-matter', 'blocking', `Front matter ${key} is invalid.`, {
        path: rel(report.projectDirectory, inputs.presentation),
        evidence: `expected ${value}, found ${values[key] ?? 'missing'}`,
        remediation: 'Regenerate the presentation with the selected Theme Package.',
      });
    }
  }
  if (inputs.discovery?.language && values.lang !== inputs.discovery.language) {
    report.finding('structure.front-matter', 'blocking', 'Presentation language does not match Discovery.', {
      path: rel(report.projectDirectory, inputs.presentation),
      evidence: `expected ${inputs.discovery.language}, found ${values.lang ?? 'missing'}`,
    });
  }
  const slides = slidesFrom(markdown);
  if (!slides.length) {
    report.finding('structure.slides', 'blocking', 'No slides were found.', { path: rel(report.projectDirectory, inputs.presentation) });
    return;
  }
  report.finding('structure.slides', 'info', `Found ${slides.length} slides.`, { value: slides.length });
  slides.forEach((slide, index) => {
    const classes = [...slide.matchAll(/<!--\s*_class:\s*([^>]+?)\s*-->/g)].map((match) => match[1]);
    if (classes.length !== 1) {
      report.finding('structure.semantic-markup', 'blocking', `Slide ${index + 1} must declare exactly one archetype class.`, {
        slide: index + 1,
        evidence: classes.join(', ') || 'none',
      });
    } else {
      const classTokens = classes[0].split(/\s+/);
      const archetype = classTokens.find((token) => token.startsWith('archetype-'))?.slice(10);
      const variation = classTokens.find((token) => token.startsWith('variation-'));
      const tone = classTokens.find((token) => token.startsWith('tone-'));
      if (!archetype || !variation || !tone) {
        report.finding('structure.semantic-markup', 'blocking', `Slide ${index + 1} has incomplete archetype metadata.`, {
          slide: index + 1,
          evidence: classes[0],
          remediation: 'Regenerate the slide with archetype, variation, and tonal state classes.',
        });
      }
      const requiredSlot = {
        title: 'slot-title',
        section: 'slot-title',
        'text-only': 'slot-heading',
        'text-plus-image': 'slot-heading',
        data: 'slot-heading',
        diagram: 'slot-heading',
        quotation: 'slot-quote',
      }[archetype];
      if (requiredSlot && !slide.includes(requiredSlot)) {
        report.finding('structure.content-slots', 'blocking', `Slide ${index + 1} is missing its ${requiredSlot} Content Slot.`, {
          slide: index + 1,
          evidence: classes[0],
          remediation: 'Regenerate the slide using the shared Semantic Slide Markup contract.',
        });
      }
    }
    if (!/<h[12][^>]*class=["'][^"']*slot-(?:title|heading)/i.test(slide) && !/class=["'][^"']*slot-quote/i.test(slide)) {
      report.finding('structure.semantic-markup', 'warning', `Slide ${index + 1} has no recognizable semantic heading slot.`, { slide: index + 1 });
    }
    const bullets = (slide.match(/<li\b/gi) ?? []).length;
    if (bullets > 5) {
      report.finding('structure.capacity', 'warning', `Slide ${index + 1} contains ${bullets} bullets.`, {
        slide: index + 1,
        evidence: 'Content Capacity heuristics recommend no more than five bullets.',
      });
    }
  });
}

function specFilenames(text) {
  return [...text.matchAll(/\*\*Filename:\*\*\s*`([^`]+)`/g)].map((match) => match[1]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripNonMarkupBlocks(text) {
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function mediaReferences(text) {
  return [...stripNonMarkupBlocks(text).matchAll(/(?:src|href)=["']([^"']+)["']|!\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1] ?? match[2])
    .filter((reference) => !/^https?:/i.test(reference));
}

// Valid SVG may open with a BOM, XML declaration, comments, or DOCTYPE before
// the root element; D2 emits an XML declaration by default.
function svgRootTag(svg) {
  const body = svg.replace(/^﻿?(?:\s+|<\?xml\b[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE\b[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i, '');
  return body.match(/^<svg\b[^>]*>/i)?.[0];
}

async function checkMedia(inputs, report) {
  const presentation = await readTextIfPresent(inputs.presentation);
  const agenda = await readTextIfPresent(inputs.agenda);
  const references = [...new Set(mediaReferences(`${agenda}\n${presentation}`))].filter((file) => /\.(png|jpe?g|webp|gif|svg)$/i.test(file));
  const imageNames = specFilenames(await readTextIfPresent(inputs.imageSpec));
  const diagramNames = specFilenames(await readTextIfPresent(inputs.diagramSpec));
  const imageDeclared = references.some((file) => !/\.svg$/i.test(file));
  const diagramDeclared = references.some((file) => /\.svg$/i.test(file));
  if (imageDeclared && !(await exists(inputs.imageSpec))) {
    report.finding('media.image-spec', 'blocking', 'Picture references exist but IMAGE_SPEC.md is missing.', { path: rel(report.projectDirectory, inputs.imageSpec) });
  }
  if (diagramDeclared && !(await exists(inputs.diagramSpec))) {
    report.finding('media.diagram-spec', 'blocking', 'Diagram references exist but DIAGRAM_SPEC.md is missing.', { path: rel(report.projectDirectory, inputs.diagramSpec) });
  }
  const specNames = new Set([...imageNames, ...diagramNames]);
  for (const reference of references) {
    const normalized = reference.replace(/^\.\//, '');
    if (!specNames.has(normalized) && !specNames.has(path.basename(normalized))) {
      report.finding('media.references', 'blocking', `Media reference ${reference} has no Media Spec entry.`, { evidence: reference });
    }
    const asset = path.resolve(inputs.projectDirectory, normalized);
    if (!(await exists(asset))) {
      report.finding('media.assets', 'blocking', `Referenced media asset ${reference} is missing.`, { path: normalized });
      continue;
    }
    if (/\.svg$/i.test(asset)) {
      const rootTag = svgRootTag(await readText(asset));
      if (!rootTag) {
        report.finding('media.svg', 'blocking', `SVG ${reference} root element is not <svg>.`, { path: normalized });
      } else if (!/\sviewBox=["'][^"']+["']/i.test(rootTag)) {
        report.finding('media.svg', 'blocking', `SVG ${reference} root <svg> has no viewBox.`, { path: normalized });
      }
    }
    if (/<img\b/i.test(presentation) && new RegExp(`<img[^>]+src=["']${escapeRegExp(reference)}["'][^>]*>`, 'i').test(presentation)) {
      const imageTag = presentation.match(new RegExp(`<img[^>]+src=["']${escapeRegExp(reference)}["'][^>]*>`, 'i'))?.[0] ?? '';
      if (!/\balt=["'][^"']+["']/i.test(imageTag)) {
        report.finding('media.alternative-text', 'blocking', `Media ${reference} has no alternative text.`, { path: normalized, remediation: 'Add purpose-based alt text or explicitly mark decorative media with empty alt text.' });
      }
    }
  }
  for (const specName of specNames) {
    if (!references.some((reference) => reference === specName || path.basename(reference) === path.basename(specName))) {
      report.finding('media.orphans', 'warning', `Media Spec entry ${specName} is not referenced by the Agenda or presentation.`, { evidence: specName });
    }
  }
}

// --- Diagram checks -------------------------------------------------------
// Generate Diagrams' render command applies the same role rule and Effective
// Text Size; each owner keeps its own copy so installed Skills stay
// self-contained.

const DIAGRAM_NODE_ROLES = ['base', 'emphasis', 'muted', 'risk', 'boundary'];
const DIAGRAM_ROLES = [...DIAGRAM_NODE_ROLES, 'flow', 'optional-flow', 'risk-flow'];

function diagramSpecEntries(text) {
  const entries = [];
  for (const section of text.split(/^## /m).slice(1)) {
    const lines = section.split('\n');
    const heading = lines[0].match(/^Slide (\d+)\s+[—–-]\s+(.+?)\s*$/);
    if (!heading) continue;
    const open = lines.findIndex((line) => /^\s*(`{3,}|~{3,})\s*d2\s*$/.test(line));
    const fence = open === -1 ? null : lines[open].trim().match(/^(`{3,}|~{3,})/)[1];
    const close = open === -1 ? -1 : lines.findIndex((line, index) => index > open && line.trim() === fence);
    entries.push({
      slide: Number(heading[1]),
      filename: section.match(/\*\*Filename:\*\*\s*`([^`]+)`/)?.[1] ?? null,
      source: close === -1 ? '' : lines.slice(open + 1, close).join('\n'),
    });
  }
  return entries;
}

function diagramRoleProblems(source) {
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

async function checkMediaSpec(inputs, report) {
  if (!(await exists(inputs.diagramSpec))) return;
  const entries = diagramSpecEntries(await readText(inputs.diagramSpec));
  for (const entry of entries) {
    const problems = diagramRoleProblems(entry.source);
    if (!problems.length) continue;
    report.finding('media.diagram-roles', 'blocking', `Slide ${entry.slide} diagram styles D2 outside the Diagram Roles.`, {
      path: rel(report.projectDirectory, inputs.diagramSpec),
      slide: entry.slide,
      evidence: problems.join('; '),
      remediation: `Replace colors, font sizes, and custom classes with class: <role> (${DIAGRAM_ROLES.join(', ')}).`,
    });
  }
  if (entries.length) report.finding('media.diagram-roles', 'info', `Checked Diagram Role usage in ${entries.length} Diagram Spec entries.`);
}

// Effective Text Size: the smallest <text> font-size times the contain scale
// into the diagram media box must reach 20 px.
const MINIMUM_EFFECTIVE_TEXT_SIZE = 20;

function effectiveTextSize(svg, box) {
  const viewBox = svgRootTag(svg)?.match(/\sviewBox=["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const [width, height] = viewBox?.slice(2) ?? [];
  if (!(width > 0 && height > 0)) return null;
  const sizes = [...svg.matchAll(/<text\b[^>]*>/gi)]
    .map(([tag]) => Number(tag.match(/font-size\s*[:=]\s*["']?\s*([\d.]+)/i)?.[1]))
    .filter((size) => size > 0);
  if (!sizes.length) return null;
  const smallest = Math.min(...sizes);
  const scale = Math.min(box.width / width, box.height / height);
  const effective = smallest * scale;
  return { smallest, scale, effective, svgAspect: width / height, slotAspect: box.width / box.height, pass: effective >= MINIMUM_EFFECTIVE_TEXT_SIZE };
}

async function lockedThemeManifest(inputs) {
  try {
    const lock = await readJson(path.join(inputs.themes, 'theme-lock.json'));
    return await readJson(path.join(inputs.themes, lock.id, 'theme.json'));
  } catch {
    return null;
  }
}

async function checkDiagramLegibility(inputs, report) {
  if (!(await exists(inputs.diagramSpec))) return;
  const diagrams = [];
  for (const entry of diagramSpecEntries(await readText(inputs.diagramSpec))) {
    if (!entry.filename || !/\.svg$/i.test(entry.filename)) continue;
    const file = path.resolve(inputs.projectDirectory, entry.filename);
    if (await exists(file)) diagrams.push({ ...entry, file });
  }
  if (!diagrams.length) return;
  const manifest = await lockedThemeManifest(inputs);
  const box = manifest?.archetypes?.diagram?.mediaBox;
  if (!(box?.width > 0 && box?.height > 0)) {
    report.finding('media.svg-legibility', 'blocking', 'Diagram legibility cannot be checked: the locked Theme Manifest has no diagram media box.', {
      path: rel(report.projectDirectory, inputs.themes),
      remediation: 'Refresh the theme in generate-slides, then re-render the diagrams.',
    });
    return;
  }
  const roleSizes = Object.values(manifest.diagramRoles ?? {}).map((role) => role.fontSize).filter((size) => size > 0);
  for (const diagram of diagrams) {
    const result = effectiveTextSize(await readText(diagram.file), box);
    if (!result) continue;
    const details = { path: rel(report.projectDirectory, diagram.file), slide: diagram.slide, value: Number(result.effective.toFixed(2)) };
    if (result.pass) {
      report.finding('media.svg-legibility', 'info', `Slide ${diagram.slide} diagram text reaches ${result.effective.toFixed(1)} px Effective Text Size.`, details);
      continue;
    }
    const wider = result.svgAspect > result.slotAspect;
    const fixes = wider
      ? ['shorten labels', 'use `direction: down`', 'split it into two diagrams']
      : ['use `direction: right`', 'reduce the number of rows', 'split it into two diagrams'];
    if (roleSizes.length && result.smallest < Math.min(...roleSizes)) fixes.unshift('give every shape and connection a role class');
    fixes.push('or ask for a larger role font size in the Theme Package');
    const evidence = `smallest text ${+result.smallest.toFixed(2)} px × scale ${result.scale.toFixed(2)} into the ${box.width}×${box.height} diagram slot (SVG ${result.svgAspect.toFixed(2)}:1, slot ${result.slotAspect.toFixed(2)}:1)`;
    report.finding('media.svg-legibility', 'blocking', `Slide ${diagram.slide} diagram: Effective Text Size ${result.effective.toFixed(1)} px is below ${MINIMUM_EFFECTIVE_TEXT_SIZE} px: ${evidence}.`, {
      ...details,
      evidence,
      remediation: `The diagram is ${wider ? 'wider' : 'taller'} than the slot: ${fixes.join(', ')}; then re-render it with generate-diagrams.`,
    });
  }
}

async function checkTheme(inputs, report) {
  const lockPath = path.join(inputs.themes, 'theme-lock.json');
  if (!(await exists(lockPath))) {
    report.finding('theme.integrity', 'blocking', 'Project Theme snapshot is missing theme-lock.json.', {
      path: rel(report.projectDirectory, lockPath),
      remediation: 'Run the Theme preparation step before validating generated outputs.',
    });
    return;
  }
  try {
    const lock = await readJson(lockPath);
    const requested = inputs.discovery?.theme?.id;
    if (requested && lock.id !== requested) {
      report.finding('theme.integrity', 'blocking', 'Theme lock identity does not match Discovery.', {
        path: rel(report.projectDirectory, lockPath),
        evidence: `expected ${requested}, found ${lock.id ?? 'missing'}`,
        remediation: 'Regenerate the project Theme Package after confirming the theme choice.',
      });
      return;
    }
  } catch (error) {
    report.finding('theme.integrity', 'blocking', 'Theme lock is invalid JSON.', { path: rel(report.projectDirectory, lockPath), evidence: error.message });
    return;
  }
  try {
    const resolution = await resolveTheme({
      discovery: inputs.discovery ?? {},
      themesDirectory: THEMES_DIRECTORY,
      projectThemesDirectory: inputs.themes,
    });
    report.finding('theme.integrity', 'info', `Theme Package ${resolution.id} is valid.`, {
      evidence: `${resolution.source}; ${resolution.manifest.packageVersion}`,
    });
  } catch (error) {
    report.finding('theme.integrity', 'blocking', error.message, {
      path: rel(report.projectDirectory, inputs.themes),
      evidence: error.code ?? 'INVALID_THEME_PACKAGE',
      remediation: 'Regenerate or repair the locked Theme Package.',
    });
  }
}

function countHtmlSlides(html) {
  return (html.match(/<section\b/gi) ?? []).length;
}

function inflateFlateStreams(buffer) {
  const text = buffer.toString('latin1');
  const dictStream = /<<([^>]*?)>>\s*stream\r?\n/g;
  const decoded = [];
  let match;
  while ((match = dictStream.exec(text))) {
    if (!/\/Filter\s*(?:\/FlateDecode\b|\[[^\]]*\/FlateDecode\b[^\]]*\])/.test(match[1])) continue;
    const start = match.index + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end === -1) continue;
    let trimmed = end;
    while (trimmed > start && (text[trimmed - 1] === '\n' || text[trimmed - 1] === '\r')) trimmed--;
    try {
      decoded.push(inflateSync(buffer.subarray(start, trimmed)).toString('latin1'));
    } catch {
      // Not plain zlib data (extra filters, encryption, or boundary drift) — skip; the raw scan still covers uncompressed objects.
    }
  }
  return decoded.join('\n');
}

function pdfSearchableText(buffer) {
  return `${buffer.toString('latin1')}\n${inflateFlateStreams(buffer)}`;
}

function countPdfPages(searchableText) {
  return (searchableText.match(/\/Type\s*\/Page\b/g) ?? []).length;
}

async function checkExports(inputs, report) {
  const required = report.profile === 'proofread' || report.profile === 'generation';
  const htmlExists = await exists(inputs.html);
  const pdfExists = await exists(inputs.pdf);
  if (required && !htmlExists) report.finding('exports.html', 'blocking', 'HTML export is missing.', { path: rel(report.projectDirectory, inputs.html) });
  if (required && !pdfExists) report.finding('exports.pdf', 'blocking', 'PDF export is missing.', { path: rel(report.projectDirectory, inputs.pdf) });
  if (!htmlExists || !pdfExists) return;
  const html = await readText(inputs.html);
  const pdf = await readFile(inputs.pdf);
  const pdfText = pdfSearchableText(pdf);
  const htmlSlides = countHtmlSlides(html);
  const pdfSlides = countPdfPages(pdfText);
  if (!htmlSlides || !pdfSlides || htmlSlides !== pdfSlides) {
    report.finding('exports.parity', report.profile === 'proofread' ? 'blocking' : 'warning', 'HTML and PDF slide counts do not match.', {
      evidence: `HTML ${htmlSlides}; PDF ${pdfSlides}`,
    });
  } else {
    report.finding('exports.parity', 'info', `HTML and PDF both contain ${htmlSlides} slides.`, { value: htmlSlides });
  }
  const mediaBox = pdfText.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  if (mediaBox) {
    const ratio = Number(mediaBox[1]) / Number(mediaBox[2]);
    if (Math.abs(ratio - 16 / 9) > 0.03) {
      report.finding('exports.dimensions', report.profile === 'proofread' ? 'blocking' : 'warning', 'PDF dimensions are not 16:9.', { evidence: `${mediaBox[1]} × ${mediaBox[2]}` });
    }
  } else {
    report.finding('exports.dimensions', 'warning', 'PDF dimensions could not be read from the export.');
  }
  const markdownMedia = new Set(mediaReferences(await readTextIfPresent(inputs.presentation)).map((file) => path.basename(file)));
  const htmlMedia = new Set(mediaReferences(html).map((file) => path.basename(file)));
  if (markdownMedia.size !== htmlMedia.size || [...markdownMedia].some((file) => !htmlMedia.has(file))) {
    report.finding('exports.media-parity', report.profile === 'proofread' ? 'blocking' : 'warning', 'HTML media references do not match Presentation Markdown media references.', {
      evidence: `Markdown: ${[...markdownMedia].join(', ') || 'none'}; HTML: ${[...htmlMedia].join(', ') || 'none'}`,
    });
  }
}

async function checkSources(inputs, report) {
  const text = `${await readTextIfPresent(inputs.agenda)}\n${await readTextIfPresent(inputs.presentation)}`;
  const urls = [...new Set([...text.matchAll(/\[Source\]\((https?:[^)]+)\)/g)].map((match) => match[1]))];
  if (!urls.length) {
    report.finding('sources.coverage', 'info', 'No external source references were declared.');
    return;
  }
  if (!(await exists(inputs.sources))) {
    report.finding('sources.coverage', 'blocking', 'Source references exist but the sources directory is missing.', { path: rel(report.projectDirectory, inputs.sources) });
    return;
  }
  const files = await readdir(inputs.sources);
  const contents = await Promise.all(files.map(async (file) => `${file}\n${await readTextIfPresent(path.join(inputs.sources, file))}`));
  const missing = urls.filter((url) => !contents.some((content) => content.includes(url)));
  if (!files.length || missing.length) {
    report.finding('sources.coverage', report.profile === 'proofread' ? 'blocking' : 'warning', 'Some source references have no matching source summary or fetch-failure record.', {
      path: rel(report.projectDirectory, inputs.sources),
      evidence: missing.join(', ') || 'no source files',
      remediation: 'Add source summaries or record explicit fetch failures for every source URL.',
    });
  } else {
    report.finding('sources.coverage', 'info', `${urls.length} source references have ${files.length} source files available.`, { value: { urls: urls.length, files: files.length } });
  }
}

async function validate({ projectDirectory, profile, checks }) {
  const report = createReport(projectDirectory, profile);
  report.missingPrerequisites = new Set();
  const inputs = await projectInputs(projectDirectory, report);
  report.inputs = inputs;
  if (checks.includes('env')) await checkEnvironment(inputs, report);
  const dependentChecks = checks.filter((check) => check !== 'env');
  if (report.missingPrerequisites.size) {
    for (const check of dependentChecks) {
      report.finding(`${check}.skipped`, 'blocking', `Skipped ${check} checks because required prerequisites are unavailable.`, {
        skipped: true,
        reason: [...report.missingPrerequisites].join(', '),
        remediation: 'Install the reported prerequisites and rerun validation.',
      });
    }
    return report;
  }
  if (checks.includes('structure')) await checkStructure(inputs, report);
  if (checks.includes('media')) await checkMedia(inputs, report);
  if (checks.includes('media')) await checkDiagramLegibility(inputs, report);
  if (checks.includes('media-spec')) await checkMediaSpec(inputs, report);
  if (checks.includes('theme')) await checkTheme(inputs, report);
  if (checks.includes('exports')) await checkExports(inputs, report);
  if (checks.includes('sources')) await checkSources(inputs, report);
  return report;
}

function parseArguments(argv) {
  const args = [...argv];
  if (args[0] === '--version') return { version: true };
  if (args.shift() !== 'check') throw new Error('Usage: presentation-validation check <all|check-name> --project-dir <path> [--profile generation|proofread]');
  const target = args.shift() ?? 'all';
  const options = { target, projectDirectory: '.', profile: 'proofread', format: 'human', report: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--project-dir' || argument === '--profile' || argument === '--format' || argument === '--report') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
      options[{ '--project-dir': 'projectDirectory', '--profile': 'profile', '--format': 'format', '--report': 'report' }[argument]] = value;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option ${argument}.`);
    }
  }
  if (!['human', 'json'].includes(options.format)) throw new Error('--format must be human or json.');
  if (!PROFILES.has(options.profile)) throw new Error('--profile must be generation or proofread.');
  const checks = target === 'all' ? CHECKS : [target];
  if (checks.some((check) => !CHECKS.includes(check))) throw new Error(`Unknown check. Choose all or: ${CHECKS.join(', ')}.`);
  return { ...options, checks };
}

function exitCode(report, invocationError = false) {
  if (invocationError) return 2;
  if (report.findings.some((finding) => finding.check === 'structure.project' && finding.severity === 'blocking')) return 2;
  return report.findings.some((finding) => finding.severity === 'blocking') ? 1 : 0;
}

function humanReport(report) {
  const summary = report.summary();
  const lines = [`presentation-validation ${RUNTIME_VERSION} — ${report.profile}`, `Project: ${report.projectDirectory}`, ''];
  for (const finding of report.findings) {
    const prefix = { blocking: 'FAIL', warning: 'WARN', info: 'INFO' }[finding.severity];
    const context = finding.slide ? ` (slide ${finding.slide})` : finding.path ? ` (${finding.path})` : '';
    lines.push(`${prefix} [${finding.check}] ${finding.message}${context}`);
    if (finding.remediation) lines.push(`  → ${finding.remediation}`);
  }
  lines.push('', `Summary: ${summary.blocking} blocking, ${summary.warning} warnings, ${summary.info} informational, ${summary.skipped} skipped.`);
  return `${lines.join('\n')}\n`;
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--version') {
    process.stdout.write(`${RUNTIME_VERSION}\n`);
    return 0;
  }
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
  const projectDirectory = path.resolve(options.projectDirectory);
  if (!(await exists(projectDirectory))) {
    process.stderr.write(`Project Folder does not exist: ${projectDirectory}\n`);
    return 2;
  }
  const report = await validate({ projectDirectory, profile: options.profile, checks: options.checks });
  const output = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    runtimeVersion: RUNTIME_VERSION,
    profile: report.profile,
    projectDirectory: report.projectDirectory,
    summary: report.summary(),
    findings: report.findings,
  };
  if (options.report) {
    const reportPath = path.resolve(projectDirectory, options.report);
    if (reportPath !== projectDirectory && !reportPath.startsWith(`${projectDirectory}${path.sep}`)) {
      process.stderr.write('--report must be inside the Project Folder.\n');
      return 2;
    }
    await writeFile(reportPath, `${JSON.stringify(output, null, 2)}\n`);
  }
  process.stdout.write(options.format === 'json' ? `${JSON.stringify(output)}\n` : humanReport(report));
  return exitCode(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 3;
  });
}
