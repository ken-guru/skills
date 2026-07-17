import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { PNG } from 'pngjs';

import {
  resolveGallerySource,
} from '../lib/gallery-contract.mjs';
import { approveGalleryAssets, validateApprovedGallery } from '../lib/gallery-approval.mjs';

async function approvalFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gallery-approval-'));
  const reportDirectory = path.join(root, 'reports');
  const assetsDirectory = path.join(root, 'assets');
  await mkdir(reportDirectory);
  const source = resolveGallerySource({
    themes: ['editorial'],
    sourceFiles: [{ path: 'fixture', bytes: Buffer.from('fixture') }],
    sampleMediaPresent: true,
    sampleMediaBytes: Buffer.from('portrait'),
    fixtureVersion: 1,
  });
  const captures = {};
  for (const asset of source.assets) {
    const png = new PNG({ width: 1280, height: 720 });
    const bytes = PNG.sync.write(png);
    await writeFile(path.join(reportDirectory, asset.filename), bytes);
    captures[asset.filename] = {
      renderer: 'html',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  await writeFile(
    path.join(reportDirectory, 'rendered-gallery-manifest.json'),
    `${JSON.stringify({
      sourceFingerprint: source.sourceFingerprint,
      fixtureVersion: source.fixtureVersion,
      sourceMediaSha256: source.sampleMediaSha256,
      captures,
    }, null, 2)}\n`,
  );
  return { reportDirectory, assetsDirectory, source };
}

test('gallery approval refuses writes without explicit approval', async () => {
  const fixture = await approvalFixture();
  await assert.rejects(
    approveGalleryAssets({ ...fixture, approve: false }),
    /explicit --approve flag/,
  );
  await assert.rejects(readdir(fixture.assetsDirectory), { code: 'ENOENT' });
});

test('gallery approval rejects captures attested for a different source version', async () => {
  const fixture = await approvalFixture();
  const capturePath = path.join(fixture.reportDirectory, 'rendered-gallery-manifest.json');
  const capture = JSON.parse(await readFile(capturePath, 'utf8'));
  capture.sourceFingerprint = 'stale-source';
  await writeFile(capturePath, `${JSON.stringify(capture, null, 2)}\n`);
  await assert.rejects(
    approveGalleryAssets({
      ...fixture,
      approve: true,
      provenance: { provider: 'Gemini', model: 'test-model', approvedAt: '2026-07-17' },
    }),
    /capture attestation does not match the current gallery source/,
  );
});

test('gallery approval writes only exact reviewed assets and their provenance manifest', async () => {
  const fixture = await approvalFixture();
  const result = await approveGalleryAssets({
    ...fixture,
    approve: true,
    provenance: { provider: 'Gemini', model: 'test-model', approvedAt: '2026-07-17' },
  });

  assert.equal(result.approved, 4);
  assert.deepEqual((await readdir(fixture.assetsDirectory)).sort(), [
    'editorial-data.png',
    'editorial-quotation.png',
    'editorial-text-plus-image.png',
    'editorial-title.png',
    'manifest.json',
  ]);
  const manifest = JSON.parse(
    await readFile(path.join(fixture.assetsDirectory, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.sourceFingerprint, fixture.source.sourceFingerprint);
  assert.equal(manifest.fixtureVersion, 1);
  assert.equal(manifest.sourceMedia.sha256, fixture.source.sampleMediaSha256);
  assert.deepEqual(manifest.provenance, {
    provider: 'Gemini',
    model: 'test-model',
    approvedAt: '2026-07-17',
  });
  assert.equal(manifest.assets['editorial-title.png'].width, 1280);
  assert.equal(manifest.assets['editorial-title.png'].height, 720);
  assert.equal(manifest.assets['editorial-title.png'].renderer, 'html');
  assert.equal(manifest.assets['editorial-title.png'].theme, 'editorial');
  assert.equal(manifest.assets['editorial-title.png'].archetype, 'title');
  assert.equal(manifest.assets['editorial-title.png'].slideNumber, 1);
  assert.match(manifest.assets['editorial-title.png'].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    await validateApprovedGallery({
      assetsDirectory: fixture.assetsDirectory,
      source: fixture.source,
    }),
    [],
  );

  await writeFile(
    path.join(fixture.assetsDirectory, 'editorial-title.png'),
    Buffer.from('manual edit'),
  );
  const issues = await validateApprovedGallery({
    assetsDirectory: fixture.assetsDirectory,
    source: fixture.source,
  });
  assert.ok(issues.some((issue) => issue.includes('editorial-title.png hash does not match')));
});

test('gallery approval rejects unexpected screenshots', async () => {
  const fixture = await approvalFixture();
  await writeFile(path.join(fixture.reportDirectory, 'unexpected.png'), Buffer.from('not reviewed'));
  await assert.rejects(
    approveGalleryAssets({
      ...fixture,
      approve: true,
      provenance: { provider: 'Gemini', model: 'test-model', approvedAt: '2026-07-17' },
    }),
    /unexpected reviewed gallery file/,
  );
});

test('gallery approval removes stale public screenshots outside the exact reviewed set', async () => {
  const fixture = await approvalFixture();
  await mkdir(fixture.assetsDirectory);
  await writeFile(path.join(fixture.assetsDirectory, 'stale.png'), Buffer.from('stale'));
  await approveGalleryAssets({
    ...fixture,
    approve: true,
    provenance: { provider: 'Gemini', model: 'test-model', approvedAt: '2026-07-17' },
  });
  assert.ok(!(await readdir(fixture.assetsDirectory)).includes('stale.png'));
});

test('gallery validation checks manifest identity and recorded metadata', async () => {
  const fixture = await approvalFixture();
  await approveGalleryAssets({
    ...fixture,
    approve: true,
    provenance: { provider: 'Gemini', model: 'test-model', approvedAt: '2026-07-17' },
  });
  const manifestPath = path.join(fixture.assetsDirectory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.assets['editorial-title.png'].theme = 'signal';
  manifest.assets['editorial-title.png'].bytes += 1;
  manifest.assets['unexpected.png'] = { ...manifest.assets['editorial-title.png'] };
  manifest.fixtureVersion = 99;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const issues = await validateApprovedGallery({
    assetsDirectory: fixture.assetsDirectory,
    source: fixture.source,
  });
  assert.ok(issues.some((issue) => issue.includes('fixture version')));
  assert.ok(issues.some((issue) => issue.includes('theme metadata')));
  assert.ok(issues.some((issue) => issue.includes('byte count')));
  assert.ok(issues.some((issue) => issue.includes('unexpected manifest asset')));
});
