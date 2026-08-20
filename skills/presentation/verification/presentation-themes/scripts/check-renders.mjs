import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

import { themeIds } from '../lib/theme-catalog.mjs';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const suiteDirectory = path.resolve(scriptDirectory, '..');
const generatedDirectory = path.join(suiteDirectory, '.generated');
const reportsDirectory = path.join(suiteDirectory, 'reports');
const baselinesDirectory = path.join(suiteDirectory, 'baselines');
const browserCandidates = [
  process.env.PRESENTATION_THEME_BROWSER,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = browserCandidates.find((candidate) => existsSync(candidate));

if (!executablePath) throw new Error('No supported browser found for rendered-deck acceptance.');

await mkdir(reportsDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const summary = [];

async function compareWithBaseline(actual, baselineName, issues, slide) {
  let baseline;
  try {
    baseline = PNG.sync.read(
      await readFile(path.join(baselinesDirectory, baselineName)),
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      issues.push(`Slide ${slide}: missing approved visual baseline ${baselineName}.`);
      return;
    }
    throw error;
  }
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    issues.push(
      `Slide ${slide}: ${baselineName} changed from ${baseline.width}×${baseline.height} to ${actual.width}×${actual.height}.`,
    );
    return;
  }
  const changedPixels = pixelmatch(
    actual.data,
    baseline.data,
    null,
    actual.width,
    actual.height,
    { threshold: 0.2 },
  );
  const changeRatio = changedPixels / (actual.width * actual.height);
  if (changeRatio > 0.015) {
    issues.push(
      `Slide ${slide}: ${baselineName} differs from its approved baseline by ${(changeRatio * 100).toFixed(1)}%.`,
    );
  }
}

async function createContactSheet(context, imagePaths, outputPath) {
  const sources = await Promise.all(
    imagePaths.map(async (imagePath) =>
      `data:image/png;base64,${(await readFile(imagePath)).toString('base64')}`,
    ),
  );
  const contactPage = await context.newPage();
  await contactPage.setViewportSize({ width: 1328, height: 900 });
  await contactPage.setContent(
    `<style>body{margin:24px;background:#202124;display:grid;grid-template-columns:repeat(2,640px);gap:24px}img{display:block;width:640px;height:360px}</style>${sources.map((source) => `<img src="${source}">`).join('')}`,
  );
  await contactPage.screenshot({ path: outputPath, fullPage: true });
  await contactPage.close();
}

try {
  for (const themeId of themeIds) {
    const projectDirectory = path.join(generatedDirectory, themeId);
    const htmlPath = path.join(projectDirectory, 'PRESENTASJON.html');
    const pdfPath = path.join(projectDirectory, 'PRESENTASJON.pdf');
    const manifest = JSON.parse(
      await readFile(path.join(projectDirectory, 'themes', themeId, 'theme.json'), 'utf8'),
    );
    const projectContractIssues = [];
    const projectState = JSON.parse(
      await readFile(path.join(projectDirectory, 'PROJECT.json'), 'utf8'),
    );
    if (projectState.phases?.generation?.status !== 'done') {
      projectContractIssues.push('Rendered project did not complete the Generation phase.');
    }
    for (const [specFile, treatment] of [
      ['IMAGE_SPEC.md', manifest.media.pictureTreatment],
      ['DIAGRAM_SPEC.md', manifest.media.diagramTreatment],
    ]) {
      if (!(await readFile(path.join(projectDirectory, specFile), 'utf8')).includes(treatment)) {
        projectContractIssues.push(`${specFile} did not receive the selected Theme Treatment.`);
      }
    }
    const expectedAgenda = await readFile(
      path.join(suiteDirectory, 'fixtures/project/AGENDA.md'),
      'utf8',
    );
    if ((await readFile(path.join(projectDirectory, 'AGENDA.md'), 'utf8')) !== expectedAgenda) {
      projectContractIssues.push('Project generation did not preserve the approved Agenda.');
    }
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

    const result = await page.evaluate(() => {
      const issues = [];
      const sections = [...document.querySelectorAll('section[data-theme]')];
      const rgba = (value) => {
        const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
        return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
      };
      const composite = (front, back) => ({
        r: front.r * front.a + back.r * (1 - front.a),
        g: front.g * front.a + back.g * (1 - front.a),
        b: front.b * front.a + back.b * (1 - front.a),
        a: 1,
      });
      const luminance = (color) => {
        const channel = (value) => {
          const normalized = value / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      };
      const contrast = (first, second) => {
        const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      const pointInPolygon = (point, polygon) => {
        let inside = false;
        for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
          const [currentX, currentY] = polygon[current];
          const [previousX, previousY] = polygon[previous];
          const crosses =
            currentY > point.y !== previousY > point.y &&
            point.x <
              ((previousX - currentX) * (point.y - currentY)) /
                  (previousY - currentY) +
                currentX;
          if (crosses) inside = !inside;
        }
        return inside;
      };
      const overlap = (a, b) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;

      for (const [index, section] of sections.entries()) {
        const slide = index + 1;
        const sectionRect = section.getBoundingClientRect();
        const scale = sectionRect.width / 1280 || 1;
        const slots = [...section.querySelectorAll(':scope > [class*="slot-"]')];

        if (!section.querySelector('h1, h2')) {
          issues.push(`Slide ${slide}: missing semantic heading.`);
        }
        for (const image of section.querySelectorAll('img')) {
          if (!image.hasAttribute('alt')) issues.push(`Slide ${slide}: image has no alt attribute.`);
          const source = image.getAttribute('src') ?? '';
          const portrait = section.classList.contains('variation-portrait');
          const landscape = section.classList.contains('variation-landscape');
          if (portrait && image.naturalWidth >= image.naturalHeight) {
            issues.push(`Slide ${slide}: portrait variation received non-portrait media.`);
          }
          if (landscape && image.naturalWidth <= image.naturalHeight) {
            issues.push(`Slide ${slide}: landscape variation received non-landscape media.`);
          }
          if (!source.endsWith('.svg')) {
            const rect = image.getBoundingClientRect();
            if (rect.width > image.naturalWidth + 1 || rect.height > image.naturalHeight + 1) {
              issues.push(`Slide ${slide}: raster media is enlarged beyond native dimensions.`);
            }
          }
          const protectedPoints = source.endsWith('portrait.svg')
            ? [{ x: 0.1, y: 0.51 }, { x: 0.9, y: 0.51 }]
            : source.endsWith('landscape.svg')
              ? [{ x: 0.06, y: 0.51 }, { x: 0.94, y: 0.51 }]
              : [];
          const imageRect = image.getBoundingClientRect();
          const imageStyle = getComputedStyle(image);
          const scale = imageStyle.objectFit === 'contain'
            ? Math.min(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight)
            : Math.max(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight);
          const drawnWidth = image.naturalWidth * scale;
          const drawnHeight = image.naturalHeight * scale;
          const drawnLeft = imageRect.left + (imageRect.width - drawnWidth) / 2;
          const drawnTop = imageRect.top + (imageRect.height - drawnHeight) / 2;
          const media = image.closest('.slot-media');
          const mediaRect = media?.getBoundingClientRect();
          const clip = media ? getComputedStyle(media).clipPath : 'none';
          let clipPolygon = null;
          if (mediaRect && clip.startsWith('polygon(')) {
            const coordinate = (token, size) =>
              token.endsWith('%')
                ? (Number.parseFloat(token) / 100) * size
                : Number.parseFloat(token);
            clipPolygon = clip
              .slice(8, -1)
              .split(',')
              .map((pair) => {
                const [x, y] = pair.trim().split(/\s+/);
                return [coordinate(x, mediaRect.width), coordinate(y, mediaRect.height)];
              });
          }
          for (const protectedPoint of protectedPoints) {
            const point = {
              x: drawnLeft + protectedPoint.x * drawnWidth,
              y: drawnTop + protectedPoint.y * drawnHeight,
            };
            const insideImage =
              point.x >= imageRect.left &&
              point.x <= imageRect.right &&
              point.y >= imageRect.top &&
              point.y <= imageRect.bottom;
            const insideClip =
              !clipPolygon ||
              pointInPolygon(
                { x: point.x - mediaRect.left, y: point.y - mediaRect.top },
                clipPolygon,
              );
            if (!insideImage || !insideClip) {
              issues.push(`Slide ${slide}: crop removes a protected focal marker from ${source}.`);
            }
          }
        }
        for (const metric of section.querySelectorAll('.metric')) {
          const metricStyle = getComputedStyle(metric);
          const sectionBackground = rgba(getComputedStyle(section).backgroundColor);
          const metricBackground = composite(rgba(metricStyle.backgroundColor), sectionBackground);
          const boundary = rgba(metricStyle.borderTopColor);
          if (Number.parseFloat(metricStyle.borderTopWidth) >= 3 && contrast(boundary, metricBackground) < 3) {
            issues.push(`Slide ${slide}: meaningful metric boundary has less than 3:1 contrast.`);
          }
        }

        const orderedSelectors = [
          'h1, h2',
          '.slot-body, .slot-subtitle, .slot-orientation, .slot-takeaway',
          '.slot-media, [role="img"]',
          '.slot-caption',
        ];
        let previousIndex = -1;
        for (const selector of orderedSelectors) {
          const element = section.querySelector(selector);
          if (!element) continue;
          const position = [...section.querySelectorAll('*')].indexOf(element);
          if (position < previousIndex) {
            issues.push(`Slide ${slide}: semantic content is outside the required DOM reading order.`);
            break;
          }
          previousIndex = position;
        }

        for (const slot of slots) {
          const rect = slot.getBoundingClientRect();
          const style = getComputedStyle(slot);
          const contentRect = {
            left: rect.left + Number.parseFloat(style.paddingLeft),
            top: rect.top + Number.parseFloat(style.paddingTop),
            right: rect.right - Number.parseFloat(style.paddingRight),
            bottom: rect.bottom - Number.parseFloat(style.paddingBottom),
          };
          const permitsBleed =
            slot.classList.contains('slot-media') ||
            ((slot.classList.contains('slot-context') ||
              slot.classList.contains('slot-attribution')) &&
              Math.max(
                Number.parseFloat(style.paddingTop),
                Number.parseFloat(style.paddingRight),
                Number.parseFloat(style.paddingBottom),
                Number.parseFloat(style.paddingLeft),
              ) >= 32);
          if (
            !permitsBleed &&
            (contentRect.left < sectionRect.left + 32 * scale - 1 ||
              contentRect.top < sectionRect.top + 32 * scale - 1 ||
              contentRect.right > sectionRect.right - 32 * scale + 1 ||
              contentRect.bottom > sectionRect.bottom - 32 * scale + 1)
          ) {
            issues.push(
              `Slide ${slide}: ${slot.className} enters the essential-content safe margin ` +
                `(${Math.round(rect.left - sectionRect.left)},${Math.round(rect.top - sectionRect.top)} ` +
                `${Math.round(rect.width)}×${Math.round(rect.height)}).`,
            );
          }
          if (!slot.classList.contains('slot-media')) {
            const range = document.createRange();
            range.selectNodeContents(slot);
            const textRect = range.getBoundingClientRect();
            if (
              textRect.width > 0 &&
              (textRect.left < sectionRect.left - 1 ||
                textRect.top < sectionRect.top - 1 ||
                textRect.right > sectionRect.right + 1 ||
                textRect.bottom > sectionRect.bottom + 1)
            ) {
              issues.push(`Slide ${slide}: ${slot.className} has clipped text content.`);
            }
            const clipsX = ['auto', 'hidden', 'scroll'].includes(style.overflowX);
            const clipsY = ['auto', 'hidden', 'scroll'].includes(style.overflowY);
            if (
              (clipsX && slot.scrollWidth > slot.clientWidth + 1) ||
              (clipsY && slot.scrollHeight > slot.clientHeight + 1)
            ) {
              issues.push(`Slide ${slide}: ${slot.className} clips or scrolls its contents.`);
            }
          }
        }

        for (let first = 0; first < slots.length; first += 1) {
          for (let second = first + 1; second < slots.length; second += 1) {
            if (section.classList.contains('variation-landscape') &&
                (slots[first].classList.contains('slot-media') || slots[second].classList.contains('slot-media'))) continue;
            const firstSlot = slots[first];
            const secondSlot = slots[second];
            if (overlap(firstSlot.getBoundingClientRect(), secondSlot.getBoundingClientRect())) {
              const firstRect = firstSlot.getBoundingClientRect();
              const secondRect = secondSlot.getBoundingClientRect();
              issues.push(
                `Slide ${slide}: ${firstSlot.className} overlaps ${secondSlot.className} ` +
                  `(${Math.round(firstRect.left - sectionRect.left)},${Math.round(firstRect.top - sectionRect.top)} ` +
                  `${Math.round(firstRect.width)}×${Math.round(firstRect.height)} vs ` +
                  `${Math.round(secondRect.left - sectionRect.left)},${Math.round(secondRect.top - sectionRect.top)} ` +
                  `${Math.round(secondRect.width)}×${Math.round(secondRect.height)}).`,
              );
            }
          }
        }

        const minimums = [
          ['.slot-title', 54],
          ['.slot-heading', 36],
          ['.slot-body', 28],
          ['.slot-body li', 28],
          ['.metric span', 28],
          ['.slot-subtitle', 28],
          ['.slot-orientation', 28],
          ['.slot-takeaway', 28],
          ['.slot-caption', 20],
          ['.slot-attribution', 20],
          ['.slot-label', 18],
          ['.slot-context', 18],
        ];
        for (const [selector, minimum] of minimums) {
          for (const element of section.querySelectorAll(selector)) {
            const size = Number.parseFloat(getComputedStyle(element).fontSize);
            if (size < minimum) {
              issues.push(`Slide ${slide}: ${selector} is ${size}px; minimum is ${minimum}px.`);
            }
          }
        }

        for (const element of section.querySelectorAll('.slot-body, .slot-subtitle, .slot-orientation, .slot-takeaway')) {
          const style = getComputedStyle(element);
          const ratio = Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
          if (ratio < 1.25 || ratio > 1.5) {
            issues.push(`Slide ${slide}: body line-height ratio ${ratio.toFixed(2)} is outside 1.25–1.5.`);
          }
        }
        for (const heading of section.querySelectorAll('h1:not(.sr-only), h2:not(.sr-only)')) {
          const style = getComputedStyle(heading);
          const ratio = Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
          if (ratio < 1) {
            issues.push(`Slide ${slide}: heading line-height ratio ${ratio.toFixed(2)} is below 1.0.`);
          }
        }
      }
      return {
        slideCount: sections.length,
        headings: sections.map((section) =>
          section
            .querySelector('h1:not(.sr-only), h2:not(.sr-only)')
            ?.innerText.trim()
            .replace(/\s+/g, ' ')
            .toLowerCase(),
        ),
        textRuns: sections.map((section) =>
          [...section.querySelectorAll('h1:not(.sr-only), h2:not(.sr-only), p, li, blockquote, .metric strong, .metric span')]
            .filter((element) => !element.closest('.sr-only'))
            .map((element) => element.innerText.trim().replace(/\s+/g, ' ').toLowerCase())
            .filter(Boolean),
        ),
        issues,
      };
    });

    result.issues.push(...projectContractIssues);

    if (result.slideCount !== 8) {
      result.issues.push(`Expected 8 HTML slides; found ${result.slideCount}.`);
    }
    if (remoteRequests.length > 0) {
      result.issues.push(
        `Offline render issued remote requests: ${[...new Set(remoteRequests)].join(', ')}.`,
      );
    }
    for (const violation of accessibility.violations) {
      for (const node of violation.nodes) {
        result.issues.push(
          `Accessibility ${violation.id}: ${node.failureSummary ?? violation.help}`,
        );
      }
    }

    const { stdout: pdfCountOutput } = await execFileAsync('gs', [
      '-q',
      '-dNODISPLAY',
      '-dNOSAFER',
      '-c',
      `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`,
    ]);
    const pdfSlideCount = Number.parseInt(pdfCountOutput.trim(), 10);
    if (pdfSlideCount !== result.slideCount) {
      result.issues.push(
        `HTML has ${result.slideCount} slides but PDF has ${pdfSlideCount} pages.`,
      );
    }
    const { stdout: pdfText } = await execFileAsync('gs', [
      '-q',
      '-dNOSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=txtwrite',
      '-sOutputFile=-',
      pdfPath,
    ]);
    const normalizedPdfText = pdfText.replace(/\s+/g, ' ').toLowerCase();
    for (const [index, heading] of result.headings.entries()) {
      if (heading && !normalizedPdfText.includes(heading)) {
        result.issues.push(`Slide ${index + 1}: PDF is missing HTML heading text "${heading}".`);
      }
    }
    for (const [index, runs] of result.textRuns.entries()) {
      for (const run of runs) {
        if (run.length >= 4 && !normalizedPdfText.includes(run)) {
          result.issues.push(`Slide ${index + 1}: PDF is missing HTML text "${run}".`);
        }
      }
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addStyleTag({
      content: `
        .bespoke-marp-osc, .bespoke-progress-parent { display: none !important; }
        body, html, .bespoke-marp-parent { width: 1280px !important; height: 720px !important; }
      `,
    });
    const htmlSlideImages = [];
    for (let index = 0; index < result.slideCount; index += 1) {
      await page.evaluate((activeIndex) => {
        const slides = [...document.querySelectorAll('svg.bespoke-marp-slide')];
        for (const [slideIndex, slide] of slides.entries()) {
          slide.classList.toggle('bespoke-marp-active', slideIndex === activeIndex);
          slide.classList.toggle('bespoke-marp-active-ready', slideIndex === activeIndex);
        }
      }, index);
      const imagePath = path.join(
        reportsDirectory,
        `${themeId}-html-slide-${index + 1}.png`,
      );
      await page.screenshot({
        path: imagePath,
        clip: { x: 0, y: 0, width: 1280, height: 720 },
      });
      htmlSlideImages.push(imagePath);
    }

    const fallbackPage = await context.newPage();
    await fallbackPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    const fallbackFonts = Object.fromEntries(
      ['display', 'body', 'label'].map((role) => [
        role,
        manifest.fonts[role].at(-1).toLowerCase(),
      ]),
    );
    await fallbackPage.addStyleTag({
      content: `
        section, section .slot-body, section .slot-subtitle, section .slot-orientation,
        section .slot-caption, section .slot-attribution, section .slot-takeaway {
          font-family: ${fallbackFonts.body} !important;
        }
        section h1, section h2, section blockquote, section .metric strong {
          font-family: ${fallbackFonts.display} !important;
        }
        section .slot-label, section .slot-context, section .metric span {
          font-family: ${fallbackFonts.label} !important;
        }
      `,
    });
    await fallbackPage.evaluate(() => document.fonts.ready);
    const fallbackIssues = await fallbackPage.evaluate((expectedFallbacks) => {
      const issues = [];
      for (const [index, section] of [...document.querySelectorAll('section[data-theme]')].entries()) {
        const representatives = {
          body: section,
          display: section.querySelector('h1, h2, blockquote'),
          label: section.querySelector('.slot-label, .slot-context, .metric span'),
        };
        for (const [role, element] of Object.entries(representatives)) {
          if (
            element &&
            !getComputedStyle(element).fontFamily.toLowerCase().includes(expectedFallbacks[role])
          ) {
            issues.push(`Slide ${index + 1}: final ${role} generic fallback was not applied.`);
          }
        }
        const sectionRect = section.getBoundingClientRect();
        const slots = [...section.querySelectorAll(':scope > [class*="slot-"]')];
        const overlap = (a, b) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
        for (const slot of slots.filter((element) => !element.classList.contains('slot-media'))) {
          const range = document.createRange();
          range.selectNodeContents(slot);
          const rect = range.getBoundingClientRect();
          if (
            rect.width > 0 &&
            (rect.left < sectionRect.left - 1 ||
              rect.top < sectionRect.top - 1 ||
              rect.right > sectionRect.right + 1 ||
              rect.bottom > sectionRect.bottom + 1)
          ) {
            issues.push(`Slide ${index + 1}: generic fallback moves text outside the slide.`);
          }
        }
        for (let first = 0; first < slots.length; first += 1) {
          for (let second = first + 1; second < slots.length; second += 1) {
            if (overlap(slots[first].getBoundingClientRect(), slots[second].getBoundingClientRect())) {
              issues.push(`Slide ${index + 1}: generic fallback causes a Content Slot collision.`);
            }
          }
        }
      }
      return issues;
    }, fallbackFonts);
    result.issues.push(...fallbackIssues);
    await fallbackPage.close();

    await execFileAsync('gs', [
      '-q',
      '-dNOSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=png16m',
      '-r96',
      `-sOutputFile=${path.join(reportsDirectory, `${themeId}-pdf-slide-%d.png`)}`,
      pdfPath,
    ]);

    for (let index = 0; index < result.slideCount; index += 1) {
      const htmlPng = PNG.sync.read(await readFile(htmlSlideImages[index]));
      const pdfPng = PNG.sync.read(
        await readFile(path.join(reportsDirectory, `${themeId}-pdf-slide-${index + 1}.png`)),
      );
      await compareWithBaseline(
        htmlPng,
        `${themeId}-html-slide-${index + 1}.png`,
        result.issues,
        index + 1,
      );
      await compareWithBaseline(
        pdfPng,
        `${themeId}-pdf-slide-${index + 1}.png`,
        result.issues,
        index + 1,
      );
      if (htmlPng.width !== pdfPng.width || htmlPng.height !== pdfPng.height) {
        result.issues.push(
          `Slide ${index + 1}: HTML image is ${htmlPng.width}×${htmlPng.height} but PDF image is ${pdfPng.width}×${pdfPng.height}.`,
        );
        continue;
      }
      const differingPixels = pixelmatch(
        htmlPng.data,
        pdfPng.data,
        null,
        htmlPng.width,
        htmlPng.height,
        { threshold: 0.2 },
      );
      const differenceRatio = differingPixels / (htmlPng.width * htmlPng.height);
      if (differenceRatio > 0.12) {
        result.issues.push(
          `Slide ${index + 1}: HTML/PDF visual difference is ${(differenceRatio * 100).toFixed(1)}%.`,
        );
      }
    }

    const pdfSlideImages = Array.from({ length: result.slideCount }, (_, index) =>
      path.join(reportsDirectory, `${themeId}-pdf-slide-${index + 1}.png`),
    );
    await createContactSheet(
      context,
      htmlSlideImages,
      path.join(reportsDirectory, `${themeId}-html-contact-sheet.png`),
    );
    await createContactSheet(
      context,
      pdfSlideImages,
      path.join(reportsDirectory, `${themeId}-pdf-contact-sheet.png`),
    );
    await page.close();
    await context.close();

    summary.push({ themeId, ...result, pdfSlideCount });
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(reportsDirectory, 'acceptance.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
);

const failures = summary.flatMap((theme) =>
  theme.issues.map((issue) => `${theme.themeId}: ${issue}`),
);
if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('All 24 rendered capacity slides passed geometry and parity checks.\n');
}
