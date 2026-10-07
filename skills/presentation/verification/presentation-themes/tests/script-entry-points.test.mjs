// Bundled scripts must run as commands from wherever they are reached, and the
// Restart Guards' invalidation plan must be printable without an inline program.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { presentationThemeInvalidationPlan } from '../../../discover-presentation/scripts/presentation-theme-invalidation.mjs';

const repositoryDirectory = path.resolve(process.cwd(), '../../../..');
const suite = path.join(repositoryDirectory, 'skills/presentation');

const INVALIDATION_SCRIPTS = [
  'discover-presentation/scripts/presentation-theme-invalidation.mjs',
  'generate-slides/scripts/presentation-theme-invalidation.mjs',
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('scripts still run when reached through a symlinked path', async (t) => {
  // macOS mktemp paths (/var -> /private/var) and symlinked skill installs both
  // reach the scripts through a symlink; a script that fails to recognise it is
  // the main module exits 0 having done nothing.
  const directory = await mkdtemp(path.join(os.tmpdir(), 'symlinked-suite-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const link = path.join(directory, 'suite');
  await symlink(suite, link);
  const missing = path.join(directory, 'no-such-project');
  const cases = [
    ['node', ['generate-slides/scripts/prepare-theme.mjs', missing]],
    ['node', ['presentation-validation/scripts/presentation-validation.mjs', 'check', 'structure', '--project-dir', missing, '--profile', 'generation']],
    ['presentation-validation/scripts/presentation-validation', ['check', 'structure', '--project-dir', missing, '--profile', 'generation']],
    ...INVALIDATION_SCRIPTS.map((script) => ['node', [script]]),
  ];
  for (const [command, args] of cases) {
    const resolved = command === 'node' ? ['node', [path.join(link, args[0]), ...args.slice(1)]] : [path.join(link, command), args];
    const { code, stdout, stderr } = await run(...resolved);
    const label = command === 'node' ? args[0] : command;
    assert.notEqual(code, 0, `${label} exited 0: ${stdout}${stderr}`);
    assert.ok(`${stdout}${stderr}`.trim(), `${label} printed nothing`);
  }
});

test('the invalidation scripts print the plan for a Project Folder as JSON', async (t) => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'invalidation-cli-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const discovery = { paths: { presentation: 'TALK.md', html: 'TALK.html', pdf: 'TALK.pdf' } };
  await writeFile(path.join(project, 'DISCOVERY.json'), JSON.stringify(discovery));

  for (const script of INVALIDATION_SCRIPTS) {
    for (const change of ['theme', 'font', 'refresh']) {
      const { code, stdout, stderr } = await run('node', [path.join(suite, script), project, `--change=${change}`]);
      assert.equal(code, 0, `${script} --change=${change}: ${stderr}`);
      assert.deepEqual(JSON.parse(stdout), presentationThemeInvalidationPlan({ change, discovery }), `${script} --change=${change}`);
    }

    for (const args of [[project], [`--change=theme`], [project, '--change=theme', '--force'], [project, 'extra', '--change=theme']]) {
      const { code, stderr } = await run('node', [path.join(suite, script), ...args]);
      assert.equal(code, 2, `${script} ${args.join(' ')}`);
      assert.match(stderr, /Usage: presentation-theme-invalidation\.mjs/);
    }
  }
});
