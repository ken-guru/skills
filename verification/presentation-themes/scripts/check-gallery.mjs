import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import MarkdownIt from 'markdown-it';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

import { gallerySlides, validateApprovedGallery } from '../lib/gallery-contract.mjs';
import { galleryPaths, loadGallerySource } from '../lib/gallery-files.mjs';
import { themeIds } from '../lib/theme-catalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const paths = galleryPaths(suiteDirectory);
const prepareApproval = process.argv.includes('--prepare-approval');
const source = await loadGallerySource({
  repositoryDirectory: paths.repositoryDirectory,
  suiteDirectory,
});
const browserCandidates = [
  process.env.PRESENTATION_THEME_BROWSER,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No supported browser found for gallery acceptance.');

await mkdir(paths.reportsDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const issues = [];
const captured = new Map();

async function compareApproved(actual, asset) {
  const approvedPath = path.join(paths.assetsDirectory, asset.filename);
  if (!existsSync(approvedPath)) return;
  const approved = PNG.sync.read(await readFile(approvedPath));
  if (actual.width !== approved.width || actual.height !== approved.height) {
    issues.push(
      `${asset.filename} changed from ${approved.width}×${approved.height} to ${actual.width}×${actual.height}.`,
    );
    return;
  }
  const changed = pixelmatch(
    actual.data,
    approved.data,
    null,
    actual.width,
    actual.height,
    { threshold: 0.2 },
  );
  const ratio = changed / (actual.width * actual.height);
  if (ratio > 0.015) {
    issues.push(`${asset.filename} differs from its approved asset by ${(ratio * 100).toFixed(1)}%.`);
  }
}

async function createReviewMatrix(context) {
  const cells = [];
  for (const slide of gallerySlides) {
    for (const theme of themeIds) {
      const filename = `${theme}-${slide.archetype}.png`;
      const sourceUrl = `data:image/png;base64,${(
        await readFile(path.join(paths.reportsDirectory, filename))
      ).toString('base64')}`;
      cells.push(`<figure><figcaption>${theme} · ${slide.archetype}</figcaption><img src="${sourceUrl}"></figure>`);
    }
  }
  const page = await context.newPage();
  await page.setViewportSize({ width: 1260, height: 900 });
  await page.setContent(`<style>
    body{margin:24px;background:#202124;color:#fff;font:14px system-ui;display:grid;grid-template-columns:repeat(3,384px);gap:24px}
    figure{margin:0}figcaption{margin:0 0 8px;text-transform:capitalize}img{display:block;width:384px;height:216px}
  </style>${cells.join('')}`);
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({
    path: path.join(paths.reportsDirectory, 'presentation-themes-review-matrix.png'),
    fullPage: true,
  });
  await page.close();
}

async function checkMarkdownPreviews(context) {
  const markdown = new MarkdownIt({ html: false, linkify: true });
  for (const [name, filename, baseDirectory] of [
    ['README', 'README.md', paths.repositoryDirectory],
    ['Gallery', 'docs/presentation-themes.md', path.join(paths.repositoryDirectory, 'docs')],
  ]) {
    const sourcePath = path.join(paths.repositoryDirectory, filename);
    if (!existsSync(sourcePath)) continue;
    const html = markdown.render(await readFile(sourcePath, 'utf8'));
    for (const width of [320, 768, 1280]) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`<base href="${pathToFileURL(`${baseDirectory}${path.sep}`).href}"><style>
        *{box-sizing:border-box}body{margin:16px;max-width:920px;font:16px/1.5 system-ui}img{display:block;max-width:100%;height:auto}pre{max-width:100%;overflow:auto}
      </style>${html}`);
      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        images: [...document.images].filter((image) => image.getBoundingClientRect().right > innerWidth + 1).length,
      }));
      if (overflow.body > 1 || overflow.root > 1 || overflow.images) {
        issues.push(`${name} has horizontal overflow at ${width}px.`);
      }
      await page.close();
    }
  }
}

