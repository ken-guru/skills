#!/usr/bin/env node
// rendering-slides: install Marp CLI and a pinned browser, apply a theme, and render a Deck Folder.
//
//   node scripts/rendering-slides.mjs setup [--status]
//   node scripts/rendering-slides.mjs theme --deck <folder> --name editorial|editorial-inverse
//   node scripts/rendering-slides.mjs theme-values --deck <folder>
//   node scripts/rendering-slides.mjs render --deck <folder> [--pptx] [--images]
//
// Exit codes: 0 success; 1 the render or a check failed; 2 usage, prerequisite, or internal error.

import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheRoot, installPinned, missingToolMessage, onPath, platformKey } from './tools.mjs';
import { parseDeck } from './deck.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETUP_COMMAND = 'node scripts/rendering-slides.mjs setup';

// Chrome for Testing publishes no checksums; these are SHA-256 of the archives as downloaded.
const CHROME_VERSION = '155.0.8059.39';
const CHROME_PINS = {
  'linux-x64': ['linux64', '39dcb8c46550632a3d911850ab3b8af840b4e3f6d8622faa2018eb8756278786'],
  'linux-arm64': ['linux-arm64', '9fb86f7c0b2734c5febc0bbb4e85f37da43553f3f8a7970949828c5713e87e94'],
  'darwin-x64': ['mac-x64', '6338a784c691f42dd1ed6aeeef650171c7d72cf74bdb8450d0079864e72a8074'],
  'darwin-arm64': ['mac-arm64', 'b3e093c06001c41e68decbc8dd4a62f9efe4bf4e4dd247a686ea531863448d75'],
};
const MARP_VERSION = '4.5.1';
// Installed browsers tried when no pinned shell is available, in order.
const INSTALLED_BROWSERS = {
  commands: ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
};
const THEMES = ['editorial', 'editorial-inverse'];
// Marp renders a slow deck in seconds; this only stops a hung browser.
const RENDER_TIMEOUT_MS = 300_000;

class UsageError extends Error {}
class RenderError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!['setup', 'theme', 'theme-values', 'render'].includes(command)) throw new UsageError(`Unknown command "${command ?? ''}". Use setup, theme, theme-values, or render.`);
  const options = { command, deck: null, name: null, pptx: false, images: false, status: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new UsageError(`${argument} needs a value.`);
      index += 1;
      return next;
    };
    if (argument === '--deck') options.deck = path.resolve(value());
    else if (argument === '--name') options.name = value();
    else if (argument === '--pptx') options.pptx = true;
    else if (argument === '--images') options.images = true;
    else if (argument === '--status') options.status = true;
    else throw new UsageError(`Unknown option ${argument}.`);
  }
  if (command !== 'setup' && !options.deck) throw new UsageError(`${command} needs --deck <Deck Folder>.`);
  if (command === 'theme' && !THEMES.includes(options.name)) throw new UsageError(`theme needs --name ${THEMES.join(' or ')}.`);
  return options;
}

// ── Tools ────────────────────────────────────────────────────────────────────

const chromeDirectory = (root) => path.join(root, 'chrome-headless-shell', CHROME_VERSION);
const chromeBinary = (root, platform) => path.join(chromeDirectory(root), `chrome-headless-shell-${platform}`, 'chrome-headless-shell');
const marpDirectory = (root) => path.join(root, 'marp-cli', MARP_VERSION);
const marpScript = (root) => path.join(marpDirectory(root), 'node_modules', '@marp-team', 'marp-cli', 'marp-cli.js');

function resolveBrowser(env = process.env) {
  if (env.CHROME_PATH) return existsSync(env.CHROME_PATH) ? { path: env.CHROME_PATH, source: 'CHROME_PATH' } : { path: null, source: 'CHROME_PATH', missing: env.CHROME_PATH };
  const pin = CHROME_PINS[platformKey()];
  if (pin && existsSync(chromeBinary(cacheRoot(env), pin[0]))) return { path: chromeBinary(cacheRoot(env), pin[0]), source: 'cache' };
  for (const command of INSTALLED_BROWSERS.commands) {
    const found = onPath(command, env);
    if (found) return { path: found, source: 'installed browser' };
  }
  if (process.platform === 'darwin') {
    for (const candidate of INSTALLED_BROWSERS.darwin) if (existsSync(candidate)) return { path: candidate, source: 'installed browser' };
  }
  return { path: null, source: null };
}

