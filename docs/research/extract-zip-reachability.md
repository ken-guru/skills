# extract-zip reachability and fix options (ken-guru/skills#532)

Scope: `skills/presentation/rendering-slides/` and its pinned Marp CLI lockfile at
`skills/presentation/rendering-slides/scripts/marp-cli/package-lock.json`.
Dependabot alerts: #18 (GHSA-jmr9-qjv8-65gv, CVE-2026-56876) and #23 (GHSA-7pqw-9j4j-h8q3, CVE-2026-19693).
Both alerts are open, scope runtime, manifest path above, vulnerable range `<= 2.0.1`, no patched version listed.

## Dependency path (verified in the lockfile)

- `@marp-team/marp-cli` 4.5.1 depends on `puppeteer-core` `^24.43.1` (lockfile line 115).
- The lockfile resolves `puppeteer-core` 24.43.1, which depends on `@puppeteer/browsers` `2.13.2` (line 1361).
- `@puppeteer/browsers` 2.13.2 depends on `extract-zip` `^2.0.1` (line 188), resolved to `extract-zip` 2.0.1 (line 749).

## Question 1: Does any code path we run call archive extraction on an archive we did not pin?

**Answer: No, not on any path we exercise. Verified by reading the packed npm sources, not by running a render.**

- `extract-zip` is loaded only via dynamic import inside `unpackArchive()` in `@puppeteer/browsers`, for `.zip` files:
  `lib/esm/fileUtil.js` lines 20-22 of `@puppeteer/browsers` 2.13.2 (npm tarball `puppeteer-browsers-2.13.2.tgz`).
- `unpackArchive()` is called only from `install()` in `lib/esm/install.js` (line 222), which downloads a URL and then unpacks it.
- `puppeteer-core` 24.43.1 imports from `@puppeteer/browsers` only `Browser`, `resolveBuildId`, `detectBrowserPlatform`, `getInstalledBrowsers`, `uninstall`, and `computeSystemExecutablePath` (`lib/esm/puppeteer/node/PuppeteerNode.js` line 6; `ChromeLauncher.js` line 9). It does not import `install`, and no `puppeteer-core` file mentions `extract-zip` or `unpackArchive`.
- `@marp-team/marp-cli` 4.5.1 contains no reference to `extract-zip`, `unpackArchive`, or `@puppeteer/browsers` apart from its `package.json` dependency list.
- In our code, `checks.mjs` (line 342-349) calls `puppeteer.launch({ executablePath })` with a browser we already resolved, which does not download anything.
- The only download-and-unpack in our own code is `installPinned()` in `skills/presentation/rendering-slides/scripts/tools.mjs` (lines 85-108). It uses a pinned URL with a SHA-256 check, then `unzip` or `tar` through `spawnSync` (lines 72-80), not `extract-zip`.
- Marp CLI and `setup` run `npm ci --ignore-scripts` against the committed lockfile (`rendering-slides.mjs` line 169). That installs `extract-zip` into the cache, but nothing calls it.

Caveat: this is a source-reading result. I did not run `setup` or a render with instrumentation to confirm that `extract-zip` is never loaded.

## Question 2: Can a malicious symlink entry reach the vulnerable path through deck, config, or theme input?

**Answer: Not through any input the skill accepts, as far as the code shows.**

- The vulnerable code runs only inside `@puppeteer/browsers` `install()` on a downloaded `.zip`. The skill's inputs are Markdown deck files (`deck.md`), `theme.css`, `marp.config.json`, and image assets (`skills/presentation/rendering-slides/scripts/rendering-slides.mjs`, `deck.mjs`, `checks.mjs`). None of them is an archive that gets unpacked.
- Marp CLI does not read archives as input. The only bundled files that mention "zip" are `pdf-lib` and `pptxgen` (`marp-team/marp-cli` 4.5.1 `lib/`), which write PDF and PPTX output (PPTX is a zip container). Neither is an archive extractor, and neither is `extract-zip`.
- The archive fetched by `installPinned()` is hard-coded to a `storage.googleapis.com/chrome-for-testing-public/` URL with a pinned SHA-256 (`rendering-slides.mjs` lines 26-33 and 155-160). Its extraction uses the system `unzip`. Whether system `unzip` has its own symlink behavior was not checked here, and it is outside this ticket. The checksum is verified before extraction.

## Question 3: Is there a fixed release, maintained fork, or documented workaround?

**Answer: No fixed `extract-zip` release, and no patched version is listed in either advisory. The upstream fix is an unmerged PR. The practical fix is to stop depending on `extract-zip` through `@puppeteer/browsers` 2.x, but no version of our pinned toolchain does that today.**

- No fixed `extract-zip` release. `npm view extract-zip` shows `2.0.1` as latest, last published 2020-06-10 (GitHub release `v2.0.1`). Both GHSAs list `first_patched_version: null` with range `<= 2.0.1`: https://github.com/advisories/GHSA-jmr9-qjv8-65gv and https://github.com/advisories/GHSA-7pqw-9j4j-h8q3.
- Upstream PR open and unmerged: https://github.com/max-mapper/extract-zip/pull/160 ("fix: reject writes through a symlink at the entry's final path component (CVE-2026-19693)"), state `open` as of the check. I did not read the diff.
- Upstream repo state: `max-mapper/extract-zip` is not archived, and its last commit is the 2.0.1 release (GitHub API). It has no newer release.
- Maintained fork: not verified. I did not search for forks.
- Dependency that drops `extract-zip`: `@puppeteer/browsers` 3.0.0 was published 2026-05-12 (npm `time`). `@puppeteer/browsers` 3.2.4 depends only on `yargs` and `modern-tar` (npm `view`). The 2.x line's last release is 2.13.2, which still depends on `extract-zip`.
- Path to the 3.x line is blocked for us. `puppeteer-core` 25.13.0 uses `@puppeteer/browsers` 3.2.4. But `@marp-team/marp-cli` 4.5.1 (the latest marp-cli) pins `puppeteer-core` `^24.43.1`, which resolves only to 2.x `@puppeteer/browsers`. Moving to the 3.x line needs either a newer marp-cli release or an npm `overrides` entry in the lockfile. Neither was tested. Compatibility of `puppeteer-core` 24.x with `@puppeteer/browsers` 3.x was not verified.
- Workaround with no version change: none verified. Since `extract-zip` is never reached by our code, the dependency is a supply-chain alert, not a demonstrated exploit path in this skill. Dismissing the alerts as "not reachable" is supported by Question 1, but that is a decision for the owner.

## Open items

- Confirm at runtime (instrumented `setup` and render) that `extract-zip` is never loaded. Not done.
- Test an npm `overrides` entry pinning `@puppeteer/browsers` to `^3` under `puppeteer-core` 24.x, or wait for a marp-cli release on newer puppeteer. Not done.
- Read the diff of max-mapper/extract-zip PR #160 and look for maintained forks. Not done.
