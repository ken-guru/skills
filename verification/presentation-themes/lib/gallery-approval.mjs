import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PNG } from 'pngjs';

const auxiliaryReportPngs = new Set([
  'presentation-themes-review-labels.png',
  'presentation-themes-review-matrix.png',
]);

function provenanceIsComplete(provenance) {
  return Boolean(
    provenance?.provider &&
      provenance?.model &&
      provenance?.approvedAt &&
      !Object.values(provenance).some((value) => /^pending/i.test(value)),
  );
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
  if (!provenanceIsComplete(provenance)) {
    throw new Error('Gallery approval requires provider, model, and approval date provenance.');
  }

  const expectedNames = new Set(source.assets.map(({ filename }) => filename));
  const unexpected = (await readdir(reportDirectory)).filter(
    (filename) => filename.endsWith('.png') && !expectedNames.has(filename) && !auxiliaryReportPngs.has(filename),
  );
  if (unexpected.length) {
    throw new Error(`Found unexpected reviewed gallery file(s): ${unexpected.join(', ')}.`);
  }
  const captureManifest = JSON.parse(
    await readFile(path.join(reportDirectory, 'rendered-gallery-manifest.json'), 'utf8'),
  );

  const inspected = [];
  let totalBytes = 0;
  for (const asset of source.assets) {
    const sourcePath = path.join(reportDirectory, asset.filename);
    let bytes;
    try {
      bytes = await readFile(sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Missing reviewed gallery render ${asset.filename}.`);
      throw error;
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    const capture = captureManifest.captures?.[asset.filename];
    if (capture?.renderer !== 'html' || capture.sha256 !== hash) {
      throw new Error(`${asset.filename} is not an attested HTML gallery capture.`);
    }
    const png = PNG.sync.read(bytes);
    if (png.width !== 1280 || png.height !== 720) {
      throw new Error(`${asset.filename} is ${png.width}×${png.height}; expected 1280×720.`);
    }
    if (bytes.length > 1.5 * 1024 * 1024) throw new Error(`${asset.filename} exceeds the 1.5 MB hard ceiling.`);
    totalBytes += bytes.length;
    inspected.push({ asset, sourcePath, bytes, hash });
  }
  if (totalBytes > 12 * 1024 * 1024) {
    throw new Error('Approved gallery screenshots exceed the 12 MB hard ceiling.');
  }

  await mkdir(assetsDirectory, { recursive: true });
  for (const filename of await readdir(assetsDirectory)) {
    if (filename.endsWith('.png') && !expectedNames.has(filename)) {
      await unlink(path.join(assetsDirectory, filename));
    }
  }
  const manifestAssets = {};
  const warnings = [];
  for (const { asset, sourcePath, bytes, hash } of inspected) {
    await cp(sourcePath, path.join(assetsDirectory, asset.filename));
    if (bytes.length > 750 * 1024) warnings.push(`${asset.filename} exceeds the 750 KB soft target.`);
    manifestAssets[asset.filename] = {
      theme: asset.theme,
      archetype: asset.archetype,
      slideNumber: asset.slideNumber,
      fixtureVersion: source.fixtureVersion,
      renderer: 'html',
      sourceMediaSha256: source.sampleMediaSha256,
      width: 1280,
      height: 720,
      bytes: (await stat(sourcePath)).size,
      sha256: hash,
    };
  }
  const manifest = {
    manifestVersion: 1,
    fixtureVersion: source.fixtureVersion,
    sourceFingerprint: source.sourceFingerprint,
    sourceMedia: { sha256: source.sampleMediaSha256 },
    provenance,
    assets: manifestAssets,
  };
  await writeFile(path.join(assetsDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { approved: inspected.length, warnings, manifest };
}

export async function validateApprovedGallery({ assetsDirectory, source, onWarning = () => {} }) {
  const issues = [];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(assetsDirectory, 'manifest.json'), 'utf8'));
  } catch (error) {
    return [error.code === 'ENOENT' ? 'Approved gallery manifest is missing.' : `Approved gallery manifest is invalid: ${error.message}`];
  }
  if (manifest.sourceFingerprint !== source.sourceFingerprint) {
    issues.push(`Gallery dependency fingerprint is stale: approved ${manifest.sourceFingerprint}, current ${source.sourceFingerprint}.`);
  }
  if (manifest.fixtureVersion !== source.fixtureVersion) issues.push('Gallery manifest fixture version is stale.');
  if (manifest.sourceMedia?.sha256 !== source.sampleMediaSha256) issues.push('Gallery manifest source-media hash is stale.');
  if (!provenanceIsComplete(manifest.provenance)) issues.push('Gallery manifest has incomplete image-generation provenance.');

  const expectedNames = new Set(source.assets.map(({ filename }) => filename));
  for (const filename of Object.keys(manifest.assets ?? {})) {
    if (!expectedNames.has(filename)) issues.push(`Gallery manifest contains unexpected manifest asset ${filename}.`);
  }
  const publicPngs = (await readdir(assetsDirectory)).filter((filename) => filename.endsWith('.png'));
  for (const filename of publicPngs) {
    if (!expectedNames.has(filename)) issues.push(`Approved gallery contains unexpected asset ${filename}.`);
  }
  let totalBytes = 0;
  for (const asset of source.assets) {
    const entry = manifest.assets?.[asset.filename];
    if (!entry) {
      issues.push(`Gallery manifest is missing ${asset.filename}.`);
      continue;
    }
    for (const [field, expected] of [
      ['theme', asset.theme], ['archetype', asset.archetype], ['slideNumber', asset.slideNumber],
      ['fixtureVersion', source.fixtureVersion], ['renderer', 'html'], ['sourceMediaSha256', source.sampleMediaSha256],
      ['width', 1280], ['height', 720],
    ]) {
      if (entry[field] !== expected) issues.push(`${asset.filename} has incorrect ${field === 'theme' ? 'theme metadata' : `${field} metadata`}.`);
    }
    let bytes;
    try {
      bytes = await readFile(path.join(assetsDirectory, asset.filename));
    } catch (error) {
      if (error.code === 'ENOENT') { issues.push(`Approved gallery asset ${asset.filename} is missing.`); continue; }
      throw error;
    }
    if (entry.bytes !== bytes.length) issues.push(`${asset.filename} byte count does not match its manifest entry.`);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== entry.sha256) { issues.push(`${asset.filename} hash does not match its approved manifest entry.`); continue; }
    const png = PNG.sync.read(bytes);
    if (png.width !== 1280 || png.height !== 720) issues.push(`${asset.filename} is ${png.width}×${png.height}; expected 1280×720.`);
    if (bytes.length > 1.5 * 1024 * 1024) issues.push(`${asset.filename} exceeds the 1.5 MB hard ceiling.`);
    else if (bytes.length > 750 * 1024) onWarning(`${asset.filename} exceeds the 750 KB soft target.`);
    totalBytes += bytes.length;
  }
  if (totalBytes > 12 * 1024 * 1024) issues.push('Approved gallery screenshots exceed the 12 MB hard ceiling.');
  return issues;
}
