// Verifies each theme's declared diagram media box against the diagram slot
// rendered in a browser. Runs in CI: it needs the capacity-deck fixtures
// (`npm run fixtures`), Marp CLI's HTML export (no browser), and one Chromium.
// Browser: PRESENTATION_THEME_BROWSER, else Playwright's pinned Chromium
// (`npx playwright-core install chromium`).
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright-core';

import { diagramMediaBoxIssues, measureDiagramSlot } from '../lib/diagram-media-box.mjs';
import { themeIds } from '../lib/theme-catalog.mjs';

const suiteDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectory = path.join(suiteDirectory, '.generated');
const marpExecutable = process.env.PRESENTATION_THEME_MARP ?? path.join(suiteDirectory, 'node_modules/.bin/marp');

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with status ${code}`))));
  });
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PRESENTATION_THEME_BROWSER ? { executablePath: process.env.PRESENTATION_THEME_BROWSER } : {}),
});
const issues = [];
try {
  for (const themeId of themeIds) {
    const projectDirectory = path.join(generatedDirectory, themeId);
    await run(marpExecutable, ['PRESENTASJON.md', '-o', 'PRESENTASJON.html'], projectDirectory);
    const manifest = JSON.parse(await readFile(path.join(projectDirectory, 'themes', themeId, 'theme.json'), 'utf8'));
    const declared = manifest.archetypes.diagram.mediaBox;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(path.join(projectDirectory, 'PRESENTASJON.html')).href, { waitUntil: 'networkidle' });
    const measured = await measureDiagramSlot(page);
    await page.close();
    if (!measured) {
      issues.push(`${themeId}: the capacity deck has no rendered diagram slot to measure`);
      continue;
    }
    process.stdout.write(`${themeId}: declared ${declared?.width}×${declared?.height}, rendered ${measured.width}×${measured.height}\n`);
    issues.push(...diagramMediaBoxIssues({ declared, measured }).map((issue) => `${themeId}: ${issue}`));
  }
} finally {
  await browser.close();
}

if (issues.length) {
  process.stderr.write(`${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`All ${themeIds.length} declared diagram media boxes match their rendered slots.\n`);
}
