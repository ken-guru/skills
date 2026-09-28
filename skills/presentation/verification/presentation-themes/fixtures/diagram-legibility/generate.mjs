// Writes the shared Effective Text Size fixtures. Each SVG mirrors D2 0.7.1's
// shape: an XML prolog, a root <svg> with its own viewBox, a nested d2-svg, and
// inline font-size on every <text>. Verdicts are for the Editorial diagram
// media box (1126×252); see diagram-legibility-agreement.test.mjs.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const text = (size, attribute = false) => (attribute
  ? `<text x="10" y="40"${size === null ? '' : ` font-size="${size}"`}>Label</text>`
  : `<text x="10" y="40" class="text-bold" style="text-anchor:middle;font-size:${size}px">Label</text>`);
const svg = (width, height, texts) => `<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg" data-d2-version="0.7.1" preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${width} ${height}"><svg class="d2-svg" width="${width}" height="${height}" viewBox="-89 -89 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fffaf0"/>${texts.join('')}</svg></svg>\n`;

const fixtures = {
  'wide-16px.svg': svg(1800, 200, [text(28), text(16)]),
  'role-sized.svg': svg(900, 240, [text(28), text(24)]),
  'tall.svg': svg(300, 700, [text(28)]),
  'exact-threshold.svg': svg(1126, 252, [text(20)]),
  'just-under.svg': svg(1126, 252, [text(19.9)]),
  'attribute-font-size.svg': svg(600, 100, [text(12, true)]),
  'relative-font-size.svg': svg(600, 100, [text(28), text('1.2em', true)]),
  'unsized-text.svg': svg(600, 100, [text(28), text(null, true)]),
  'no-text.svg': svg(600, 100, []),
};
for (const [name, contents] of Object.entries(fixtures)) await writeFile(path.join(directory, name), contents);
