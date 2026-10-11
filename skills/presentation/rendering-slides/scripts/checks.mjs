// The scripted checks of the Accessibility Bar (references/accessibility-bar.md), and the
// rules that keep an untrusted Deck Folder from reaching outside itself (references/deck-folder.md).
// Each finding is { slide, rule, message }; slide is null for deck-wide findings.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
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

// The nearest shade of `colour` (towards black on light backgrounds, white on
// dark ones) that meets every { background, target } constraint at once.
export function suggestShade(colour, constraints) {
  const towardsBlack = luminance(constraints[0].background) > 0.18;
  for (let step = 1; step <= 100; step += 1) {
    const f = step / 100;
    const mix = towardsBlack
      ? { r: colour.r * (1 - f), g: colour.g * (1 - f), b: colour.b * (1 - f) }
      : { r: colour.r + (255 - colour.r) * f, g: colour.g + (255 - colour.g) * f, b: colour.b + (255 - colour.b) * f };
    if (constraints.every(({ background, target }) => contrast(mix, background) >= target)) return toHex(mix);
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
  const failing = [];
  for (const [fg, bg, minimum, what] of THEME_PAIRS) {
    const foreground = parseColour(values[fg] ?? '');
    const background = parseColour(values[bg] ?? '');
    if (!foreground || !background) {
      findings.push({ slide: null, rule: 'theme-contrast', message: `${fg} or ${bg} is missing or not a colour in theme.css` });
      continue;
    }
    const ratio = contrast(foreground, background);
    if (ratio < minimum) failing.push({ fg, bg, minimum, what, ratio, foreground });
  }
  // One suggestion per colour, meeting every pair that colour is used in, so
  // following one finding never breaks another.
  const suggestions = {};
  for (const fg of new Set(failing.map((pair) => pair.fg))) {
    const constraints = THEME_PAIRS.filter(([key]) => key === fg)
      .map(([, bg, target]) => ({ background: parseColour(values[bg] ?? ''), target }))
      .filter(({ background }) => background);
    suggestions[fg] = suggestShade(failing.find((pair) => pair.fg === fg).foreground, constraints);
  }
  for (const { fg, bg, minimum, what, ratio } of failing) {
    const suggestion = suggestions[fg];
    findings.push({ slide: null, rule: 'theme-contrast', message: `${fg} (${values[fg]}) on ${bg} (${values[bg]}) is ${ratio.toFixed(2)}:1 for ${what}; it needs ${minimum}:1.${suggestion ? ` A shade that passes: ${fg}: ${suggestion}.` : ''}` });
  }
  return findings;
}

// ── Untrusted Deck Folder ────────────────────────────────────────────────────
// A Deck Folder may come from fetched pages or another person, and the render
// may read local files. Nothing in it may reach outside it; these run before Marp.

// The raw HTML Marp keeps (tag → attributes); it shows any other tag as text.
const ALLOWED_HTML = JSON.parse(readFileSync(new URL('./marp.config.json', import.meta.url), 'utf8')).html;
const ASSET_ADVICE = 'A render may only use files inside the Deck Folder or https: URLs; copy the file into media/ or fonts/.';

// Why a reference may not be rendered, or null when it stays inside the folder.
// data: URIs carry their content inline, so they reach nothing.
export function leavesFolder(reference, folder) {
  const ref = reference.trim();
  if (/^(https|data):/i.test(ref)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(ref)) return 'uses a scheme other than https:';
  // A browser reads a backslash in a file URL as a slash, and an encoded slash hides one.
  if (/\\|%2f|%5c/i.test(ref)) return 'hides a path behind an escaped slash';
  if (ref.startsWith('/') || path.isAbsolute(ref)) return 'is an absolute path';
  let decoded;
  try {
    decoded = decodeURIComponent(ref.replace(/[?#].*$/, ''));
  } catch {
    return 'is not a valid path';
  }
  const inside = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);
  const target = path.resolve(folder, decoded);
  if (!inside(path.resolve(folder), target)) return 'leaves the Deck Folder';
  if (existsSync(target) && !inside(realpathSync(folder), realpathSync(target))) return 'links to a file outside the Deck Folder';
  return null;
}

// CSS as the browser reads it: without comments, and with escapes such as u\72l( or \2e decoded.
function decodeCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\\([0-9a-f]{1,6})[ \t\r\n\f]?/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
    })
    .replace(/\\\r?\n/g, '')
    .replace(/\\(.)/g, '$1');
}