function resolveMarp(env = process.env) {
  if (env.MARP_CLI_PATH) return existsSync(env.MARP_CLI_PATH) ? { path: env.MARP_CLI_PATH, source: 'MARP_CLI_PATH' } : { path: null, source: 'MARP_CLI_PATH', missing: env.MARP_CLI_PATH };
  if (existsSync(marpScript(cacheRoot(env)))) return { path: marpScript(cacheRoot(env)), source: 'cache' };
  const found = onPath('marp', env);
  return found ? { path: found, source: 'PATH' } : { path: null, source: null };
}

function missingLinuxLibraries(binary) {
  if (process.platform !== 'linux') return [];
  const result = spawnSync('ldd', [binary], { encoding: 'utf8' });
  if (result.error) return [];
  return [...result.stdout.matchAll(/^\s*(\S+) => not found/gm)].map((match) => match[1]);
}

async function linuxDependencyAdvice(binary) {
  const missing = missingLinuxLibraries(binary);
  if (!missing.length) return null;
  const debDeps = path.join(path.dirname(binary), 'deb.deps');
  const packages = existsSync(debDeps) ? (await readFile(debDeps, 'utf8')).split(/\s+/).filter(Boolean) : [];
  const install = packages.length
    ? `sudo apt-get install -y ${packages.join(' ')}`
    : '(no package list shipped; install the libraries above with your package manager)';
  return `The browser is missing ${missing.length} system librar${missing.length === 1 ? 'y' : 'ies'} (${missing.join(', ')}). Ask the person to install them once; this skill never runs sudo:\n   ${install}\n   On Fedora or RHEL, install the equivalent packages with dnf.`;
}

async function setup(options) {
  const browser = resolveBrowser();
  const marp = resolveMarp();
  if (options.status) {
    const lines = [];
    let ok = true;
    if (marp.path) lines.push(`✅ Marp CLI at ${marp.path} (from ${marp.source})`);
    else { ok = false; lines.push(`❌ ${missingToolMessage('Marp CLI', marp, SETUP_COMMAND)}`); }
    if (browser.path) {
      lines.push(`✅ Browser at ${browser.path} (from ${browser.source})`);
      const advice = await linuxDependencyAdvice(browser.path);
      if (advice) { ok = false; lines.push(`❌ ${advice}`); }
    } else { ok = false; lines.push(`❌ ${missingToolMessage('A browser for PDF export', browser, SETUP_COMMAND)}`); }
    console.log(lines.join('\n'));
    return ok ? 0 : 1;
  }

  const root = cacheRoot();
  const pin = CHROME_PINS[platformKey()];
  if (!pin) throw new UsageError(`No pinned chrome-headless-shell for ${platformKey()}. Install Chrome or Chromium and set CHROME_PATH.`);
  const [platform, digest] = pin;
  const binary = await installPinned({
    name: `chrome-headless-shell ${CHROME_VERSION}`,
    url: `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/${platform}/chrome-headless-shell-${platform}.zip`,
    sha256: digest,
    installDirectory: chromeDirectory(root),
    binaryPath: chromeBinary(root, platform),
  });

  if (existsSync(marpScript(root))) console.log(`✅ Marp CLI ${MARP_VERSION} already installed at ${marpScript(root)}`);
  else {
    const directory = marpDirectory(root);
    await mkdir(directory, { recursive: true });
    for (const file of ['package.json', 'package-lock.json']) await copyFile(path.join(SKILL, 'scripts', 'marp-cli', file), path.join(directory, file));
    console.log(`⬇️  Installing Marp CLI ${MARP_VERSION} from the pinned lockfile (npm verifies every package's integrity)`);
    const npm = spawnSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: directory, encoding: 'utf8' });
    if (npm.error?.code === 'ENOENT') throw new UsageError('npm is needed to install Marp CLI. Install Node.js (which includes npm), then rerun setup.');
    if (npm.status !== 0) {
      await rm(path.join(directory, 'node_modules'), { recursive: true, force: true });
      throw new UsageError(`npm could not install Marp CLI:\n${(npm.stderr || npm.stdout).trim()}`);
    }
    console.log(`✅ Marp CLI ${MARP_VERSION} installed at ${marpScript(root)}`);
  }

  const advice = await linuxDependencyAdvice(binary);
  if (advice) {
    console.log(`⚠️  ${advice}`);
    return 1;
  }
  return 0;
}

