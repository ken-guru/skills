import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { deflateSync } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const cli = path.resolve('skills/presentation/presentation-validation/scripts/presentation-validation.mjs');

async function fixture() {
  const project = await mkdtemp(path.join(os.tmpdir(), 'presentation-validation-'));
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify({
    language: 'en',
    theme: { id: 'editorial' },
    paths: { presentation: 'PRESENTASJON.md' },
  }));
  await writeFile(path.join(project, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  await writeFile(path.join(project, 'PRESENTASJON.md'), `---\nmarp: true\ntheme: editorial\nsize: 16:9\npaginate: true\nlang: en\n---\n<!-- _class: archetype-title variation-default tone-light -->\n<h1 class="slot-title">Hello</h1>\n`);
  return project;
}

// Mirrors how Marp's Chromium-based PDF export stores page objects: inside a
// Flate-compressed object stream, never as literal `/Type /Page` bytes.
function compressedPagesPdfFixture(pageCount, mediaBox = '0 0 1280 720') {
  const pageObjects = `<< /Type /Page /Parent 2 0 R /MediaBox [${mediaBox}] >>`.repeat(pageCount);
  const compressed = deflateSync(Buffer.from(pageObjects, 'latin1'));
  const header = Buffer.from(
    `%PDF-1.7\n1 0 obj\n<< /Type /ObjStm /N ${pageCount} /First 0 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
    'latin1',
  );
  const footer = Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1');
  return Buffer.concat([header, compressed, footer]);
}

test('reports the runtime version through the public CLI', async () => {
  const { stdout } = await run(process.execPath, [cli, '--version']);
  assert.equal(stdout.trim(), '1.0.0');
});

test('validates structure through JSON without mutating the Project Folder', async () => {
  const project = await fixture();
  const before = await readFile(path.join(project, 'PRESENTASJON.md'), 'utf8');
  const { stdout } = await run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.summary.blocking, 0);
  assert.ok(report.findings.some((finding) => finding.check === 'structure.slides'));
  assert.equal(await readFile(path.join(project, 'PRESENTASJON.md'), 'utf8'), before);
});

test('rejects report paths outside the Project Folder', async () => {
  const project = await fixture();
  await assert.rejects(
    run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--report', '../outside.json']),
    (error) => error.code === 2 && error.stderr.includes('--report must be inside'),
  );
});

test('exports.parity counts PDF pages stored in a compressed object stream, not just raw bytes', async () => {
  const project = await fixture();
  await writeFile(path.join(project, 'PRESENTASJON.html'), `<!doctype html><html><body>${'<section>Slide</section>'.repeat(3)}</body></html>`);
  await writeFile(path.join(project, 'PRESENTASJON.pdf'), compressedPagesPdfFixture(3));
  const { stdout } = await run(process.execPath, [cli, 'check', 'exports', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  const parity = report.findings.find((finding) => finding.check === 'exports.parity');
  assert.equal(parity.severity, 'info');
  assert.equal(report.summary.blocking, 0);
});

test('exports.parity still blocks on a genuine HTML/PDF slide-count mismatch', async () => {
  const project = await fixture();
  await writeFile(path.join(project, 'PRESENTASJON.html'), `<!doctype html><html><body>${'<section>Slide</section>'.repeat(3)}</body></html>`);
  await writeFile(path.join(project, 'PRESENTASJON.pdf'), compressedPagesPdfFixture(2));
  const { stdout } = await run(process.execPath, [cli, 'check', 'exports', '--project-dir', project, '--format', 'json']).catch((error) => ({ stdout: error.stdout }));
  const report = JSON.parse(stdout);
  const parity = report.findings.find((finding) => finding.check === 'exports.parity');
  assert.equal(parity.severity, 'blocking');
  assert.match(parity.evidence, /HTML 3; PDF 2/);
});

test('exports.media-parity ignores src=/href= that appear inside script or style blocks', async () => {
  const project = await fixture();
  const html = [
    '<!doctype html><html><body>',
    '<section>Slide</section>',
    '</body>',
    '<script>i.src="data:image/svg+xml;charset=utf8,decoy";a.href="not-a-real-media-ref.svg";</script>',
    "<style>.icon{background:url('also-not-real.svg')}</style>",
    '</html>',
  ].join('');
  await writeFile(path.join(project, 'PRESENTASJON.html'), html);
  await writeFile(path.join(project, 'PRESENTASJON.pdf'), compressedPagesPdfFixture(1));
  const { stdout } = await run(process.execPath, [cli, 'check', 'exports', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.equal(report.findings.find((finding) => finding.check === 'exports.media-parity'), undefined);
  assert.equal(report.summary.blocking, 0);
});

test('exports.dimensions reads MediaBox from a compressed object stream and flags a genuine non-16:9 mismatch', async () => {
  const project = await fixture();
  await writeFile(path.join(project, 'PRESENTASJON.html'), `<!doctype html><html><body>${'<section>Slide</section>'.repeat(1)}</body></html>`);
  await writeFile(path.join(project, 'PRESENTASJON.pdf'), compressedPagesPdfFixture(1, '0 0 100 100'));
  const { stdout } = await run(process.execPath, [cli, 'check', 'exports', '--project-dir', project, '--format', 'json']).catch((error) => ({ stdout: error.stdout }));
  const report = JSON.parse(stdout);
  const dimensions = report.findings.find((finding) => finding.check === 'exports.dimensions');
  assert.equal(dimensions.severity, 'blocking');
  assert.match(dimensions.evidence, /100 × 100/);
});

async function structureFixture(slotBody) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'presentation-validation-'));
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify({
    language: 'en',
    theme: { id: 'editorial' },
    paths: { presentation: 'PRESENTASJON.md' },
  }));
  await writeFile(path.join(project, 'PROJECT.json'), JSON.stringify({ projectType: 'presentation' }));
  const markdown = [
    '---',
    'marp: true',
    'theme: editorial',
    'size: 16:9',
    'paginate: true',
    'lang: en',
    '---',
    '<!-- _class: archetype-text-only variation-default tone-light -->',
    '<h2 class="slot-heading">Heading</h2>',
    slotBody,
  ].join('\n');
  await writeFile(path.join(project, 'PRESENTASJON.md'), markdown);
  return project;
}

test('structure.capacity counts generated <li> bullets that markdown dash syntax would have missed', async () => {
  const bulletItems = Array.from({ length: 6 }, (_, i) => `<li>Point ${i + 1}</li>`).join('\n');
  const project = await structureFixture(`<div class="slot-body"><ul>\n${bulletItems}\n</ul></div>`);
  const { stdout } = await run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  const capacity = report.findings.find((finding) => finding.check === 'structure.capacity');
  assert.ok(capacity, 'expected a structure.capacity finding for 6 generated <li> bullets');
  assert.match(capacity.message, /contains 6 bullets/);
});

test('structure.capacity does not spuriously trigger on markdown dash-prefixed prose', async () => {
  const dashLines = Array.from({ length: 6 }, (_, i) => `- example line ${i + 1}`).join('\n');
  const project = await structureFixture(`<div class="slot-body"><p>\n${dashLines}\n</p></div>`);
  const { stdout } = await run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.equal(report.findings.find((finding) => finding.check === 'structure.capacity'), undefined);
});

test('env.prerequisites does not require d2 for prose that merely mentions .svg', async () => {
  const project = await fixture();
  await writeFile(path.join(project, 'PRESENTASJON.md'), `---\nmarp: true\ntheme: editorial\nsize: 16:9\npaginate: true\nlang: en\n---\n<!-- _class: archetype-title variation-default tone-light -->\n<h1 class="slot-title">Convert your .svg files carefully</h1>\n`);
  const { stdout } = await run(process.execPath, [cli, 'check', 'env', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.equal(report.findings.some((finding) => finding.check === 'env.prerequisites' && /\bd2\b/.test(finding.message)), false);
});

test('env.prerequisites requires d2 when an .svg diagram is actually embedded', async () => {
  const project = await fixture();
  await writeFile(path.join(project, 'PRESENTASJON.md'), `---\nmarp: true\ntheme: editorial\nsize: 16:9\npaginate: true\nlang: en\n---\n<!-- _class: archetype-title variation-default tone-light -->\n<h1 class="slot-title">Title</h1>\n<img src="diagram.svg" alt="Flow">\n`);
  const { stdout } = await run(process.execPath, [cli, 'check', 'env', '--project-dir', project, '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.ok(report.findings.some((finding) => finding.check === 'env.prerequisites' && /\bd2\b/.test(finding.message)));
});

test('returns configuration status for a missing Project Folder contract', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'presentation-validation-empty-'));
  await assert.rejects(
    run(process.execPath, [cli, 'check', 'structure', '--project-dir', project, '--format', 'json']),
    (error) => error.code === 2 && JSON.parse(error.stdout).summary.blocking >= 1,
  );
});
