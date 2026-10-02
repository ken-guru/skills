// Contracts from the prompt-reduction decisions (Wayfinder map #450): command
// shape and Skill Executables, Media Scope, the Repair Plan, the diagram
// archetype rule, and browser selection for exports.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, constants, mkdtemp, readFile, readdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repositoryDirectory = path.resolve(process.cwd(), '../../../..');
const suite = path.join(repositoryDirectory, 'skills/presentation');

async function read(relativePath) {
  return readFile(path.join(suite, relativePath), 'utf8');
}

// Members that run bundled scripts, each through one Skill Executable.
const EXECUTABLES = {
  'discover-presentation': ['invalidate'],
  'generate-slides': ['check-theme', 'prepare-theme', 'markup', 'invalidate', 'export'],
  'generate-diagrams': ['render', 'check'],
  'generate-images': ['render'],
  'presentation-validation': ['check'],
};

// Setup the human runs in their own shell, not commands the agent runs.
const HUMAN_SETUP = new Set(['README.md', 'docs/permissions.md', 'generate-images/PROVIDERS.md']);

// Agent-facing Markdown: every member's files plus the suite protocols. Research
// notes and decision records quote other shapes on purpose.
async function agentMarkdown() {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'verification', 'research', 'adr', 'tests', 'themes'].includes(entry.name)) continue;
        await walk(full);
      } else if (entry.name.endsWith('.md') && !HUMAN_SETUP.has(path.relative(suite, full))) {
        files.push(full);
      }
    }
  }
  await walk(suite);
  return files;
}

function commandBlocks(markdown) {
  return [...markdown.matchAll(/^\s*```(bash|sh|shell|text)?\s*\n([\s\S]*?)^\s*```/gm)].map((match) => match[2]);
}