const unquote = (token) => token.trim().replace(/^(["'])([\s\S]*)\1$/, '$2');

// The text between a function's opening parenthesis (at `start`) and its matching close.
function argumentsAt(text, start) {
  let depth = 1;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) { if (char === quote) quote = null; } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')' && (depth -= 1) === 0) return text.slice(start, index);
  }
  return text.slice(start);
}

// Every file a stylesheet loads: url() and src(), the strings in image-set(),
// image(), and cross-fade(), and @import.
function cssReferences(css) {
  const text = decodeCss(css);
  const references = [...text.matchAll(/\b(?:url|src)\(\s*("[^"]*"|'[^']*'|[^)]*?)\s*\)/gi)].map((match) => unquote(match[1]));
  for (const match of text.matchAll(/(?:-webkit-)?(?:image-set|image|cross-fade)\(/gi)) {
    for (const string of argumentsAt(text, match.index + match[0].length).matchAll(/"[^"]*"|'[^']*'/g)) references.push(unquote(string[0]));
  }
  for (const match of text.matchAll(/@import\s*("[^"]*"|'[^']*')/gi)) references.push(unquote(match[1]));
  return references;
}

function decodeEntities(text) {
  const named = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (_, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
  });
}

// Every file Marp's own render of the deck would load, read from its HTML and CSS,
// so each way Markdown or CSS can name a file is covered. Each slide is one <svg>.
export function assetFindings({ html, css }, folder) {
  const findings = [];
  const reported = new Set();
  const check = (slide, reference) => {
    const reason = leavesFolder(reference, folder);
    if (!reason || reported.has(reference)) return;
    reported.add(reference);
    findings.push({ slide, rule: 'asset-path', message: `loads ${reference}, which ${reason}. ${ASSET_ADVICE}` });
  };
  html.split(/(?=<svg\b[^>]*\bdata-marpit-svg)/).forEach((chunk, index) => {
    const slide = index > 0 ? index : null;
    for (const [, name, value] of chunk.matchAll(/\s(src|srcset|poster|style)="([^"]*)"/gi)) {
      const decoded = decodeEntities(value);
      if (name.toLowerCase() === 'style') cssReferences(decoded).forEach((reference) => check(slide, reference));
      else if (name.toLowerCase() === 'srcset') decoded.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean).forEach((reference) => check(slide, reference));
      else check(slide, decoded);
    }
  });
  for (const reference of cssReferences(css)) check(null, reference);
  return findings;
}

// Code blocks and inline code are shown as text, never interpreted.
function withoutCode(text) {
  return text.replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
}

// Raw HTML outside Marp's allowlist, which the render would show as text or strip.
export function rawHtmlFindings(deck) {
  const findings = [];
  for (const slide of deck.slides) {
    const markup = withoutCode(slide.text).replace(/<!--[\s\S]*?-->/g, '').replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');
    const found = new Set();
    for (const [, name, attributes] of markup.matchAll(/<\/?([A-Za-z][\w-]*)((?:\s[^>]*)?)>/g)) {
      const tag = name.toLowerCase();
      if (!(tag in ALLOWED_HTML)) { found.add(`<${tag}>`); continue; }
      for (const [attribute] of attributes.matchAll(/[^\s=/"']+(?=\s*=|\s|\/|$)/g)) {
        if (!ALLOWED_HTML[tag].includes(attribute.toLowerCase())) found.add(`<${tag} ${attribute.toLowerCase()}>`);
      }
    }
    for (const markupFound of found) findings.push({ slide: slide.number, rule: 'raw-html', message: `has raw HTML ${markupFound}, which the render drops or shows as text. Use Markdown instead; only <span lang="…"> and <br> are kept.` });
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
      if (!leavesFolder(image.src, folder) && !/^[a-z]+:/i.test(image.src) && !existsSync(path.join(folder, decodeURI(image.src)))) {
        at('missing-image', `shows ${image.src}, which is not in the Deck Folder; make the visual or fix the path.`);
      }
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
  // Chrome's sandbox stays on; it cannot start as root, and CHROME_NO_SANDBOX is the person's explicit opt-out (Marp honours it too).
  const noSandbox = process.getuid?.() === 0 || Boolean(process.env.CHROME_NO_SANDBOX);
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: noSandbox ? ['--no-sandbox'] : [] });
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
