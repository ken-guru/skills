// Shared tool-cache conventions. Every skill that installs tools carries an
// identical copy of this file (a CI test keeps the copies in sync), so each
// skill still works when installed alone.
//
// Lookup order for a tool: its environment variable, then the shared cache,
// then PATH. Renders only read; `setup` is the only command that downloads.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const CACHE_ENV = 'KEN_GURU_SKILLS_CACHE';

export function cacheRoot(env = process.env) {
  if (env[CACHE_ENV]) return path.resolve(env[CACHE_ENV]);
  const base = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'ken-guru-skills');
}

// Platform keys match the pin tables: linux-x64, linux-arm64, darwin-x64, darwin-arm64.
export function platformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

export function onPath(command, env = process.env) {
  for (const directory of (env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// tool: { envVar, cachePath: (root) => string, command }
export function resolveTool(tool, env = process.env) {
  const fromEnv = env[tool.envVar];
  if (fromEnv) return existsSync(fromEnv) ? { path: fromEnv, source: tool.envVar } : { path: null, source: tool.envVar, missing: fromEnv };
  const cached = tool.cachePath(cacheRoot(env));
  if (existsSync(cached)) return { path: cached, source: 'cache' };
  const found = tool.command ? onPath(tool.command, env) : null;
  if (found) return { path: found, source: 'PATH' };
  return { path: null, source: null };
}

export function missingToolMessage(toolName, resolution, setupCommand) {
  if (resolution.missing) return `${toolName} not found at ${resolution.missing} (from ${resolution.source}). Fix or unset ${resolution.source}, or run once, outside the sandbox: ${setupCommand}`;
  return `${toolName} is not installed. Run once, outside the sandbox: ${setupCommand}`;
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function downloadVerified(url, expectedSha256, destination, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Download failed (${response.status} ${response.statusText}): ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = sha256(buffer);
  if (actual !== expectedSha256) {
    throw new Error(`Checksum mismatch for ${url}: expected ${expectedSha256}, got ${actual}. Nothing was installed.`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.part`;
  await writeFile(temporary, buffer);
  await rename(temporary, destination);
  return destination;
}

export function extractArchive(archive, directory) {
  const result = archive.endsWith('.zip')
    ? spawnSync('unzip', ['-q', '-o', archive, '-d', directory], { encoding: 'utf8' })
    : spawnSync('tar', ['-xzf', archive, '-C', directory], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    const tool = archive.endsWith('.zip') ? 'unzip' : 'tar';
    throw new Error(`${tool} is needed to unpack ${path.basename(archive)}. Install it with your package manager, then rerun setup.`);
  }
  if (result.status !== 0) throw new Error(`Could not unpack ${path.basename(archive)}: ${(result.stderr || result.stdout).trim()}`);
}

// Downloads, verifies, and unpacks one pinned archive into its versioned cache
// directory, then marks the binary executable. Already-installed pins are kept.
export async function installPinned({ name, url, sha256: expected, installDirectory, binaryPath }, log = console.log) {
  if (existsSync(binaryPath)) {
    log(`✅ ${name} already installed at ${binaryPath}`);
    return binaryPath;
  }
  const staging = `${installDirectory}.${process.pid}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    const archive = path.join(staging, path.basename(new URL(url).pathname));
    log(`⬇️  Downloading ${name} from ${url}`);
    await downloadVerified(url, expected, archive);
    extractArchive(archive, staging);
    await rm(archive, { force: true });
    await rm(installDirectory, { recursive: true, force: true });
    await mkdir(path.dirname(installDirectory), { recursive: true });
    await rename(staging, installDirectory);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  if (!existsSync(binaryPath)) throw new Error(`${name} unpacked, but ${binaryPath} is missing. The pinned archive layout may have changed.`);
  await chmod(binaryPath, 0o755);
  log(`✅ ${name} installed at ${binaryPath} (checksum verified)`);
  return binaryPath;
}
