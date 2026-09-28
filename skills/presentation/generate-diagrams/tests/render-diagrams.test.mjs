import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script = path.resolve('skills/presentation/generate-diagrams/scripts/render-diagrams.mjs');
const stub = path.resolve('skills/presentation/generate-diagrams/tests/fixtures/stub-d2.mjs');
const installedThemes = path.resolve('skills/presentation/generate-slides/themes');

// A bin directory whose `d2` is the stub, placed ahead of any real D2.
async function stubBin() {
  const bin = await mkdtemp(path.join(os.tmpdir(), 'stub-d2-bin-'));
  await writeFile(path.join(bin, 'd2'), `#!/bin/sh\nexec "${process.execPath}" "${stub}" "$@"\n`);
  await chmod(path.join(bin, 'd2'), 0o755);
  return bin;
}

function entry({ slide, title = `Diagram ${slide}`, filename = `images/diagram-${slide}.svg`, d2 = 'a: Start {class: base}\nb: End {class: base}\na -> b: next {class: flow}' }) {
  const lines = [`## Slide ${slide} — ${title}`, '- **Message:** A message.', '- **Show:** A relationship.', '- **Takeaway:** A takeaway.'];
  if (filename !== null) lines.push(`- **Filename:** \`${filename}\``);
  if (d2 !== null) lines.push('- **D2 Source:**', '  ```d2', ...d2.split('\n').map((line) => `  ${line}`), '  ```');
  return lines.join('\n');
}

async function project({ theme = 'editorial', entries = [entry({ slide: 1 }), entry({ slide: 2 })], manifest = (value) => value } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'render-diagrams-'));
  await writeFile(path.join(directory, 'DISCOVERY.json'), JSON.stringify({ theme: { id: theme } }));
  await writeFile(path.join(directory, 'PROJECT.json'), `${JSON.stringify({ projectType: 'presentation', phases: { diagrams: { status: 'pending' } } }, null, 2)}\n`);
  await cp(path.join(installedThemes, theme), path.join(directory, 'themes', theme), { recursive: true });
  const manifestPath = path.join(directory, 'themes', theme, 'theme.json');
  const locked = manifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  await writeFile(manifestPath, JSON.stringify(locked, null, 2));
  await writeFile(path.join(directory, 'themes', 'theme-lock.json'), JSON.stringify({ lockVersion: 1, id: theme, packageVersion: locked.packageVersion, markupVersion: 1, files: {} }));
  await writeFile(path.join(directory, 'DIAGRAM_SPEC.md'), `# Diagram Spec\n\n${entries.join('\n\n')}\n`);
  return directory;
}

// Runs the public command; resolves with exit code and combined output.
function render(directory, args = [], { bin, env = {}, onSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, path.join(directory, 'DIAGRAM_SPEC.md'), ...args], {
      env: { ...process.env, PATH: bin ? `${bin}${path.delimiter}${process.env.PATH}` : process.env.PATH, ...env },
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, output }));
    onSpawn?.(child);
  });
}

async function svgFiles(directory) {
  const images = path.join(directory, 'images');
  return existsSync(images) ? (await readdir(images)).sort() : [];
}

test('a clean Diagram Spec renders every diagram with one command', async () => {
  const bin = await stubBin();
  const directory = await project();

  const result = await render(directory, [], { bin });

  assert.equal(result.code, 0, result.output);
  assert.deepEqual(await svgFiles(directory), ['diagram-1.svg', 'diagram-2.svg']);
  for (const file of await svgFiles(directory)) {
    const svg = await readFile(path.join(directory, 'images', file), 'utf8');
    assert.match(svg, /<svg\b[^>]*\sviewBox="0 0 600 300"/);
  }
});

test('existing diagrams are skipped by default and re-rendered with --force', async () => {
  const bin = await stubBin();
  const directory = await project();
  await mkdir(path.join(directory, 'images'));
  await writeFile(path.join(directory, 'images', 'diagram-1.svg'), 'kept');

  const missingOnly = await render(directory, [], { bin });
  assert.equal(missingOnly.code, 0, missingOnly.output);
  assert.equal(await readFile(path.join(directory, 'images', 'diagram-1.svg'), 'utf8'), 'kept');
  assert.match(await readFile(path.join(directory, 'images', 'diagram-2.svg'), 'utf8'), /viewBox/);

  const forced = await render(directory, ['--force'], { bin });
  assert.equal(forced.code, 0, forced.output);
  assert.match(await readFile(path.join(directory, 'images', 'diagram-1.svg'), 'utf8'), /viewBox/);
});

test('--slides and --slide select only the named entries', async () => {
  const bin = await stubBin();
  const directory = await project({ entries: [1, 2, 3].map((slide) => entry({ slide })) });

  assert.equal((await render(directory, ['--slides=1,3'], { bin })).code, 0);
  assert.deepEqual(await svgFiles(directory), ['diagram-1.svg', 'diagram-3.svg']);

  assert.equal((await render(directory, ['--slide=2'], { bin })).code, 0);
  assert.deepEqual(await svgFiles(directory), ['diagram-1.svg', 'diagram-2.svg', 'diagram-3.svg']);
});

