import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { PNG } from 'pngjs';

import {
  approveGalleryAssets,
  resolveGallerySource,
  validateApprovedGallery,
} from '../lib/gallery-contract.mjs';

async function approvalFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gallery-approval-'));
  const reportDirectory = path.join(root, 'reports');
  const assetsDirectory = path.join(root, 'assets');
  await mkdir(reportDirectory);
  const source = resolveGallerySource({
    themes: ['editorial'],
    sourceFiles: [{ path: 'fixture', bytes: Buffer.from('fixture') }],
    sampleMediaPresent: true,
  });
  for (const asset of source.assets) {
    const png = new PNG({ width: 1280, height: 720 });
    await writeFile(path.join(reportDirectory, asset.filename), PNG.sync.write(png));
  }
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
  assert.deepEqual(manifest.provenance, {
    provider: 'Gemini',
    model: 'test-model',
    approvedAt: '2026-07-17',
  });
  assert.equal(manifest.assets['editorial-title.png'].width, 1280);
  assert.equal(manifest.assets['editorial-title.png'].height, 720);
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
