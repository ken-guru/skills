import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PNG } from 'pngjs';

export const gallerySlides = Object.freeze([
  { archetype: 'title', slideNumber: 1 },
  { archetype: 'text-plus-image', slideNumber: 4 },
  { archetype: 'data', slideNumber: 6 },
  { archetype: 'quotation', slideNumber: 8 },
]);

export function resolveGallerySource({ themes, sourceFiles, sampleMediaPresent }) {
  if (!sampleMediaPresent) {
    throw new Error(
      'Paid image generation required: obtain explicit confirmation, then use generate-images in one-at-a-time mode. Gallery scripts never call an image API.',
    );
  }
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error('Gallery source resolution requires at least one Theme identifier.');
  }
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) {
    throw new Error('Gallery source resolution requires fingerprinted source files.');
  }

  const fingerprint = createHash('sha256');
  for (const source of [...sourceFiles].sort((left, right) => left.path.localeCompare(right.path))) {
    fingerprint.update(source.path);
    fingerprint.update('\0');
    fingerprint.update(source.bytes);
    fingerprint.update('\0');
  }

  return {
    assets: themes.flatMap((theme) =>
      gallerySlides.map(({ archetype, slideNumber }) => ({
        theme,
        archetype,
        slideNumber,
        filename: `${theme}-${archetype}.png`,
      })),
    ),
    sourceFingerprint: fingerprint.digest('hex'),
  };
}

