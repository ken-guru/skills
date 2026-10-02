#!/usr/bin/env node
// Calculates which project paths a Presentation Theme or External Font Override
// change preserves and invalidates, and which phases it resets. Read-only.
//
//   presentation-theme-invalidation.mjs <project-folder> --change=theme|font|refresh
//
// Prints the plan as JSON. Exit 0: plan printed. Exit 2: usage or prerequisite error.

import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function projectPaths(discovery) {
  return {
    agenda: discovery.paths?.agenda ?? 'AGENDA.md',
    imageSpec: discovery.paths?.imageSpec ?? 'IMAGE_SPEC.md',
    diagramSpec: discovery.paths?.diagramSpec ?? 'DIAGRAM_SPEC.md',
    presentation: discovery.paths?.presentation ?? 'PRESENTASJON.md',
    html: discovery.paths?.html ?? 'PRESENTASJON.html',
    pdf: discovery.paths?.pdf ?? 'PRESENTASJON.pdf',
    images: discovery.paths?.images ?? 'images/',
    videos: discovery.paths?.videos ?? 'videos/',
    themes: discovery.paths?.themes ?? 'themes/',
  };
}

export function presentationThemeInvalidationPlan({ change, discovery }) {
  const paths = projectPaths(discovery);
  const outputs = [paths.presentation, paths.html, paths.pdf];

  if (change === 'font') {
    return {
      preserve: [
        paths.agenda,
        paths.imageSpec,
        paths.diagramSpec,
        paths.images,
        paths.videos,
        paths.themes,
      ],
      stale: outputs,
      pendingPhases: ['generation', 'proofread'],
    };
  }

  if (change === 'theme' || change === 'refresh') {
    return {
      preserve: [paths.agenda, paths.images, paths.videos],
      stale: [
        paths.imageSpec,
        paths.diagramSpec,
        ...outputs,
        '.marprc.yml',
        '.vscode/settings.json',
        paths.themes,
      ],
      pendingPhases: ['generation', 'images', 'diagrams', 'proofread'],
    };
  }

  throw new Error(`Unknown Presentation Theme change kind: ${change}.`);
}

const USAGE = 'Usage: presentation-theme-invalidation.mjs <project-folder> --change=theme|font|refresh';

async function main(argv) {
  const change = argv.find((argument) => argument.startsWith('--change='))?.slice(9);
  const positional = argv.filter((argument) => !argument.startsWith('--'));
  const unknown = argv.filter((argument) => argument.startsWith('--') && !argument.startsWith('--change='));
  if (!change || positional.length !== 1 || unknown.length) throw new Error(USAGE);
  const discovery = JSON.parse(await readFile(path.join(path.resolve(positional[0]), 'DISCOVERY.json'), 'utf8'));
  process.stdout.write(`${JSON.stringify(presentationThemeInvalidationPlan({ change, discovery }), null, 2)}\n`);
}

// import.meta.url is the resolved path; argv[1] keeps symlinks (macOS /var,
// symlinked skill installs), so resolve it before comparing.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`❌ ${error.message}\n`);
    process.exitCode = 2;
  });
}