try {
  for (const theme of themeIds) {
    const projectDirectory = path.join(paths.generatedDirectory, theme);
    const htmlPath = path.join(projectDirectory, 'PRESENTASJON.html');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const remoteRequests = [];
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
    });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    const accessibility = await new AxeBuilder({ page })
      .include('section[data-theme]')
      .withRules(['color-contrast', 'heading-order', 'image-alt'])
      .analyze();
    for (const violation of accessibility.violations) {
      issues.push(`${theme}: Axe ${violation.id}: ${violation.help}.`);
    }
    if (remoteRequests.length) {
      issues.push(`${theme}: gallery HTML made remote requests: ${remoteRequests.join(', ')}.`);
    }
    const geometry = await page.evaluate((selectedSlides) => {
      const found = [];
      const overlap = (left, right) =>
        Math.min(left.right, right.right) - Math.max(left.left, right.left) > 2 &&
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 2;
      const sections = [...document.querySelectorAll('section[data-theme]')];
      for (const slideNumber of selectedSlides) {
        const section = sections[slideNumber - 1];
        if (!section) {
          found.push(`missing selected slide ${slideNumber}`);
          continue;
        }
        if (!section.querySelector('h1, h2')) found.push(`slide ${slideNumber} has no heading`);
        for (const image of section.querySelectorAll('img')) {
          if (!image.getAttribute('alt')?.trim()) found.push(`slide ${slideNumber} has empty image alt`);
          if (image.naturalWidth <= image.naturalHeight && section.classList.contains('variation-landscape')) {
            found.push(`slide ${slideNumber} received portrait media in a landscape variation`);
          }
          if (image.naturalWidth >= image.naturalHeight && section.classList.contains('variation-portrait')) {
            found.push(`slide ${slideNumber} received non-portrait media in a portrait variation`);
          }
        }
        const sectionRect = section.getBoundingClientRect();
        const slots = [...section.querySelectorAll(':scope > [class*="slot-"]')];
        for (const slot of slots) {
          const rect = slot.getBoundingClientRect();
          if (rect.left < sectionRect.left - 1 || rect.top < sectionRect.top - 1 || rect.right > sectionRect.right + 1 || rect.bottom > sectionRect.bottom + 1) {
            found.push(`slide ${slideNumber} has content outside its slide`);
          }
        }
        for (let first = 0; first < slots.length; first += 1) {
          for (let second = first + 1; second < slots.length; second += 1) {
            if (overlap(slots[first].getBoundingClientRect(), slots[second].getBoundingClientRect())) {
              found.push(`slide ${slideNumber} has a Content Slot collision`);
            }
          }
        }
      }
      return found;
    }, gallerySlides.map(({ slideNumber }) => slideNumber));
    issues.push(...geometry.map((issue) => `${theme}: ${issue}.`));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addStyleTag({
      content: '.bespoke-marp-osc,.bespoke-progress-parent{display:none!important}body,html,.bespoke-marp-parent{width:1280px!important;height:720px!important}',
    });
    for (const slide of gallerySlides) {
      await page.evaluate((activeIndex) => {
        const sections = [...document.querySelectorAll('svg.bespoke-marp-slide')];
        for (const [index, section] of sections.entries()) {
          section.classList.toggle('bespoke-marp-active', index === activeIndex);
          section.classList.toggle('bespoke-marp-active-ready', index === activeIndex);
        }
      }, slide.slideNumber - 1);
      const asset = source.assets.find(
        (candidate) => candidate.theme === theme && candidate.archetype === slide.archetype,
      );
      const outputPath = path.join(paths.reportsDirectory, asset.filename);
      await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1280, height: 720 } });
      const png = PNG.sync.read(await readFile(outputPath));
      captured.set(asset.filename, png);
      await compareApproved(png, asset);
    }
    await context.close();
  }

  const context = await browser.newContext();
  await createReviewMatrix(context);
  await checkMarkdownPreviews(context);
  await context.close();

  if (existsSync(path.join(paths.assetsDirectory, 'manifest.json')) && !prepareApproval) {
    issues.push(...(await validateApprovedGallery({ assetsDirectory: paths.assetsDirectory, source })));
  } else if (prepareApproval) {
    process.stdout.write(
      'Approval preparation mode: rendered checks ran; manifest freshness will be enforced after approval.\n',
    );
  } else {
    process.stdout.write('No approved gallery assets yet; review the matrix, then run approve-gallery.\n');
  }
} finally {
  await browser.close();
}

if (captured.size !== source.assets.length) {
  issues.push(`Captured ${captured.size} gallery screenshots; expected ${source.assets.length}.`);
}
if (issues.length) {
  process.stderr.write(`${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('All 12 production gallery slides passed rendered acceptance.\n');
}
