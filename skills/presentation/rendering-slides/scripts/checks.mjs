// The scripted checks of the Accessibility Bar (references/accessibility-bar.md).
// Each finding is { slide, rule, message }; slide is null for deck-wide findings.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const MINIMUM_TEXT_PX = 20;
const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.66;
const TEXT_CONTRAST = 4.5;
const LARGE_TEXT_CONTRAST = 3;
const GRAPHICS_CONTRAST = 3;
const VAGUE_LINK_TEXT = /^(click here|here|read more|more|link|this link|this)$/i;

// ── Colour ───────────────────────────────────────────────────────────────────

export function parseColour(value) {
  const text = String(value).trim().toLowerCase();
  const hex = text.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? hex.split('').map((c) => c + c).join('') : hex;
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1 };
  }
  const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4]);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alpha };
  }
  return null;
}

function luminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => v / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// The nearest shade of `colour` (towards black or white) that reaches `target` against `background`.
export function suggestShade(colour, background, target) {
  const towardsBlack = luminance(background) > 0.18;
  for (let step = 1; step <= 100; step += 1) {
    const f = step / 100;
    const mix = towardsBlack
      ? { r: colour.r * (1 - f), g: colour.g * (1 - f), b: colour.b * (1 - f) }
      : { r: colour.r + (255 - colour.r) * f, g: colour.g + (255 - colour.g) * f, b: colour.b + (255 - colour.b) * f };
    if (contrast(mix, background) >= target) return toHex(mix);
  }
  return null;
}

// Colour pairs every theme must meet: [foreground, background, minimum, what it is].
const THEME_PAIRS = [
  ['--color-text', '--color-bg', TEXT_CONTRAST, 'body text on the slide background'],
  ['--color-muted', '--color-bg', TEXT_CONTRAST, 'captions and page numbers on the slide background'],
  ['--color-text', '--color-surface', TEXT_CONTRAST, 'text on surface panels and diagram shapes'],
  ['--color-muted', '--color-surface', TEXT_CONTRAST, 'muted text on surface panels'],
  ['--color-bg', '--color-text', TEXT_CONTRAST, 'section-divider text and emphasised diagram shapes'],
  ['--color-on-accent', '--color-accent', TEXT_CONTRAST, 'text on accent-coloured shapes'],
  ['--color-accent', '--color-bg', GRAPHICS_CONTRAST, 'accent rules, chart marks, and risk lines on the background'],
  ['--color-muted', '--color-bg', GRAPHICS_CONTRAST, 'muted lines and borders on the background'],
];

export function themeFindings(values) {
  const findings = [];
  for (const [fg, bg, minimum, what] of THEME_PAIRS) {
    const foreground = parseColour(values[fg] ?? '');
    const background = parseColour(values[bg] ?? '');
    if (!foreground || !background) {
      findings.push({ slide: null, rule: 'theme-contrast', message: `${fg} or ${bg} is missing or not a colour in theme.css` });
      continue;
    }
    const ratio = contrast(foreground, background);
    if (ratio < minimum) {
      const suggestion = suggestShade(foreground, background, minimum);
      findings.push({ slide: null, rule: 'theme-contrast', message: `${fg} (${values[fg]}) on ${bg} (${values[bg]}) is ${ratio.toFixed(2)}:1 for ${what}; it needs ${minimum}:1.${suggestion ? ` A shade that passes: ${fg}: ${suggestion}.` : ''}` });
    }
  }
  return findings;
}

// ── Deck Source ──────────────────────────────────────────────────────────────

function readSidecar(folder, src) {
  if (/^[a-z]+:/i.test(src)) return null;
  const sidecar = path.join(folder, src.replace(/\.[^.\/]+$/, '.json'));
  if (!existsSync(sidecar)) return null;
  try {
    const data = JSON.parse(readFileSync(sidecar, 'utf8'));
    return data.provider ? data : null;
  } catch {
    return null;
  }
}