test('every malformed entry is reported together with its slide and nothing is written', async () => {
  const bin = await stubBin();
  const directory = await project({
    entries: [entry({ slide: 1 }), entry({ slide: 4, filename: null }), entry({ slide: 6, d2: null })],
  });

  const result = await render(directory, [], { bin });

  assert.equal(result.code, 1);
  assert.match(result.output, /Slide 4\b.*Filename/);
  assert.match(result.output, /Slide 6\b.*D2 block/);
  assert.deepEqual(await svgFiles(directory), []);
});

test('one invalid D2 block prevents every write', async () => {
  const bin = await stubBin();
  const directory = await project({
    entries: [entry({ slide: 1 }), entry({ slide: 2, d2: 'a -> b {class: flow} # stub-invalid' }), entry({ slide: 3 })],
  });

  const result = await render(directory, [], { bin });

  assert.equal(result.code, 1);
  assert.match(result.output, /Slide 2\b.*unexpected token/);
  assert.deepEqual(await svgFiles(directory), []);
});

test('a render failure on one entry keeps the others and exits 1', async () => {
  const bin = await stubBin();
  const directory = await project({
    entries: [
      entry({ slide: 1 }),
      entry({ slide: 2, d2: 'a -> b {class: flow} # stub-render-fail' }),
      entry({ slide: 3, d2: 'a -> b {class: flow} # stub-not-svg' }),
      entry({ slide: 4, d2: 'a -> b {class: flow} # stub-no-viewbox' }),
      entry({ slide: 5 }),
    ],
  });
  const before = await readFile(path.join(directory, 'PROJECT.json'), 'utf8');

  const result = await render(directory, [], { bin });

  assert.equal(result.code, 1);
  assert.deepEqual(await svgFiles(directory), ['diagram-1.svg', 'diagram-5.svg']);
  assert.match(result.output, /Slide 2\b.*failed to layout/);
  assert.match(result.output, /Slide 3\b.*root element is not <svg>/);
  assert.match(result.output, /Slide 4\b.*no viewBox/);
  assert.equal(await readFile(path.join(directory, 'PROJECT.json'), 'utf8'), before);
});

test('no temporary file remains after success or failure', async () => {
  const bin = await stubBin();
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'render-diagrams-tmpdir-'));
  const directory = await project({
    entries: [entry({ slide: 1 }), entry({ slide: 2, d2: 'a -> b {class: flow} # stub-not-svg' })],
  });

  await render(directory, [], { bin, env: { TMPDIR: tmp } });

  assert.deepEqual(await svgFiles(directory), ['diagram-1.svg']);
  assert.deepEqual(await readdir(tmp), []);
});

test('an interrupted run removes its temporary files', async () => {
  const bin = await stubBin();
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'render-diagrams-tmpdir-'));
  const directory = await project({ entries: [entry({ slide: 1 }), entry({ slide: 2, d2: 'a -> b {class: flow} # stub-hang' })] });

  const result = await render(directory, [], {
    bin,
    env: { TMPDIR: tmp },
    onSpawn: (child) => {
      const poll = setInterval(async () => {
        if ((await svgFiles(directory)).some((file) => file.startsWith('.diagram-2.svg.'))) {
          clearInterval(poll);
          child.kill('SIGINT');
        }
      }, 25);
    },
  });

  assert.equal(result.code, 130, result.output);
  assert.deepEqual(await svgFiles(directory), ['diagram-1.svg']);
  assert.deepEqual(await readdir(tmp), []);
});

test('usage and prerequisite errors exit 2 without writing', async () => {
  const bin = await stubBin();
  const directory = await project();
  const noD2 = await mkdtemp(path.join(os.tmpdir(), 'no-d2-'));

  assert.equal((await render(directory, ['--slide=9'], { bin })).code, 2);
  assert.equal((await render(directory, ['--bogus'], { bin })).code, 2);
  const missing = await render(directory, [], { env: { PATH: noD2 } });
  assert.equal(missing.code, 2);
  assert.match(missing.output, /d2 is not available/);
  assert.deepEqual(await svgFiles(directory), []);
});

test('the D2 theme follows the locked manifest diagram tone', async () => {
  for (const [theme, expected] of [['editorial', '--theme=0'], ['signal', '--theme=200']]) {
    const bin = await stubBin();
    const log = path.join(bin, 'calls.jsonl');
    const directory = await project({ theme, entries: [entry({ slide: 1 })] });

    assert.equal((await render(directory, [], { bin, env: { STUB_D2_LOG: log } })).code, 0);

    const calls = (await readFile(log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    const renderCall = calls.find((args) => args.includes('--layout=elk'));
    assert.ok(renderCall.includes(expected), `${theme}: ${renderCall}`);
    assert.ok(!renderCall.some((arg) => arg.startsWith('--dark-theme')));
  }
});
