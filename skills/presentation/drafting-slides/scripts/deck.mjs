// Parses a Deck Source (Marp Markdown) into slides: heading, class, notes,
// images, links, and tables. Used for the notes script and the checks.

// Marp directives that may appear in HTML comments; anything else is a note.
const DIRECTIVES = new Set([
  'theme', 'class', 'paginate', 'header', 'footer', 'backgroundColor', 'backgroundImage', 'backgroundPosition',
  'backgroundRepeat', 'backgroundSize', 'color', 'size', 'math', 'title', 'description', 'author', 'image',
  'keywords', 'url', 'lang', 'marp', 'headingDivider', 'style',
]);

function isDirectiveComment(body) {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => {
    const key = line.match(/^_?([A-Za-z]+)\s*:/)?.[1];
    return key !== undefined && DIRECTIVES.has(key);
  });
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: text, offset: 0 };
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) frontmatter[pair[1]] = pair[2].replace(/^["']|["']$/g, '').trim();
  }
  return { frontmatter, body: text.slice(match[0].length), offset: match[0].split('\n').length - 1 };
}

// Splits on `---` lines outside fenced code, keeping each slide's first line number.
function splitSlides(body, offset) {
  const slides = [];
  let current = [];
  let start = offset + 1;
  let fence = null;
  body.split('\n').forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) fence = fence === null ? fenceMatch[1][0] : (line.trim().startsWith(fence) ? null : fence);
    if (fence === null && /^---\s*$/.test(line)) {
      slides.push({ lines: current, start });
      current = [];
      start = offset + index + 2;
    } else current.push(line);
  });
  slides.push({ lines: current, start });
  return slides.filter((slide) => slide.lines.some((line) => line.trim()));
}

function parseSlide({ lines, start }, index) {
  const text = lines.join('\n');
  const slide = { number: index + 1, line: start, headings: [], heading: null, classes: [], notes: [], visualIntents: [], images: [], links: [], tables: [], text };

  for (const comment of text.matchAll(/<!--([\s\S]*?)-->/g)) {
    const body = comment[1].trim();
    if (!body || body === 'decorative') continue;
    const intent = body.match(/^Visual intent:\s*([\s\S]+)$/i)?.[1];
    if (intent) slide.visualIntents.push(intent.replace(/\s+/g, ' ').trim());
    else if (isDirectiveComment(body)) {
      for (const directive of body.matchAll(/^\s*_?class\s*:\s*(.+)$/gm)) slide.classes.push(...directive[1].trim().split(/\s+/));
    } else slide.notes.push(body);
  }

  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, (comment) => (comment.trim() === '<!-- decorative -->' ? comment : ''));
  let fence = null;
  const contentLines = withoutComments.split('\n');
  contentLines.forEach((line, lineIndex) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) { fence = fence === null ? fenceMatch[1][0] : null; return; }
    if (fence !== null) return;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) slide.headings.push({ level: heading[1].length, text: heading[2] });
    for (const image of line.matchAll(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      const altRaw = image[1];
      const keywords = altRaw.split(/\s+/);
      const bg = keywords[0] === 'bg';
      const alt = bg ? keywords.filter((word) => !/^(bg|left|right|contain|cover|fit|auto|vertical|\d+%?|[\w-]+:\S+)$/.test(word)).join(' ') : altRaw;
      const nearby = [contentLines[lineIndex - 1], line, contentLines[lineIndex + 1]].join('\n');
      slide.images.push({ alt: alt.trim(), src: image[2], bg, decorative: /<!--\s*decorative\s*-->/.test(nearby) });
    }
    for (const link of line.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)) slide.links.push({ text: link[1].trim(), href: link[2] });
    for (const bare of line.matchAll(/(?<![("<\[])\bhttps?:\/\/[^\s)>\]]+/g)) {
      if (!line.includes(`](${bare[0]}`)) slide.links.push({ text: bare[0], href: bare[0], bare: true });
    }
  });
  slide.heading = slide.headings[0]?.text ?? null;

  // A table is a header row followed by a delimiter row.
  for (let i = 0; i + 1 < contentLines.length; i += 1) {
    if (/^\s*\|.*\|\s*$/.test(contentLines[i]) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(contentLines[i + 1])) {
      slide.tables.push({ header: contentLines[i].split('|').map((cell) => cell.trim()).filter(Boolean) });
    }
  }
  return slide;
}

export function parseDeck(text) {
  const { frontmatter, body, offset } = parseFrontmatter(text.replace(/\r\n/g, '\n'));
  const slides = splitSlides(body, offset).map(parseSlide);
  return { frontmatter, title: frontmatter.title ?? null, lang: frontmatter.lang ?? null, slides };
}
