import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

import { validateApprovedGallery } from '../lib/gallery-approval.mjs';
import { gallerySlides } from '../lib/gallery-contract.mjs';
import { galleryPaths, loadGallerySource } from '../lib/gallery-files.mjs';
import { inspectGalleryMarkdownPreviews } from '../lib/gallery-markdown-preview.mjs';
import { createGalleryReviewMatrix } from '../lib/gallery-review-matrix.mjs';
import { inspectGalleryFontFallbacks, inspectGallerySlides } from '../lib/gallery-slide-acceptance.mjs';
import { themeIds } from '../lib/theme-catalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const paths = galleryPaths(suiteDirectory);
const prepareApproval = process.argv.includes('--prepare-approval');
const source = await loadGallerySource({ repositoryDirectory: paths.repositoryDirectory });
const executablePath = [
  process.env.PRESENTATION_THEME_BROWSER,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No supported browser found for gallery acceptance.');

await mkdir(paths.reportsDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const issues = [];
const captures = {};

async function compareApproved(actual, asset) {
  const approvedPath = path.join(paths.assetsDirectory, asset.filename);
  if (!existsSync(approvedPath)) return;
  const approved = PNG.sync.read(await readFile(approvedPath));
  if (actual.width !== approved.width || actual.height !== approved.height) {
    issues.push(`${asset.filename} changed from ${approved.width}×${approved.height} to ${actual.width}×${actual.height}.`);
    return;
  }
  const changed = pixelmatch(actual.data, approved.data, null, actual.width, actual.height, { threshold: 0.2 });
  const ratio = changed / (actual.width * actual.height);
  if (ratio > 0.015) issues.push(`${asset.filename} differs from its approved asset by ${(ratio * 100).toFixed(1)}%.`);
}

try {
  for (const theme of themeIds) {
    const projectDirectory = path.join(paths.generatedDirectory, theme);
    const htmlPath = path.join(projectDirectory, 'PRESENTASJON.html');
    const manifest = JSON.parse(await readFile(path.join(projectDirectory, 'themes', theme, 'theme.json'), 'utf8'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const remoteRequests = [];
    page.on('request', (request) => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });

    const accessibility = await new AxeBuilder({ page })
      .include('section[data-theme]')
      .withRules(['color-contrast', 'heading-order', 'image-alt'])
      .analyze();
    for (const violation of accessibility.violations) {
      for (const node of violation.nodes) issues.push(`${theme}: Axe ${violation.id}: ${node.failureSummary ?? violation.help}.`);
    }
    if (remoteRequests.length) issues.push(`${theme}: gallery HTML made remote requests: ${remoteRequests.join(', ')}.`);
    const selectedSlideNumbers = gallerySlides.map(({ slideNumber }) => slideNumber);
    issues.push(...(await inspectGallerySlides(page, selectedSlideNumbers)).map((issue) => `${theme}: ${issue}.`));

    const fallbackPage = await context.newPage();
    await fallbackPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    issues.push(...(await inspectGalleryFontFallbacks({ page: fallbackPage, manifest, selectedSlideNumbers })).map((issue) => `${theme}: ${issue}.`));
    await fallbackPage.close();

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addStyleTag({ content: '.bespoke-marp-osc,.bespoke-progress-parent{display:none!important}body,html,.bespoke-marp-parent{width:1280px!important;height:720px!important}' });
    for (const slide of gallerySlides) {
      await page.evaluate((activeIndex) => {
        const sections = [...document.querySelectorAll('svg.bespoke-marp-slide')];
        for (const [index, section] of sections.entries()) {
          section.classList.toggle('bespoke-marp-active', index === activeIndex);
          section.classList.toggle('bespoke-marp-active-ready', index === activeIndex);
        }
      }, slide.slideNumber - 1);
      const asset = source.assets.find((candidate) => candidate.theme === theme && candidate.archetype === slide.archetype);
      const outputPath = path.join(paths.reportsDirectory, asset.filename);
      await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1280, height: 720 } });
      const bytes = await readFile(outputPath);
      const png = PNG.sync.read(bytes);
      captures[asset.filename] = { renderer: 'html', sha256: createHash('sha256').update(bytes).digest('hex') };
      await compareApproved(png, asset);
    }
    await context.close();
  }

  if (Object.keys(captures).length !== source.assets.length) issues.push(`Captured ${Object.keys(captures).length} gallery screenshots; expected ${source.assets.length}.`);
  await writeFile(
    path.join(paths.reportsDirectory, 'rendered-gallery-manifest.json'),
    `${JSON.stringify({
      sourceFingerprint: source.sourceFingerprint,
      fixtureVersion: source.fixtureVersion,
      sourceMediaSha256: source.sampleMediaSha256,
      captures,
    }, null, 2)}\n`,
  );

  const context = await browser.newContext();
  await createGalleryReviewMatrix({ context, reportsDirectory: paths.reportsDirectory, themeIds });
  issues.push(...(await inspectGalleryMarkdownPreviews({ context, repositoryDirectory: paths.repositoryDirectory })));
  await context.close();

  if (existsSync(path.join(paths.assetsDirectory, 'manifest.json')) && !prepareApproval) {
    issues.push(...(await validateApprovedGallery({
      assetsDirectory: paths.assetsDirectory,
      source,
      onWarning: (warning) => process.stderr.write(`⚠️  ${warning}\n`),
    })));
  } else if (prepareApproval) {
    process.stdout.write('Approval preparation mode: rendered checks ran; manifest freshness will be enforced after approval.\n');
  } else {
    process.stdout.write('No approved gallery assets yet; review the matrix, then run approve-gallery.\n');
  }
} finally {
  await browser.close();
}

if (issues.length) {
  process.stderr.write(`${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('All 12 production gallery slides passed rendered acceptance.\n');
}
