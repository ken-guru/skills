import { createHash } from 'node:crypto';

export const gallerySlides = Object.freeze([
  { archetype: 'title', slideNumber: 1 },
  { archetype: 'text-plus-image', slideNumber: 4 },
  { archetype: 'data', slideNumber: 6 },
  { archetype: 'quotation', slideNumber: 8 },
]);

export function resolveGallerySource({
  themes,
  sourceFiles,
  sampleMediaPresent,
  sampleMediaBytes,
  fixtureVersion = 1,
}) {
  if (!sampleMediaPresent || !sampleMediaBytes) {
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
    fixtureVersion,
    sampleMediaSha256: createHash('sha256').update(sampleMediaBytes).digest('hex'),
    sourceFingerprint: fingerprint.digest('hex'),
  };
}
