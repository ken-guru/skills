#!/usr/bin/env node

// Turns the agent's slide objects (a JSON file, or JSON on stdin) into the
// presentation Markdown for a prepared Project Folder.
//
//   node slide-markup.mjs <project-folder> --check|--write --input=<slides.json>
//   node slide-markup.mjs <project-folder> --check|--write < slides.json
//
// Exit 0: no blocking errors (and, with --write, the presentation was written).
// Exit 1: content errors; nothing was written.
// Exit 2: usage or prerequisite error; nothing was written.

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { presentationFrontMatter } from './prepare-theme.mjs';
import { checkPresentationSlides, renderPresentationMarkdown } from './semantic-markup.mjs';
import { classifySlide } from './slide-composition.mjs';
import { resolveTheme } from './theme-resolution.mjs';

const USAGE = 'Usage: slide-markup.mjs <project-folder> --check|--write [--input=<slides.json>]';

const ROLES = ['opener', 'section-boundary', 'quotation'];
const VISUAL_TYPES = ['picture', 'diagram', 'chart'];
// Text slots the markup always renders; an absent one would print "undefined".
const REQUIRED_TEXT = {
  title: ['title', 'subtitle', 'label'],
  section: ['title', 'context', 'orientation'],
  'text-only': ['heading', 'body'],
  'text-plus-image': ['heading', 'body', 'caption'],
  data: ['heading', 'takeaway'],
  diagram: ['heading', 'takeaway', 'caption'],
  quotation: ['context', 'quote', 'attribution'],
};

class PrerequisiteError extends Error {}