test('documented commands run one at a time through a Skill Executable', async () => {
  const problems = [];
  for (const file of await agentMarkdown()) {
    const relative = path.relative(suite, file);
    for (const block of commandBlocks(await readFile(file, 'utf8'))) {
      for (const line of block.split('\n')) {
        const command = line.trim();
        if (/^node\s/.test(command)) problems.push(`${relative}: runs node directly: ${command}`);
        if (/\bnode\s+-e\b/.test(command)) problems.push(`${relative}: inline node program: ${command}`);
        if (/\s&&\s|\s\|\|\s/.test(command)) problems.push(`${relative}: chained command: ${command}`);
        if (/<<-?\s*['"]?\w/.test(command)) problems.push(`${relative}: heredoc input: ${command}`);
        if (/\$\(/.test(command)) problems.push(`${relative}: command substitution: ${command}`);
        if (/^marp\s+\S+\.md\b.*\s-o\s+\S+\.(html|pdf)\b/.test(command)) problems.push(`${relative}: raw Marp export (use generate-slides export): ${command}`);
        if (/^"[^"]*\/scripts\//.test(command)) problems.push(`${relative}: quoted Skill Executable path: ${command}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('each scripted member ships one POSIX Skill Executable that checks for Node.js', async () => {
  for (const [name, subcommands] of Object.entries(EXECUTABLES)) {
    const executable = path.join(suite, name, 'scripts', name);
    await access(executable, constants.X_OK);
    const source = await readFile(executable, 'utf8');
    assert.match(source, /^#!\/bin\/sh\n/, name);
    assert.match(source, /set -eu/, name);
    assert.match(source, /command -v node/, name);
    assert.doesNotMatch(source, /\bdirname\b/, `${name} must not need PATH tools besides node`);
    if (subcommands.length > 1 || name !== 'presentation-validation') {
      for (const subcommand of subcommands) assert.match(source, new RegExp(`^\\s*${subcommand}\\)`, 'm'), `${name} ${subcommand}`);
    }

    const skill = await read(`${name}/SKILL.md`);
    const frontMatter = skill.match(/^---\n([\s\S]*?)\n---/)[1];
    assert.match(frontMatter, new RegExp(`^allowed-tools: Bash\\(\\$\\{CLAUDE_SKILL_DIR\\}/scripts/${name} \\*\\)$`, 'm'), name);
  }
});

test('Skill Executables exit 2 with the fix when Node.js is missing', async () => {
  const empty = await mkdtemp(path.join(os.tmpdir(), 'no-node-'));
  for (const name of Object.keys(EXECUTABLES)) {
    const { code, output } = await new Promise((resolve, reject) => {
      const child = spawn(path.join(suite, name, 'scripts', name), [EXECUTABLES[name][0]], { env: { PATH: empty } });
      let text = '';
      child.stdout.on('data', (chunk) => { text += chunk; });
      child.stderr.on('data', (chunk) => { text += chunk; });
      child.on('error', reject);
      child.on('close', (exit) => resolve({ code: exit, output: text }));
    });
    assert.equal(code, 2, `${name}: ${output}`);
    assert.match(output, /node not installed/, name);
  }
});

test('scripts still run when reached through a symlinked path', async () => {
  // macOS mktemp paths (/var -> /private/var) and symlinked skill installs both
  // reach the scripts through a symlink; a script that fails to recognise it is
  // the main module exits 0 having done nothing.
  const link = path.join(await mkdtemp(path.join(os.tmpdir(), 'symlinked-suite-')), 'suite');
  await symlink(suite, link);
  const missing = path.join(os.tmpdir(), 'no-such-project-for-symlink-test');
  const cases = [
    ['generate-slides/scripts/generate-slides', ['export']],
    ['generate-slides/scripts/generate-slides', ['invalidate']],
    ['generate-slides/scripts/generate-slides', ['prepare-theme', missing]],
    ['discover-presentation/scripts/discover-presentation', ['invalidate']],
    ['presentation-validation/scripts/presentation-validation', ['check', 'structure', '--project-dir', missing, '--profile', 'generation']],
  ];
  for (const [executable, args] of cases) {
    const { code, output } = await new Promise((resolve, reject) => {
      const child = spawn(path.join(link, executable), args);
      let text = '';
      child.stdout.on('data', (chunk) => { text += chunk; });
      child.stderr.on('data', (chunk) => { text += chunk; });
      child.on('error', reject);
      child.on('close', (exit) => resolve({ code: exit, output: text }));
    });
    const label = `${executable} ${args[0]}`;
    assert.notEqual(code, 0, `${label} exited 0: ${output}`);
    assert.ok(output.trim(), `${label} printed nothing`);
  }
});

test('no startup step asks the agent to check for Node.js itself', async () => {
  for (const name of Object.keys(EXECUTABLES)) {
    assert.doesNotMatch(await read(`${name}/SKILL.md`), /which node/, name);
  }
});

test('a named Media Scope skips the menu and the slide numbers come inline', async () => {
  const protocol = await read('MEDIA_RENDERING.md');
  assert.match(protocol, /\*\*Named:\*\*/);
  assert.match(protocol, /Overwriting <file> \(Slide N\)/);
  assert.match(protocol, /only after a\s+bare `C`/);
  for (const renderer of ['generate-diagrams', 'generate-images']) {
    const skill = await read(`${renderer}/SKILL.md`);
    assert.match(skill, /\*\*Named( scope)?:\*\*/, renderer);
    assert.match(skill, /Overwriting images\/foo\.(svg|png) \(Slide N\)/, renderer);
    assert.match(skill, /only after a bare `C`/, renderer);
    assert.match(skill, /approved Repair Plan/, renderer);
    assert.doesNotMatch(skill, /I'll tell you which slide numbers/, renderer);
  }
});

test('the Repair Plan is proposed once and absorbs only the prompts it lists', async () => {
  const protocol = await read('REPAIR_PLAN.md');
  assert.match(protocol, /never answers\s+deleting media, a Theme Package refresh, or Agenda approval/);
  assert.match(protocol, /Repair Plan exceeded: <reason>/);
  assert.match(await read('CONTEXT.md'), /## Repair Plan/);

  for (const proposer of ['proofread-presentation/SKILL.md', 'build-presentation/SKILL.md']) {
    const text = await read(proposer);
    assert.match(text, /propose one\s+Repair Plan/, proposer);
    assert.match(text, /never\s+covers deleting media, a Theme Package refresh, or Agenda approval/, proposer);
    assert.match(text, /lives only in this conversation/, proposer);
    assert.match(text, /Name `generate-diagrams`/, proposer);
  }
  for (const consumer of ['generate-diagrams/SKILL.md', 'generate-images/SKILL.md', 'generate-slides/SKILL.md', 'generate-slides/RESTART-GUARD.md']) {
    const text = await read(consumer);
    assert.match(text, /approved Repair Plan/, consumer);
    assert.match(text, /Repair Plan exceeded: <reason>/, consumer);
  }
  assert.match(await read('generate-slides/RESTART-GUARD.md'), /never answers \*\*Delete generated media too\*\*/);
  assert.match(await read('build-presentation/GIT_CHECKPOINTS.md'), /approved Repair Plan/);
});

test('diagrams stay on the diagram archetype and layouts are checked before they are offered', async () => {
  assert.match(await read('structure-agenda/DRAFT_AGENDA.md'), /Give every Diagram its own Diagram slide/);
  const diagrams = await read('generate-diagrams/SKILL.md');
  assert.match(diagrams, /only place diagram layout options are\s+offered/);
  assert.match(diagrams, /generate-diagrams check <DIAGRAM_SPEC\.md path> --slide=N --candidate=<temp file>/);
  assert.match(diagrams, /Offer only candidates that exit `0`/);
  assert.match(await read('presentation-validation/scripts/presentation-validation.mjs'), /'structure\.diagram-archetype', 'blocking'/);
});

test('exports pick a working browser once and Proofread inherits it', async () => {
  const slides = await read('generate-slides/SKILL.md');
  assert.match(slides, /generate-slides export <project>/);
  assert.match(slides, /markup <project> --check --input=/);
  const proofread = await read('proofread-presentation/SKILL.md');
  assert.match(proofread, /rerun Generate Slides' export to select a working browser/);
  assert.match(proofread, /\.marprc\.yml/);
});

test('each decision has a documented eval', async () => {
  const evals = async (name) => JSON.parse(await read(`${name}/evals/${name}.json`));
  const expect = async (name, pattern) => {
    assert.ok((await evals(name)).some((item) => pattern.test(item.expected)), `${name}: no eval for ${pattern}`);
  };
  await expect('generate-diagrams', /no Media Scope prompt, prints "Overwriting/);
  await expect('generate-diagrams', /Media Scope prompt because the description matches more than one entry/);
  await expect('generate-diagrams', /check --candidate/);
  await expect('generate-images', /one combined question/);
  await expect('generate-images', /without asking which slide numbers/);
  await expect('proofread-presentation', /proposes one Repair Plan/);
  await expect('generate-slides', /without asking the Restart Guard question/);
  await expect('generate-slides', /Repair Plan exceeded/);
  await expect('generate-slides', /generate-slides export/);
  await expect('structure-agenda', /own Diagram slide/);
});