// ── Themes ───────────────────────────────────────────────────────────────────

async function readTheme(name) {
  const file = path.join(SKILL, 'themes', `${name}.css`);
  if (!existsSync(file)) throw new UsageError(`No shipped theme "${name}".`);
  return readFile(file, 'utf8');
}

// Marp themes may import another theme by name; a Deck Folder holds one
// self-contained file, so imported shipped themes are inlined.
export async function flattenTheme(css) {
  const body = css.replace(/^\/\*\s*@theme\s+[\w-]+\s*\*\/\s*/m, '');
  const imports = [...body.matchAll(/^@import\s+["']([\w-]+)["'];\s*$/gm)].map((match) => match[1]).filter((name) => THEMES.includes(name));
  let flattened = body;
  for (const name of imports) {
    const base = await flattenTheme(await readTheme(name));
    flattened = flattened.replace(new RegExp(`^@import\\s+["']${name}["'];\\s*$`, 'm'), base.replace(/^@import\s+["']default["'];\s*$/m, ''));
  }
  return flattened;
}

async function applyTheme(options) {
  const css = await flattenTheme(await readTheme(options.name));
  await mkdir(options.deck, { recursive: true });
  const content = `/* @theme deck */\n/* Copied from rendering-slides' ${options.name} theme. Edit the values on :root to adjust the look; render again to see the change. */\n${css.startsWith('@import "default"') ? '' : '@import "default";\n'}${css.replace(/^@import\s+["']default["'];\s*$/gm, '')}`;
  await writeFile(path.join(options.deck, 'theme.css'), content.replace(/\n{3,}/g, '\n\n'));
  console.log(`✅ ${path.join(options.deck, 'theme.css')} now holds the ${options.name} theme. Set \`theme: deck\` in deck.md's front matter.`);
  return 0;
}

export function themeValuesFrom(css) {
  const values = {};
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const declaration of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) values[declaration[1]] = declaration[2].trim();
  }
  return values;
}

async function themeValues(options) {
  const file = path.join(options.deck, 'theme.css');
  if (!existsSync(file)) throw new UsageError(`${file} not found. Run \`node scripts/rendering-slides.mjs theme --deck ${options.deck} --name editorial\` first.`);
  process.stdout.write(`${JSON.stringify(themeValuesFrom(await readFile(file, 'utf8')), null, 2)}\n`);
  return 0;
}

// ── Rendering ────────────────────────────────────────────────────────────────

const SANDBOX_SIGNATURES = [
  { pattern: /bootstrap_check_in|MachPortRendezvousServer/, where: 'the macOS sandbox of your coding agent (Codex or Claude Code) stops Chromium from starting' },
  { pattern: /sandbox_host_linux\.cc|shutdown\(\) failed|Operation not permitted.*shutdown/i, where: 'the Linux sandbox (Codex with network access off) stops Chromium from shutting down' },
  { pattern: /EROFS|read-only file system/i, where: 'the sandbox makes your home directory read-only' },
];

function sandboxAdvice(output) {
  const match = SANDBOX_SIGNATURES.find(({ pattern }) => pattern.test(output));
  if (!match) return null;
  return [
    `The browser could not run because ${match.where}.`,
    'Run this one render command outside the sandbox. Allow it once for this exact command; never turn the sandbox off entirely:',
    '   • Claude Code: approve running the command without the sandbox when asked, or add it to the sandbox exclusions in your settings (https://code.claude.com/docs/en/sandboxing).',
    '   • Codex: approve the escalation, or add a prefix rule for `node <skill folder>/scripts/rendering-slides.mjs render` (https://developers.openai.com/codex/security).',
    '   • Copilot CLI: its sandbox is off unless you enabled it; if you did, allow this command for the session.',
  ].join('\n');
}

function marp(marpPath, args, browser, deckFolder) {
  const isScript = marpPath.endsWith('.js');
  const result = spawnSync(isScript ? process.execPath : marpPath, isScript ? [marpPath, ...args] : args, {
    cwd: deckFolder,
    encoding: 'utf8',
    timeout: RENDER_TIMEOUT_MS,
    // CHROME_PATH pins the browser; MARP_USER keeps Marp's temp files out of
    // $HOME, which sandboxes make read-only.
    env: { ...process.env, CHROME_PATH: browser, MARP_USER: process.env.MARP_USER || 'rendering-slides' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw new RenderError(`Marp did not finish: ${result.error.message}`);
  if (result.status !== 0) {
    const advice = sandboxAdvice(output);
    throw new RenderError(advice ?? `Marp failed:\n${output.trim()}`);
  }
  return output;
}

export function notesScript(deck) {
  const lines = [`# Speaker notes: ${deck.title ?? 'Untitled deck'}`, ''];
  deck.slides.forEach((slide, index) => {
    lines.push(`## ${index + 1}. ${slide.heading ?? '(no heading)'}`, '');
    lines.push(slide.notes.length ? slide.notes.join('\n\n') : '_No notes._', '');
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

async function render(options) {
  const deckPath = path.join(options.deck, 'deck.md');
  const themePath = path.join(options.deck, 'theme.css');
  if (!existsSync(deckPath)) throw new UsageError(`${deckPath} not found. A Deck Folder holds deck.md; drafting-slides writes it.`);
  if (!existsSync(themePath)) throw new UsageError(`${themePath} not found. Run \`node scripts/rendering-slides.mjs theme --deck ${options.deck} --name editorial\` (or editorial-inverse), then render again.`);

  const marpTool = resolveMarp();
  const browser = resolveBrowser();
  if (!marpTool.path) throw new UsageError(missingToolMessage('Marp CLI', marpTool, SETUP_COMMAND));
  if (!browser.path) throw new UsageError(missingToolMessage('A browser for PDF export', browser, SETUP_COMMAND));

  const deck = parseDeck(await readFile(deckPath, 'utf8'));
  if (deck.frontmatter.theme !== 'deck') console.log(`⚠️  deck.md uses theme "${deck.frontmatter.theme ?? '(none)'}"; set \`theme: deck\` so it uses theme.css.`);

  const dist = path.join(options.deck, 'dist');
  await mkdir(dist, { recursive: true });
  const common = ['deck.md', '--theme-set', 'theme.css', '--html', '--allow-local-files', '--no-stdin'];
  marp(marpTool.path, [...common, '-o', path.join('dist', 'deck.html')], browser.path, options.deck);
  marp(marpTool.path, [...common, '--pdf', '--pdf-outlines', '-o', path.join('dist', 'deck.pdf')], browser.path, options.deck);
  await writeFile(path.join(dist, 'deck-notes.md'), notesScript(deck));
  const written = ['dist/deck.html', 'dist/deck.pdf (tagged, with an outline)', 'dist/deck-notes.md'];

  if (options.pptx) {
    marp(marpTool.path, [...common, '--pptx', '-o', path.join('dist', 'deck.pptx')], browser.path, options.deck);
    written.push('dist/deck.pptx (slide pictures: neither editable nor accessible)');
  }
  if (options.images) {
    const slides = path.join(dist, 'slides');
    await rm(slides, { recursive: true, force: true });
    await mkdir(slides, { recursive: true });
    marp(marpTool.path, [...common, '--images', 'png', '-o', path.join('dist', 'slides', 'deck.png')], browser.path, options.deck);
    written.push(`dist/slides/ (${(await readdir(slides)).length} PNG images)`);
  }
  console.log(`✅ Rendered ${deck.slides.length} slides with ${path.basename(browser.path)} (from ${browser.source}):`);
  for (const item of written) console.log(`   • ${item}`);
  return 0;
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.command === 'setup') return setup(options);
  if (options.command === 'theme') return applyTheme(options);
  if (options.command === 'theme-values') return themeValues(options);
  return render(options);
}

// Compare real paths: installers often reach skills through symlinks.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      if (error instanceof RenderError) {
        process.stdout.write(`❌ ${error.message}\n`);
        process.exitCode = 1;
      } else if (error instanceof UsageError) {
        process.stderr.write(`❌ ${error.message}\n`);
        process.exitCode = 2;
      } else {
        process.stderr.write(`❌ ${error.stack ?? error.message}\n`);
        process.exitCode = 2;
      }
    });
}