function parseArguments(argv) {
  const modes = argv.filter((argument) => argument === '--check' || argument === '--write');
  const inputs = argv.filter((argument) => argument.startsWith('--input='));
  const unknownFlags = argv.filter((argument) => argument.startsWith('--') && !modes.includes(argument) && !inputs.includes(argument));
  const positional = argv.filter((argument) => !argument.startsWith('--'));
  if (modes.length !== 1 || inputs.length > 1 || unknownFlags.length || positional.length !== 1) {
    throw new PrerequisiteError(USAGE);
  }
  const input = inputs[0]?.slice(8);
  if (inputs.length && !input) throw new PrerequisiteError(USAGE);
  return { projectDirectory: path.resolve(positional[0]), write: modes[0] === '--write', input: input && path.resolve(input) };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readInput(file) {
  try {
    return await readFile(file, 'utf8');
  } catch {
    throw new PrerequisiteError(`Cannot read --input file ${file}.`);
  }
}

function parseSlides(text) {
  let input;
  try {
    input = JSON.parse(text);
  } catch (error) {
    throw new PrerequisiteError(`The slide objects are not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(input) || input.length === 0) {
    throw new PrerequisiteError('stdin must be a non-empty JSON array of slide objects.');
  }
  const slides = input;
  const invalid = slides.findIndex((slide) => !slide || typeof slide !== 'object' || Array.isArray(slide));
  if (invalid !== -1) throw new PrerequisiteError(`Slide ${invalid + 1} is not a JSON object.`);
  return slides;
}

async function readRequired(filePath, description) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw new PrerequisiteError(`Cannot read ${description} at ${filePath}: ${error.code ?? error.message}`);
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function loadProject(projectDirectory) {
  const discoveryText = await readRequired(path.join(projectDirectory, 'DISCOVERY.json'), 'DISCOVERY.json');
  let discovery;
  try {
    discovery = JSON.parse(discoveryText);
  } catch (error) {
    throw new PrerequisiteError(`DISCOVERY.json is not valid JSON: ${error.message}`);
  }
  const paths = discovery.paths ?? {};
  const projectPath = (key, fallback) => path.resolve(projectDirectory, paths[key] ?? fallback);
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  let resolution;
  try {
    resolution = await resolveTheme({
      discovery,
      themesDirectory: path.resolve(scriptDirectory, '../themes'),
      projectThemesDirectory: projectPath('themes', 'themes/'),
    });
  } catch (error) {
    throw new PrerequisiteError(`${error.code ? `${error.code}: ` : ''}${error.message}`);
  }
  if (resolution.source !== 'project-snapshot') {
    throw new PrerequisiteError(
      `No locked Theme Package snapshot for "${resolution.id}". Run prepare-theme.mjs with the Project Folder first.`,
    );
  }
  const agenda = await readRequired(projectPath('agenda', 'AGENDA.md'), 'the approved Agenda');
  const mediaSpecs = [
    await readOptional(projectPath('imageSpec', 'IMAGE_SPEC.md')),
    await readOptional(projectPath('diagramSpec', 'DIAGRAM_SPEC.md')),
  ].join('\n');
  return {
    manifest: resolution.manifest,
    frontMatter: presentationFrontMatter({ discovery, resolution }),
    presentationPath: projectPath('presentation', 'PRESENTASJON.md'),
    specifiedMedia: specifiedMedia({ agenda, mediaSpecs }),
  };
}

const normalizeMedia = (filename) => filename.trim().replace(/^\.\//, '');

// The Agenda names each visual's filename in backticks; Media Specs name it in
// a **Filename:** entry.
function specifiedMedia({ agenda, mediaSpecs }) {
  return new Set(
    [
      ...[...agenda.matchAll(/`([^`\n]+\.(?:png|jpe?g|webp|gif|svg))`/gi)].map((match) => match[1]),
      ...[...mediaSpecs.matchAll(/\*\*Filename:\*\*\s*`([^`\n]+)`/g)].map((match) => match[1]),
    ].map(normalizeMedia),
  );
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Media is rendered after Generation, so an absent file only warns; a filename
// nobody specified blocks.
async function mediaFindings(slide, project) {
  const filename = typeof slide.visual?.filename === 'string' ? normalizeMedia(slide.visual.filename) : '';
  if (!filename) return [];
  if (!project.specifiedMedia.has(filename)) {
    return [{
      severity: 'error',
      code: 'MEDIA_NOT_SPECIFIED',
      message: `${filename} has no matching Agenda or Media Spec entry; use the approved filename.`,
    }];
  }
  if (!(await exists(path.resolve(path.dirname(project.presentationPath), filename)))) {
    return [{
      severity: 'warning',
      code: 'MEDIA_NOT_RENDERED',
      message: `${filename} is not rendered yet; render it after Generation.`,
    }];
  }
  return [];
}

// Input-contract checks the renderer does not make itself.
function slideContractErrors(slide, manifest) {
  const errors = [];
  const error = (code, message) => errors.push({ code, message });
  if (slide.role !== undefined && !ROLES.includes(slide.role)) {
    error('UNKNOWN_ROLE', `Unknown role "${slide.role}"; use one of ${ROLES.join(', ')}, or omit it.`);
  }
  if (slide.visual !== undefined && !VISUAL_TYPES.includes(slide.visual?.type)) {
    error('UNKNOWN_VISUAL_TYPE', `Unknown visual type "${slide.visual?.type}"; use one of ${VISUAL_TYPES.join(', ')}, or omit visual.`);
  }
  const archetype = classifySlide(slide);
  if (slide.archetype !== undefined) {
    if (!manifest.archetypes[slide.archetype]) {
      error('UNKNOWN_ARCHETYPE', `Unknown archetype "${slide.archetype}"; the locked theme composes ${Object.keys(manifest.archetypes).join(', ')}.`);
    } else if (slide.archetype !== archetype) {
      error('ARCHETYPE_MISMATCH', `Declared archetype "${slide.archetype}" but the slide classifies as "${archetype}".`);
    }
  }
  for (const field of REQUIRED_TEXT[archetype]) {
    if (slide[field] == null) error('MISSING_FIELD', `A ${archetype} slide requires "${field}".`);
  }
  for (const field of ['body', 'notes']) {
    if (slide[field] != null && !Array.isArray(slide[field])) {
      error('INVALID_FIELD', `"${field}" must be an array.`);
    }
  }
  return errors;
}

const capacityUse = (capacity, measures) =>
  measures.map((measure) => `${measure} ${capacity[measure].used}/${capacity[measure].limit}`).join(', ');

function describePlan(index, plan) {
  const capacity = capacityUse(plan.capacity, Object.keys(plan.capacity));
  return `Slide ${index + 1}: ${plan.archetype} (${plan.variation}) — ${capacity}`;
}

function explainSplit(finding, plans) {
  const { capacity, exceeded } = plans[finding.slide - 1];
  return {
    ...finding,
    message: `Content Capacity exceeded (${capacityUse(capacity, exceeded)}); split required. Never shrink type to fit.`,
  };
}

function describeFinding({ severity, slide, code, message }) {
  return `${severity}: slide ${slide}: ${code}: ${message}`;
}

async function main() {
  const { projectDirectory, write, input } = parseArguments(process.argv.slice(2));
  const project = await loadProject(projectDirectory);
  const slides = parseSlides(input ? await readInput(input) : await readStdin());

  const { plans, errors } = checkPresentationSlides({ slides, manifest: project.manifest });
  const contractErrors = slides.flatMap((slide, index) =>
    slideContractErrors(slide, project.manifest).map((error) => ({ ...error, slide: index + 1 })));
  // A malformed field already has a precise INVALID_FIELD error; drop the
  // renderer's generic crash on the same slide.
  const malformed = new Set(contractErrors.filter(({ code }) => code === 'INVALID_FIELD').map(({ slide }) => slide));
  const findings = [
    ...contractErrors,
    ...errors
      .filter(({ slide, code }) => !(code === 'INVALID_SLIDE' && malformed.has(slide)))
      .map(({ slide, code, message }) => ({ slide, code, message })),
  ]
    .map((finding) => ({ severity: 'error', ...finding }))
    .concat(
      (await Promise.all(slides.map((slide) => mediaFindings(slide, project)))).flatMap((media, index) =>
        media.map((finding) => ({ ...finding, slide: index + 1 }))),
    )
    .map((finding) => (finding.code === 'SLIDE_SPLIT_REQUIRED' ? explainSplit(finding, plans) : finding))
    .sort((left, right) => left.slide - right.slide);

  const report = [
    ...plans.flatMap((plan, index) => (plan ? [describePlan(index, plan)] : [])),
    ...findings.map(describeFinding),
  ];
  const blocking = findings.filter(({ severity }) => severity === 'error').length;
  if (blocking) {
    report.push(`${blocking} blocking error(s); ${write ? 'presentation not written' : 'fix them before --write'}.`);
  } else if (write) {
    const markdown = renderPresentationMarkdown({
      frontMatter: project.frontMatter,
      slides,
      manifest: project.manifest,
    });
    await mkdir(path.dirname(project.presentationPath), { recursive: true });
    await writeFile(project.presentationPath, markdown);
    report.push(`Wrote ${path.relative(projectDirectory, project.presentationPath)} (${slides.length} slides).`);
  } else {
    report.push(`${slides.length} slides pass; run again with --write to write the presentation.`);
  }
  process.stdout.write(`${report.join('\n')}\n`);
  process.exitCode = blocking ? 1 : 0;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof PrerequisiteError ? error.message : error.stack}\n`);
  process.exitCode = 2;
});
