# Findings: GitHub Copilot CLI install method for the devcontainer

Primary-source research resolving [ken-guru/skills#112](https://github.com/ken-guru/skills/issues/112),
part of the wayfinder map at [ken-guru/skills#109](https://github.com/ken-guru/skills/issues/109).
Question: what is the current, correct, idempotent way to install the GitHub Copilot CLI
(`copilot` binary) in the `setup-devcontainer` skill's Ubuntu devcontainer, matching the shape of
the existing Codex and Antigravity install blocks?

**Repo files read:** `skills/setup-devcontainer/templates/post-create-codex-block.sh`,
`skills/setup-devcontainer/templates/post-create-antigravity-block.sh`,
`skills/setup-devcontainer/templates/post-create-baseline.sh`, `skills/setup-devcontainer/SKILL.md`
(all under this worktree's repo root).

**Important product-naming note confirmed against primary sources:** "GitHub Copilot CLI" (the
subject of this research, repo `github/copilot-cli`, npm package `@github/copilot`) is a **distinct,
current product** from the older `gh-copilot` `gh` extension (repo `github/gh-copilot`, install via
`gh extension install github/gh-copilot`, subcommands `gh copilot suggest`/`gh copilot explain`).
The old extension **stopped working on October 25, 2025** per GitHub's own changelog: "The
[gh-copilot](https://github.com/github/gh-copilot) extension will be deprecated and stop
functioning on October 25, 2025." (https://github.blog/changelog/2025-09-25-upcoming-deprecation-of-gh-copilot-cli-extension/).
Separately, as of a January 2026 GitHub CLI update, `gh copilot` was repurposed as a **native `gh`
subcommand** (not a `gh extension`) that "will prompt to install Copilot CLI when run for the first
time" and then "will execute the Copilot CLI, forwarding any args and flags" — i.e. it's now a
convenience launcher for the very same standalone `copilot` binary this research is about, not a
separate install mechanism (https://github.blog/changelog/2026-01-21-install-and-use-github-copilot-cli-directly-from-the-github-cli/).
So candidate method (c), "a `gh` extension," is **not** how the current product is distributed —
that shape belongs to the retired product.

---

## 1. The exact, current install command(s)

GitHub documents five install methods on the official install page
(https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli),
confirmed word-for-word against the linked `github/copilot-cli` README
(https://github.com/github/copilot-cli) and, for npm, against the live npm registry via `npm view`:

| Method | Command | Platforms |
|---|---|---|
| Install script | `curl -fsSL https://gh.io/copilot-install \| bash` (or `wget -qO- https://gh.io/copilot-install \| bash`) | macOS, Linux |
| npm | `npm install -g @github/copilot` (requires Node.js 22+) | all |
| Homebrew | `brew install --cask copilot-cli` | macOS, Linux |
| WinGet | `winget install GitHub.Copilot` | Windows |
| GitHub Releases | manual download of a per-platform tarball/zip from `github/copilot-cli` releases | all |

**Verified live via `npm view @github/copilot`** (registry, run directly, not guessed):
- Package name: `@github/copilot` (exactly as GitHub's docs and README state — confirmed on
  https://www.npmjs.com/package/@github/copilot).
- `latest` dist-tag: `1.0.82`; `prerelease` dist-tag: `1.0.83-0`.
- `bin`: `{ copilot: 'npm-loader.js' }` — the npm package's `copilot` executable is a small loader
  script, not the real binary; the real per-platform binaries are pulled in as `optionalDependencies`:
  `@github/copilot-{linux,win32,darwin}-{x64,arm64}` and `@github/copilot-linuxmusl-{x64,arm64}`
  (all pinned to `1.0.82`), and `npm-loader.js` dispatches to whichever one matches the host.
- `repository.url`: `git+https://github.com/github/copilot-cli.git` — confirms the npm package and
  the GitHub Releases both come from the same `github/copilot-cli` repo.

**Fetched the actual install script** (`curl -fsSL https://gh.io/copilot-install`, 196 lines, read in
full — this is the single most load-bearing primary source for this research). Key behavior,
quoted/paraphrased from the script itself:
- Detects OS (`Darwin`/`Linux`; falls back to `winget install GitHub.Copilot` if neither, i.e. it's a
  universal entry point) and arch (`x64`/`arm64`).
- Downloads `https://github.com/github/copilot-cli/releases/{latest,download/<tag>}/download/copilot-${PLATFORM}-${ARCH}.tar.gz`
  and, when reachable, `SHA256SUMS.txt` from the same release, validating the download with
  `sha256sum -c --ignore-missing` (or `shasum -a 256`) before extracting — genuine checksum
  verification, not just a bare download-and-run.
- Confirmed live against the GitHub Releases API (`api.github.com/repos/github/copilot-cli/releases/latest`):
  latest release is tag `v1.0.82` (matches the npm `latest` dist-tag exactly), with assets
  `copilot-{darwin,linux,linuxmusl}-{x64,arm64}.tar.gz`, `copilot-win32-{x64,arm64}.zip`, and
  `SHA256SUMS.txt` — matching the script's naming scheme exactly.
- Installs to `$PREFIX/bin/copilot` where `PREFIX` defaults to `/usr/local` when run as root, and
  **`$HOME/.local` when run as a non-root user** — i.e. `~/.local/bin/copilot` by default in exactly
  this devcontainer's non-root `vscode` user setup, matching Codex's (`~/.local/bin/codex`) and
  Antigravity's (`~/.local/bin/agy`) install locations with zero extra configuration needed.
- **The script itself is not idempotent** — it unconditionally re-downloads and overwrites, only
  printing `"Notice: Replacing copilot binary found at $INSTALL_DIR/copilot."` if one already
  exists. Idempotency has to be added at the call site (a pre-check), exactly the same shape as the
  existing Codex/Antigravity blocks already do.
- PATH handling gotcha worth flagging for whoever writes the block: on a fresh install where
  `~/.local/bin` isn't yet on `PATH`, the script tries to append an `export PATH=...` line to a
  shell **login-profile** file (`~/.bash_profile` / `~/.bash_login` / `~/.profile` for bash,
  `~/.zprofile` for zsh) — **not `~/.bashrc`** — and only does so if it detects a controlling
  terminal (`[ -t 0 ] || [ -e /dev/tty ]`, then an actual `read -r REPLY </dev/tty`). In a
  non-interactive `postCreateCommand` context (no controlling tty), this prompt will not fire, so
  the script will neither hang nor modify any rc file — but it also means, unlike Codex's own
  installer (which the repo's comment notes "adds that to `.bashrc`" unconditionally), Copilot's
  installer will **not** put `~/.local/bin` on `PATH` for future interactive shells on its own. If
  `~/.local/bin` isn't already on `PATH` for another reason (e.g. added once when the Codex or
  Antigravity block ran first), a devcontainer author would need to add it explicitly rather than
  relying on this installer to do it, unlike the Codex case.

The install script is the closest fit to this repo's existing pattern (single `curl | sh`-style
bootstrap, non-root-safe default path, optional-tooling-should-fail-soft shape) and is what GitHub
itself recommends first on the install page for macOS/Linux.

## 2. Install location / idempotency detection

- **npm route**: lands in the npm global bin directory, i.e. `$(npm config get prefix)/bin/copilot`
  (a symlink to `npm-loader.js` in `.../lib/node_modules/@github/copilot/`). This repo's own
  `post-create-baseline.sh` already relies on `npm config get prefix` and reads Claude Code's own
  binary from that same location (`"${NVM_NODE_PREFIX}/bin/claude"`), which is on `PATH` in that
  non-login `postCreateCommand` script context (the baseline script itself invokes `npm` directly
  without sourcing any rc file first). So, unlike Codex/Antigravity's `~/.local/bin` problem, an
  npm-installed `copilot` would actually be immediately `command -v`-able in this same script —
  `command -v copilot` (or `npm list -g @github/copilot`) would be a valid, PATH-based idempotency
  check for the npm route specifically, in contrast to the binary-path checks Codex/Antigravity need.
- **Install-script route** (the recommended one, per §1): lands at `$HOME/.local/bin/copilot` for a
  non-root user by default. Because this is the exact same non-login-script PATH gap the repo's own
  Codex/Antigravity comments describe (`~/.local/bin` isn't on `PATH` for a non-login
  `postCreateCommand` script, and — per §1 — Copilot's own installer doesn't reliably add it to any
  rc file in a non-interactive run either), the idempotency check should follow the exact same
  binary-path pattern already used for Codex and Antigravity:
  ```sh
  if [ ! -x "$HOME/.local/bin/copilot" ]; then
    curl -fsSL https://gh.io/copilot-install | bash </dev/null || echo "Warning: Copilot CLI install failed, continuing without it" >&2
  fi
  ```
  (The `</dev/null` closes stdin defensively, matching the Codex block's precaution — though per §1
  the script's own interactive prompt reads from `/dev/tty` rather than stdin, so this is
  belt-and-suspenders rather than strictly required the way it is for Codex's installer.)
- **Homebrew/WinGet routes**: not evaluated in depth since they're not applicable inside this
  Ubuntu-only devcontainer (no Homebrew or WinGet present by default).

## 3. Versioning approach

Confirmed via the install page (https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)
and the install script itself:
- **Pinning a version**: the install script honors a `VERSION` environment variable. Per the docs,
  "To install a specific version, set the `VERSION` environment variable. It defaults to the latest
  version," with the documented example
  `curl -fsSL https://gh.io/copilot-install | VERSION="v0.0.369" PREFIX="$HOME/custom" bash`. Reading
  the script directly: `VERSION=latest` (or unset) uses
  `.../releases/latest/download/...`; `VERSION=prerelease` resolves the newest git tag via
  `git ls-remote --tags` against `https://github.com/github/copilot-cli`; any other value is treated
  as a release tag (auto-prefixed with `v` if missing) and downloads from
  `.../releases/download/<tag>/...`.
- npm mirrors this with dist-tags: `npm install -g @github/copilot` (latest, currently `1.0.82`) vs.
  `npm install -g @github/copilot@prerelease` (currently `1.0.83-0`), or any explicit
  `@github/copilot@<version>`.
- **Recommended/default posture**: GitHub's docs don't push version pinning as the recommended
  steady-state; the default in every install method is "latest," and updating is treated as an
  ongoing, expected action rather than a one-time pin. The official command reference
  (https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) documents
  two first-class update paths: the shell command `copilot update` ("Download and install the latest
  version") and the in-session slash command `/update`. There's also `copilot version` ("Display
  version information and check for updates") and, for enterprise/team accounts, `/downgrade VERSION`
  ("Download and restart into a specific CLI version. Available for team accounts."). Confirmed this
  was a real, deliberate docs gap that GitHub closed: [github/docs#44459](https://github.com/github/docs/issues/44459)
  ("the 'Installing Copilot CLI' article ... doesn't mention how users keep the CLI up to date after
  installation") was filed, closed, and fixed via a linked PR adding an "Updating Copilot CLI"
  section — i.e. GitHub's own docs team treats "install once, update via `copilot update`/`/update`"
  as the intended steady-state workflow, not permanent pinning.
- For a devcontainer `postCreateCommand` guard shaped like Codex/Antigravity's (skip if the binary
  already exists), the practical effect is: the binary installed at container-build time is
  effectively pinned to whatever was "latest" at that build, and stays there across rebuilds unless
  the volume/layer is wiped or the user runs `copilot update` themselves inside the container — the
  same latent-staleness trade-off Codex and Antigravity already have with this pattern, not something
  specific to Copilot.

## 4. Auth/config requirements to actually use `copilot` afterward

Confirmed directly against the dedicated official auth page
(https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli),
which documents an **exact credential precedence order**:

1. `COPILOT_GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. `GITHUB_TOKEN` environment variable
4. OAuth token from the system keychain (set via the interactive `/login` / `copilot login` device-flow)
5. GitHub CLI fallback — `gh auth token`, described by the docs as activating "only when no other
   credentials are found"

Two consequences worth calling out for this devcontainer specifically:
- **It requires an active GitHub Copilot subscription** (Pro, Pro+, Business, or Enterprise) —
  confirmed on both the install page and the `github/copilot-cli` README; a plain `gh auth login`
  identity with no Copilot seat won't be enough regardless of which auth path is used.
- **It genuinely piggybacks on this devcontainer's existing setup with zero extra steps**, unlike
  Codex (needs its own interactive ChatGPT login) or Antigravity (its own login, stored in the
  system keyring, that doesn't survive a bare-container rebuild per this repo's own
  `SKILL.md` caveat). This devcontainer's baseline already exports `GH_TOKEN` into the container
  (via `.devcontainer/.env` → `docker-compose`/`runArgs` env, per this skill's existing pattern) for
  `gh` CLI use. Per the precedence list above, `GH_TOKEN` is checked **before** the OAuth-keychain
  and `gh auth token` fallback paths, so `copilot` would pick up the same `GH_TOKEN` already present
  in the container environment automatically, with no `/login` and no separate token step — provided
  that token's identity has an active Copilot seat and (per the install page) a fine-grained PAT used
  this way needs the **"Copilot Requests"** account permission enabled specifically, which the
  baseline's existing `GH_TOKEN` (scoped for `gh` API operations per `SKILL.md`'s SSH-layer
  documentation) would need extended to include if it's a fine-grained PAT.
- Interactive fallback if no token is present: `/login` or `copilot login`, an OAuth device-flow
  (one-time code + browser), per the same auth page.

## 5. Whether the current `copilot-yolo` alias's assumption still holds

**Confirmed accurate — `/sandbox` is real, current, and does exactly what the alias's echoed message
implies.** Fetched directly from the official "Using GitHub Copilot CLI" overview
(https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/overview) and corroborated by
a `/sandbox`-specific docs page found via search
(https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings):
- `/sandbox` is a documented, in-session slash command. Running it "enable[s] local sandboxing,"
  which "restricts what Copilot can access" — "the commands and tools that Copilot CLI runs on your
  behalf are restricted, limiting their access to your filesystem, network, and system capabilities."
- It's not a one-shot toggle only — `/sandbox` opens an interactive configuration surface with
  **General, Auth, Filesystem, and Network** tabs, letting a user grant extra paths, adjust network
  access, or turn sandboxing on/off from within that same command.
- So the alias's assumption — "run the regular `copilot` command and then type `/sandbox enable` in
  the session" — is accurate as of today's docs: `/sandbox` is real, current, in-session, and does
  what the echoed message says it does. Nothing found suggests it's stale or renamed.

---

## Source file index

**Local repo files read (this worktree, `/Users/ken/Workspace/ken-guru/skills/.claude/worktrees/agent-a53f9f2e092300f23/`):**
- `skills/setup-devcontainer/templates/post-create-codex-block.sh` — Codex idempotency/fail-soft pattern
- `skills/setup-devcontainer/templates/post-create-antigravity-block.sh` — Antigravity idempotency/fail-soft pattern
- `skills/setup-devcontainer/templates/post-create-baseline.sh` — confirms `npm config get prefix` / npm global bin is already on `PATH` in the non-login `postCreateCommand` script context
- `skills/setup-devcontainer/SKILL.md` — Codex/Antigravity/Copilot-alias wiring, Antigravity keyring-auth caveat, `copilot-yolo` alias text (step 5, step 3)
- `research/words-are-snake-git-auth.md` (read via `git show origin/research/words-are-snake-git-auth:research/words-are-snake-git-auth.md` — not present on this branch's working tree) — used only to confirm this repo's research-note format convention

**Commands run directly against live services (not web-search paraphrase):**
- `npm view @github/copilot version|dist-tags|bin|engines|optionalDependencies|repository.url`
- `curl -fsSL https://api.github.com/repos/github/copilot-cli/releases/latest` (GitHub Releases API)
- `curl -fsSL https://gh.io/copilot-install` — fetched and read the actual 196-line install script in full

**Web sources fetched/read directly:**
- https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli — install methods, `VERSION`/`PREFIX` env vars, requirements
- https://docs.github.com/en/copilot/get-started/cli-quickstart — quickstart install/auth summary
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/overview — slash command list including `/sandbox`, `/add-dir`
- https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli — `COPILOT_HOME`, trusted directories, tool allow/deny flags
- https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli — exact credential precedence order (5 steps)
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference — `copilot update`, `copilot version`, `/update`, `/downgrade`, full command/slash-command list
- https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings — `/sandbox` tabs (General/Auth/Filesystem/Network)
- https://github.com/github/copilot-cli — README (install methods, requirements, auth, env vars)
- https://www.npmjs.com/package/@github/copilot — registry page (blocked by a 403 on direct fetch; corroborated instead via `npm view` above and WebSearch snippet)
- https://github.blog/changelog/2025-09-25-upcoming-deprecation-of-gh-copilot-cli-extension/ — old `gh-copilot` extension deprecation date (Oct 25, 2025)
- https://github.blog/changelog/2026-01-21-install-and-use-github-copilot-cli-directly-from-the-github-cli/ — new native `gh copilot` subcommand behavior
- https://github.com/github/docs/issues/44459 — confirms "how to update" was a real, since-fixed docs gap

**Not found / explicitly not fabricated:**
- No apt package or apt repository for GitHub Copilot CLI is documented anywhere in the above
  sources — apt is not a supported install method today.
- No `gh extension install` command installs the current product — that distribution shape belongs
  only to the retired `gh-copilot` extension (see the naming note above).
