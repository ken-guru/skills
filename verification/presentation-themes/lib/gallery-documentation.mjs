import path from 'node:path';

function markdownImages(markdown) {
  return [...markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
    ([, alternative, target]) => ({ alternative: alternative.trim(), target }),
  );
}

function markdownLinks(markdown) {
  return [...markdown.matchAll(/(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(([, target]) => target);
}

function headingIssues(markdown, surface) {
  const levels = [...markdown.matchAll(/^(#{1,6})\s+\S/gm)].map((match) => match[1].length);
  const issues = [];
  if (levels.filter((level) => level === 1).length !== 1) issues.push(`${surface} must contain exactly one level-one page title.`);
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) { issues.push(`${surface} skips a heading level.`); break; }
  }
  return issues;
}

function canonicalTarget(target, surface) {
  const clean = target.split('#')[0];
  if (!clean || /^(?:https?:|mailto:|#)/.test(target)) return null;
  return path.posix.normalize(surface === 'gallery' ? path.posix.join('docs', clean) : clean);
}

const guidancePatterns = [
  /editorial[^.]{0,100}(?:default|recommended)|(?:default|recommended)[^.]{0,100}editorial/i,
  /(?:choose|select|change)[^.]{0,120}(?:theme|editorial|signal|field notes)[^.]{0,120}discovery|discovery[^.]{0,120}(?:theme|editorial|signal|field notes)/i,
  /(?:stable|recognizable|consistent|deterministic)[\s\S]{0,500}(?:var(?:y|ies|iation)|respond|content|composition|layout)/i,
  /(?:media spec|sample artwork|underlying artistic style|media intent)[\s\S]{0,300}(?:own|control|image|diagram|media|style|subject)/i,
];
const visualPropertyPattern = /(?:serif|condensed|typograph|grid|paper|texture|cream|dark|black|green|cyan|pink|gold|red|angled|taped|circular|oval|metric|rule|portrait|frame|canvas|headline)/i;

function expectedIdentity(filename) {
  const stem = filename.replace(/\.png$/, '');
  for (const theme of ['editorial', 'signal', 'field-notes']) {
    if (stem.startsWith(`${theme}-`)) return { theme, archetype: stem.slice(theme.length + 1) };
  }
  return null;
}

export function validateGalleryDocumentation({ readme, gallery, expectedAssets, existingPaths }) {
  const issues = [];
  const documents = [
    { name: 'README', markdown: readme, surface: 'readme' },
    { name: 'Gallery', markdown: gallery, surface: 'gallery' },
  ];
  const allAlternatives = new Set();

  for (const document of documents) {
    issues.push(...headingIssues(document.markdown, document.name));
    if (!/sample artwork was AI-generated/i.test(document.markdown)) issues.push(`${document.name} is missing the AI-generated sample artwork disclosure.`);
    if (!guidancePatterns.every((pattern) => pattern.test(document.markdown))) issues.push(`${document.name} is missing required theme selection and behavior guidance.`);
    if (/<\/?(?:table|picture)|<img\b[^>]*(?:width|height)=/i.test(document.markdown)) issues.push(`${document.name} must use portable Markdown without layout HTML.`);
    for (const image of markdownImages(document.markdown)) {
      if (!image.alternative || /^(?:image|screenshot|slide|photo|picture)(?:\s+\d+)?$/i.test(image.alternative) || /\.(?:png|jpe?g|webp|gif)$/i.test(image.alternative)) issues.push(`${document.name} contains generic alternative text for ${image.target}.`);
      const identity = expectedIdentity(path.posix.basename(image.target));
      if (identity) {
        const normalizedAlternative = image.alternative.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
        const hasTheme = normalizedAlternative.includes(identity.theme.replace('-', ' '));
        const hasArchetype = normalizedAlternative.includes(identity.archetype.replaceAll('-', ' '));
        if (!hasTheme || !hasArchetype) issues.push(`${document.name} alternative text for ${image.target} must name its Theme and Slide Archetype.`);
        if (!visualPropertyPattern.test(image.alternative)) issues.push(`${document.name} alternative text for ${image.target} must describe a distinguishing visual property.`);
      }
      if (allAlternatives.has(image.alternative)) issues.push(`${document.name} repeats alternative text: ${image.alternative}.`);
      allAlternatives.add(image.alternative);
    }
    for (const target of [...markdownImages(document.markdown).map(({ target }) => target), ...markdownLinks(document.markdown)]) {
      const canonical = canonicalTarget(target, document.surface);
      if (canonical && !existingPaths.has(canonical)) issues.push(`${document.name} link ${target} does not resolve.`);
    }
  }

  const galleryImageNames = (markdown) => markdownImages(markdown)
    .filter(({ target }) => target.includes('assets/presentation-themes/'))
    .map(({ target }) => path.posix.basename(target))
    .sort();
  const readmeNames = galleryImageNames(readme);
  const galleryNames = galleryImageNames(gallery);
  const expectedTitles = expectedAssets.filter((filename) => filename.endsWith('-title.png')).sort();
  const expectedGallery = [...expectedAssets].sort();
  if (JSON.stringify(readmeNames) !== JSON.stringify(expectedTitles)) {
    issues.push('README must reference exactly the three expected title images once each.');
  }
  if (JSON.stringify(galleryNames) !== JSON.stringify(expectedGallery)) {
    issues.push('Gallery must reference exactly the expected twelve gallery images once each.');
  }
  return issues;
}