export function sourceFindings(deck, folder) {
  const findings = [];
  if (!deck.frontmatter.title) findings.push({ slide: null, rule: 'title', message: 'Front matter has no `title`; the HTML and PDF need one (WCAG 2.4.2).' });
  if (!deck.frontmatter.lang) findings.push({ slide: null, rule: 'lang', message: 'Front matter has no `lang`, for example `lang: en` (WCAG 3.1.1).' });

  for (const slide of deck.slides) {
    const at = (rule, message) => findings.push({ slide: slide.number, rule, message });
    const top = slide.headings.filter((heading) => heading.level <= 2);
    if (!top.length) at('heading', 'has no visible heading (# or ##). Every slide needs one, even title, visual, and quote slides (WCAG 2.4.6).');
    else if (top.length > 1) at('heading', `has ${top.length} top-level headings ("${top.map((h) => h.text).join('", "')}"); keep one and make the rest ### or text.`);
    else if (slide.headings[0].level > 2) at('heading', 'starts with a lower-level heading; the slide heading must come first.');

    for (const image of slide.images) {
      if (image.bg && !image.decorative) at('background-image', `uses a background image (${image.src}) for content. Background images lose their alt text in the PDF: use ordinary image syntax, or mark it <!-- decorative -->.`);
      else if (!image.bg && !image.alt && !image.decorative) at('alt-text', `has an image without alt text (${image.src}). Describe what it shows, or mark it <!-- decorative --> if it carries no information (WCAG 1.1.1).`);
      const sidecar = readSidecar(folder, image.src);
      if (sidecar) {
        if (!/^AI-generated:/i.test(image.alt)) at('generated-image', `shows a generated image (${image.src}) whose alt text does not start with "AI-generated:".`);
        const visible = slide.text.replace(/<!--[\s\S]*?-->/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
        if (!/AI-generated/i.test(visible)) at('generated-image', `shows a generated image (${image.src}) without a visible "AI-generated illustration" label.`);
      }
    }

    for (const link of slide.links) {
      if (link.bare || /^https?:\/\//i.test(link.text)) at('link-text', `has a bare URL as link text (${link.href}); say where it goes (WCAG 2.4.4).`);
      else if (VAGUE_LINK_TEXT.test(link.text)) at('link-text', `has the link text "${link.text}"; say where the link goes (WCAG 2.4.4).`);
    }

    for (const table of slide.tables) {
      if (!table.header.length) at('table-header', 'has a table without header cells; give every column a header (WCAG 1.3.1).');
    }
  }
  return findings;
}

// ── PDF ──────────────────────────────────────────────────────────────────────

export function pdfFindings(buffer) {
  const raw = buffer.toString('latin1');
  const parts = [raw];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    try {
      parts.push(inflateSync(buffer.subarray(start, end)).toString('latin1'));
    } catch {
      // Not a Flate stream (fonts, images).
    }
  }
  const text = parts.join('\n');
  const findings = [];
  if (!/\/StructTreeRoot/.test(text)) findings.push({ slide: null, rule: 'pdf-tagged', message: 'The PDF is not tagged, so screen readers cannot follow its structure.' });
  if (!/\/Outlines\s+\d+\s+\d+\s+R|\/Outlines\s*<</.test(text)) findings.push({ slide: null, rule: 'pdf-outline', message: 'The PDF has no outline (bookmarks) built from the slide headings.' });
  return findings;
}

// ── Rendered slides ──────────────────────────────────────────────────────────

// Runs in the browser: every visible text element's computed size and colour,
// its effective background, and whether the slide's content overflows.
function measureSlides(minimum) {
  const opaqueBackground = (element) => {
    for (let node = element; node; node = node.parentElement) {
      const colour = getComputedStyle(node).backgroundColor;
      const channels = colour.match(/rgba?\(([^)]*)\)/)?.[1].split(/[\s,/]+/).filter(Boolean) ?? [];
      const alpha = channels[3] === undefined ? 1 : Number(channels[3]);
      if (colour && colour !== 'transparent' && alpha > 0.5) return colour;
      if (node.tagName === 'SECTION') return colour;
    }
    return 'rgb(255, 255, 255)';
  };
  return [...document.querySelectorAll('section')].map((section, index) => {
    const texts = [];
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const element = node.parentElement;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.closest('[aria-hidden="true"]')) continue;
      texts.push({ text: node.textContent.trim().slice(0, 40), size: parseFloat(style.fontSize), weight: Number(style.fontWeight) || 400, colour: style.color, background: opaqueBackground(element) });
    }
    const after = getComputedStyle(section, '::after');
    if (after.content && after.content !== 'none' && after.content !== '""' && section.dataset.marpitPagination) {
      texts.push({ text: 'page number', size: parseFloat(after.fontSize), weight: Number(after.fontWeight) || 400, colour: after.color, background: opaqueBackground(section) });
    }
    const overflow = section.scrollHeight > section.clientHeight + 2 || section.scrollWidth > section.clientWidth + 2;
    return { number: index + 1, texts, overflow, minimum };
  });
}

export async function renderedFindings({ htmlPath, browserPath, marpScriptPath }) {
  const puppeteerEntry = marpScriptPath && path.join(path.dirname(marpScriptPath), '..', '..', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js');
  if (!puppeteerEntry || !existsSync(puppeteerEntry)) {
    return { skipped: 'puppeteer-core was not found next to Marp CLI; run setup so contrast and text size can be measured on the rendered slides.', findings: [] };
  }
  const { default: puppeteer } = await import(pathToFileURL(puppeteerEntry).href);
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    const slides = await page.evaluate(measureSlides, MINIMUM_TEXT_PX);
    const findings = [];
    for (const slide of slides) {
      const reported = new Set();
      if (slide.overflow) findings.push({ slide: slide.number, rule: 'overflow', message: 'has content that overflows the slide; shorten it or split the slide.' });
      for (const item of slide.texts) {
        if (item.size < MINIMUM_TEXT_PX - 0.01 && !reported.has(`size:${item.size}`)) {
          reported.add(`size:${item.size}`);
          findings.push({ slide: slide.number, rule: 'text-size', message: `has ${item.size}px text ("${item.text}"); the minimum is ${MINIMUM_TEXT_PX}px.` });
        }
        const fg = parseColour(item.colour);
        const bg = parseColour(item.background);
        if (!fg || !bg) continue;
        const large = item.size >= LARGE_TEXT_PX || (item.weight >= 700 && item.size >= LARGE_BOLD_TEXT_PX);
        const needed = large ? LARGE_TEXT_CONTRAST : TEXT_CONTRAST;
        const ratio = contrast(fg, bg);
        if (ratio < needed && !reported.has(`contrast:${item.colour}:${item.background}`)) {
          reported.add(`contrast:${item.colour}:${item.background}`);
          findings.push({ slide: slide.number, rule: 'contrast', message: `has text ("${item.text}") at ${ratio.toFixed(2)}:1 contrast; it needs ${needed}:1 (WCAG 1.4.3).` });
        }
      }
    }
    return { findings, slides: slides.length };
  } finally {
    await browser.close();
  }
}

export function formatFindings(findings) {
  return findings.map((finding) => `   • ${finding.slide === null ? 'Deck' : `Slide ${finding.slide}`} [${finding.rule}]: ${finding.message}`).join('\n');
}