export async function approveGalleryAssets({
  approve,
  reportDirectory,
  assetsDirectory,
  source,
  provenance,
}) {
  if (!approve) {
    throw new Error('Refusing to replace gallery assets without the explicit --approve flag.');
  }
  if (
    !provenance?.provider ||
    !provenance?.model ||
    !provenance?.approvedAt ||
    Object.values(provenance).some((value) => /^pending/i.test(value))
  ) {
    throw new Error('Gallery approval requires provider, model, and approval date provenance.');
  }

  const inspected = [];
  let totalBytes = 0;
  for (const asset of source.assets) {
    const sourcePath = path.join(reportDirectory, asset.filename);
    let bytes;
    try {
      bytes = await readFile(sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Missing reviewed gallery render ${asset.filename}.`);
      }
      throw error;
    }
    const png = PNG.sync.read(bytes);
    if (png.width !== 1280 || png.height !== 720) {
      throw new Error(
        `${asset.filename} is ${png.width}×${png.height}; expected 1280×720.`,
      );
    }
    if (bytes.length > 1.5 * 1024 * 1024) {
      throw new Error(`${asset.filename} exceeds the 1.5 MB hard ceiling.`);
    }
    totalBytes += bytes.length;
    inspected.push({ asset, sourcePath, bytes });
  }
  if (totalBytes > 12 * 1024 * 1024) {
    throw new Error('Approved gallery screenshots exceed the 12 MB hard ceiling.');
  }

  await mkdir(assetsDirectory, { recursive: true });
  const manifestAssets = {};
  const warnings = [];
  for (const { asset, sourcePath, bytes } of inspected) {
    await cp(sourcePath, path.join(assetsDirectory, asset.filename));
    if (bytes.length > 750 * 1024) {
      warnings.push(`${asset.filename} exceeds the 750 KB soft target.`);
    }
    manifestAssets[asset.filename] = {
      theme: asset.theme,
      archetype: asset.archetype,
      slideNumber: asset.slideNumber,
      renderer: 'html',
      width: 1280,
      height: 720,
      bytes: (await stat(sourcePath)).size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  const manifest = {
    manifestVersion: 1,
    sourceFingerprint: source.sourceFingerprint,
    provenance,
    assets: manifestAssets,
  };
  await writeFile(
    path.join(assetsDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return { approved: inspected.length, warnings, manifest };
}

function markdownImages(markdown) {
  return [...markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
    ([, alternative, target]) => ({ alternative: alternative.trim(), target }),
  );
}

function markdownLinks(markdown) {
  return [...markdown.matchAll(/(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
    ([, target]) => target,
  );
}

function headingIssues(markdown, surface) {
  const levels = [...markdown.matchAll(/^(#{1,6})\s+\S/gm)].map((match) => match[1].length);
  const issues = [];
  if (levels.filter((level) => level === 1).length !== 1) {
    issues.push(`${surface} must contain exactly one level-one page title.`);
  }
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      issues.push(`${surface} skips a heading level.`);
      break;
    }
  }
  return issues;
}

function canonicalTarget(target, surface) {
  const clean = target.split('#')[0];
  if (!clean || /^(?:https?:|mailto:|#)/.test(target)) return null;
  return path.posix.normalize(
    surface === 'gallery' ? path.posix.join('docs', clean) : clean,
  );
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
    if (!/sample artwork was AI-generated/i.test(document.markdown)) {
      issues.push(`${document.name} is missing the AI-generated sample artwork disclosure.`);
    }
    if (/<\/?(?:table|picture)|<img\b[^>]*(?:width|height)=/i.test(document.markdown)) {
      issues.push(`${document.name} must use portable Markdown without layout HTML.`);
    }
    for (const image of markdownImages(document.markdown)) {
      if (
        !image.alternative ||
        /^(?:image|screenshot|slide|photo|picture)(?:\s+\d+)?$/i.test(image.alternative) ||
        /\.(?:png|jpe?g|webp|gif)$/i.test(image.alternative)
      ) {
        issues.push(`${document.name} contains generic alternative text for ${image.target}.`);
      }
      if (allAlternatives.has(image.alternative)) {
        issues.push(`${document.name} repeats alternative text: ${image.alternative}.`);
      }
      allAlternatives.add(image.alternative);
    }
    for (const target of [
      ...markdownImages(document.markdown).map((image) => image.target),
      ...markdownLinks(document.markdown),
    ]) {
      const canonical = canonicalTarget(target, document.surface);
      if (canonical && !existingPaths.has(canonical)) {
        issues.push(`${document.name} link ${target} does not resolve.`);
      }
    }
  }

  const readmeNames = new Set(markdownImages(readme).map(({ target }) => path.posix.basename(target)));
  const galleryNames = new Set(markdownImages(gallery).map(({ target }) => path.posix.basename(target)));
  const expectedTitles = expectedAssets.filter((filename) => filename.endsWith('-title.png'));
  const missingReadme = expectedTitles.filter((filename) => !readmeNames.has(filename));
  const missingGallery = expectedAssets.filter((filename) => !galleryNames.has(filename));
  if (missingReadme.length || missingGallery.length) {
    issues.push(
      `Documentation is missing expected gallery image references: ${[
        ...missingReadme,
        ...missingGallery,
      ].join(', ')}.`,
    );
  }

  return issues;
}

export async function validateApprovedGallery({ assetsDirectory, source }) {
  const issues = [];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(assetsDirectory, 'manifest.json'), 'utf8'));
  } catch (error) {
    return [
      error.code === 'ENOENT'
        ? 'Approved gallery manifest is missing.'
        : `Approved gallery manifest is invalid: ${error.message}`,
    ];
  }
  if (manifest.sourceFingerprint !== source.sourceFingerprint) {
    issues.push(
      `Gallery dependency fingerprint is stale: approved ${manifest.sourceFingerprint}, current ${source.sourceFingerprint}.`,
    );
  }
  if (
    !manifest.provenance?.provider ||
    !manifest.provenance?.model ||
    !manifest.provenance?.approvedAt ||
    Object.values(manifest.provenance).some((value) => /^pending/i.test(value))
  ) {
    issues.push('Gallery manifest has incomplete image-generation provenance.');
  }

  let totalBytes = 0;
  for (const asset of source.assets) {
    const entry = manifest.assets?.[asset.filename];
    if (!entry) {
      issues.push(`Gallery manifest is missing ${asset.filename}.`);
      continue;
    }
    let bytes;
    try {
      bytes = await readFile(path.join(assetsDirectory, asset.filename));
    } catch (error) {
      if (error.code === 'ENOENT') {
        issues.push(`Approved gallery asset ${asset.filename} is missing.`);
        continue;
      }
      throw error;
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== entry.sha256) {
      issues.push(`${asset.filename} hash does not match its approved manifest entry.`);
      continue;
    }
    const png = PNG.sync.read(bytes);
    if (png.width !== 1280 || png.height !== 720) {
      issues.push(`${asset.filename} is ${png.width}×${png.height}; expected 1280×720.`);
    }
    if (bytes.length > 1.5 * 1024 * 1024) {
      issues.push(`${asset.filename} exceeds the 1.5 MB hard ceiling.`);
    }
    totalBytes += bytes.length;
  }
  if (totalBytes > 12 * 1024 * 1024) {
    issues.push('Approved gallery screenshots exceed the 12 MB hard ceiling.');
  }
  return issues;
}
