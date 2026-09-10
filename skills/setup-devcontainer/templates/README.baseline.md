# Devcontainer setup

Each selected AI CLI runs in its own isolated **Tool Container** — a
devcontainer definition dedicated to exactly one CLI — instead of one shared
container installing every tool together. This means one tool's permission
grants, config, or install steps never affect another's, and you can open
more than one Tool Container at once (see "Running tools concurrently"
below).

Selected tools this run: {{SELECTED_TOOLS_SUMMARY}}.

- All Tool Containers share one base image (`.devcontainer/base.Dockerfile`,
  tagged `{{BASE_IMAGE_TAG}}`) — Node.js, the GitHub CLI, and a fixed
  `vscode` user/UID/GID, built once and reused across every tool rather than
  reinstalled per tool. It's rebuilt (and its tag bumped) only when this
  skill detects the rendered `base.Dockerfile` has changed, and always asks
  before bumping.
- Each Tool Container persists its own state across rebuilds via its own
  named volume (e.g. `{{REPO_NAME}}-claude-config` for Claude Code), so one
  tool's container can't read another's config, auth, or history.
- `gh` CLI auth in every Tool Container comes from a `GH_TOKEN` env var
  supplied via one shared, gitignored `.devcontainer/.env` file — see below.
- Every terminal you open prints a one-line banner naming which Tool
  Container it is (e.g. `── Claude Code Tool Container ──`), so it's always
  obvious which CLI's container a given shell belongs to.

## Opening a Tool Container

1. Install Docker Desktop and VS Code's **Dev Containers** extension
   (`ms-vscode-remote.remote-containers`).
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and paste in a
   GitHub token (a fine-grained PAT scoped to this repo). If you skip this,
   `initializeCommand` creates an empty `.env` for you so the build doesn't
   fail, but `gh` won't be authenticated until you fill in a real token and
   rebuild.
3. Open this repo in VS Code, then **Dev Containers: Reopen in Container**
   (Cmd+Shift+P) and pick the Tool Container you want (e.g. "Claude Code").
4. Once built, open a terminal and run that tool's CLI, then follow its login
   prompt.

## Running tools concurrently

Every Tool Container is a service in the same `.devcontainer/docker-compose.yml`,
each with its own **Private Checkout** — its own isolated clone of this repo,
not a shared bind mount — so they're built to run side by side, not just one
at a time. VS Code only connects one container per window, so to use two
tools at once: open a **second** VS Code window (File > New Window) on this
same repo, then **Dev Containers: Reopen in Container** and pick a
*different* Tool Container there. Each window's container keeps running
independently — closing one window's container does not stop the other's.

**One-time sanity check** (not required on every setup, only worth doing once
if you plan to use more than one tool at a time): open two Tool Containers
this way and confirm both stay attached in their own windows at the same
time, and that an uncommitted edit made in one is genuinely invisible in the
other (Private Checkouts don't share a filesystem or auto-sync with each
other — see `git fetch`/`pull` if you want one to pick up what another has
pushed). If you only ever use one tool, you can skip this entirely.

## Automatic skill sync

{{SKILLS_SOURCES_SUMMARY}} sync automatically on every container start, into
whichever of these tools is selected — nothing to enable manually, and
nothing to run yourself inside the container:

- Claude Code → `~/.claude/skills`
- Codex → `~/.codex/skills`
- Antigravity → `~/.gemini/antigravity/skills`
- Copilot → `~/.copilot/skills`

**Only naming a source you trust matters here.** Syncing installs and
re-syncs that source's skills unattended, with no per-skill review step, and
an installed skill's instructions can influence what the agent does inside
the container. To change which sources sync, re-run this skill and answer
the skill-sources question differently.

## CLI installer notes

**Antigravity**'s install script already verifies a checksum or signed
digest of its own download before installing — unconditionally, not only
when a version happens to be pinned: SHA512 checksum against a signed
manifest, halting the install on mismatch. It's the only one of the four
still installed this way — no npm/Homebrew/apt package exists for it to
swap to (confirmed by research for #232/#234).

**Claude Code, Codex, and Copilot** install via npm instead of a vendor
curl|bash script (`npm install -g @anthropic-ai/claude-code`, `@openai/
codex`, `@github/copilot`) — npm's own registry signature is their
integrity model, verified independently of any version pin (Codex's
package additionally carries SLSA provenance, the strongest integrity
evidence of the four). None of the four offers a way to review or filter
what a given release *contains* before installing — only that the bytes
downloaded match what was published, to the npm registry or (Antigravity)
the vendor directly.

**CLI version pinning.** All three npm-installed tools support locking to
an exact version via `CLAUDE_CODE_VERSION`, `CODEX_VERSION`, or
`COPILOT_VERSION` in `.env` — but they needed different amounts of work to
actually hold, since only one of the three fights a background
auto-updater:

- **Claude Code — adopted, after three earlier attempts failed.** Locking
  also writes `DISABLE_UPDATES` (not the weaker `DISABLE_AUTOUPDATER`) into
  `/etc/claude-code/managed-settings.json`, the one delivery channel
  onboarding can't overwrite. Three earlier mechanisms each failed
  differently before this one held: a container env var (Claude Code
  doesn't read the auto-updater setting from process environment at all),
  the user's own `settings.json` (Claude Code's first-run onboarding
  overwrites that file wholesale, silently dropping it), and
  `DISABLE_AUTOUPDATER` in managed settings itself (survived onboarding,
  but — verified live — a version pinned to `2.1.265` still silently
  installed `2.1.266` on startup anyway, since that setting only stops the
  background update check, not every update path). `DISABLE_UPDATES` is
  documented as blocking every update path; verified live, `claude doctor`
  reports `Auto-updates: disabled (set by env: DISABLE_UPDATES)`
  immediately after a pinned install, and both the reported version and
  that status still hold from a fresh container start against a filesystem
  snapshot taken right after install — the same "next launch" moment that
  caught the prior mechanism's failure.
- **Codex — adopted, simpler than Claude Code's case.** `codex doctor`
  self-reports no background auto-updater at all — Codex only updates via
  the explicit `codex update` subcommand, never silently. Verified live: an
  npm-pinned version holds on its own, no extra setting needed, across the
  same fresh-container-start check used for Claude Code.
- **Copilot — adopted; the earlier crash doesn't reproduce here.** A prior
  pinning attempt, on the old curl|bash installer, crashed Copilot's own
  self-updater on startup (`Error auto updating: TypeError: Invalid
  Version: latest`) — the literal string `"latest"` breaking that
  installer's own version-comparison code. npm always resolves an install
  to a concrete semver, never that literal string; verified live, an
  npm-pinned version holds cleanly across a fresh container start, both
  with and without `COPILOT_AUTO_UPDATE=false` present. That env var stays
  set unconditionally regardless, as defensive insurance against the same
  underlying self-update instability, even though holding the pin didn't
  end up needing it.

Leave any of the three `_VERSION` variables unset (or `latest`) to skip all
of this and keep that tool's always-latest, auto-updating default.

**Codex sandbox capability grant.** Codex's Tool Container carries `capAdd`/
`securityOpt` grants (`SYS_ADMIN`, `seccomp=unconfined`, `systempaths=
unconfined`) so Codex's own Bubblewrap sandbox (`codex-yolo`'s `--sandbox
workspace-write`) can actually create its namespace — scoped to Codex's own
container only, never any other tool's. Two distinct causes, not one grant
for one reason: `SYS_ADMIN`/`seccomp=unconfined` satisfy Docker's own
default seccomp/OCI policy for creating an unprivileged user namespace
inside an already-containerized environment; they are not bubblewrap's own
stated minimum requirement (bubblewrap's modern mode doesn't itself need
`SYS_ADMIN`). `systempaths=unconfined` is a separate fix, for a distinct
`/proc`-remount failure bubblewrap hits under Docker's default masked/
read-only path set (Moby's `MaskedPaths`/`ReadonlyPaths` OCI mechanism —
not an AppArmor-only setting despite the name). A narrower grant is
plausible but unverified by any primary source at time of writing, so it
isn't changed here without empirical testing. This skill does not include a
runtime health probe to verify the sandbox is confining anything on your
specific host — if `codex-yolo` ever behaves as though unsandboxed, that's
the first thing to check by hand.

**Antigravity CLI Auth.** `agy` stores auth in the system keyring, not a
file. The `.antigravity` volume mount will not persist its login across
rebuilds in a bare container. You may need to re-auth `agy` each time, or
add a keyring daemon yourself later if that gets annoying.

## YOLO aliases

Each tool's `-yolo` alias trades some of its normal permission checkpoints
for faster, more unattended iteration. The specific tradeoff differs per
tool — read the one for any alias you plan to use before relying on it:

- **`claude-yolo`** (`claude --permission-mode auto --worktree --remote-control`):
  uses classifier-based auto permission mode rather than
  `--dangerously-skip-permissions`, deliberately — the latter triggers Claude
  Code's own sandbox, whose mount-namespace view of the repo conflicts with
  git's worktree identity check and breaks worktree creation every time.
- **`codex-yolo`** (`codex --ask-for-approval on-request --sandbox workspace-write
  -c sandbox_workspace_write.network_access=true`): uses an on-request
  approval mode rather than Codex's full-bypass equivalent
  (`--dangerously-bypass-approvals-and-sandbox`), so the model still has a
  real internal checkpoint — it judges when to escalate to a human, rather
  than never escalating. The Tool Container's `capAdd`/`securityOpt` grants
  are what let the `workspace-write` sandbox actually create its namespace.
- **`agy-yolo`** (`agy --mode accept-edits`): does **not** use
  `--dangerously-skip-permissions --sandbox` — Antigravity auto-approves its
  own sandbox's internal prompts once `--dangerously-skip-permissions` is
  present, making `--sandbox` a no-op (a filed upstream Google bug,
  antigravity-cli#36). The real safety boundary here is a curated
  `permissions.allow` list, not a sandbox flag — a manual, once-per-machine
  step, deliberately not auto-templated. Add to
  `~/.antigravity/antigravity-cli/settings.json` a list scoped to this
  repo's actual safe commands, starting from `git`, `gh`, `ls`, `cat` and
  extending with whatever else this repo's workflows need (package manager,
  test runner, etc.) — never `rm`, `curl`, raw `bash -c`, or a wildcard.
- **`copilot-yolo`**: not a real bypass — Copilot CLI has no unattended/
  auto-approve flag of its own, so this alias just echoes the manual step
  needed instead (`/sandbox enable`, typed inside a regular `copilot`
  session).

## Gotchas fixed here (and why)

**`remoteUser` must match the base image's actual non-root user.** The base
image's non-root user is `vscode`, not `node` — using the wrong home path
silently creates an unused directory owned by `root`, and nothing persists
because the tool never actually reads from or writes to the real user's
`$HOME`. Fix: `remoteUser: "vscode"` everywhere, matching the identity baked
into the shared base image.

**A fresh named-volume mountpoint is always created `root:root`**, regardless
of the parent directory's ownership — even under `/home/vscode`, which is
otherwise fully owned by `vscode`. Without a fix, a tool's login or config
write fails to persist: the process (running as `vscode`) can't write into a
directory it doesn't own. Fix: each tool's `post-create.sh` chowns its own
config volume mount after it's attached.

**There's no plain `image`-based `devcontainer.json` here** — every Tool
Container uses `dockerComposeFile` + `service`, which is what makes
concurrent use (above) possible in the first place; a plain-image
`devcontainer.json` only ever supports one container per workspace at a time.

**VS Code's own "Type `copilot` to use Copilot CLI" terminal hint is
misleading here.** VS Code's built-in `terminal.integrated.initialHint`
feature shows that suggestion in every fresh terminal based on the local VS
Code window's Copilot/Chat entitlement state, not on what's actually
installed in the attached container — so it appears even inside a Claude
Code, Codex, or Antigravity Tool Container, where `copilot` isn't installed
at all. Fix: every non-Copilot Tool Container's `devcontainer.json` disables
it via `customizations.vscode.settings`; Copilot's own Tool Container leaves
it enabled, since there the suggestion is correct.

## Troubleshooting

**`unable to find user vscode: no matching entries in passwd file` (or any
other "no matching entries in passwd file" error) on reopen.** Docker reused
a container left over from an unrelated prior devcontainer setup for this
workspace folder instead of building fresh. The Dev Containers CLI labels
containers by `devcontainer.local_folder=<workspace path>` and
`com.docker.compose.service=<service>`, independent of what the current
config says, so a stale container survives even after its old config was
deleted or never committed — and the leftover container has no `vscode` user
because it wasn't built from this setup. Find and remove it, then reopen:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)"
docker rm -f <container id>
```

**Upgrading from an older, single-shared-container version of this setup.**
This version fully replaces the old single `devcontainer.json` +
`post-create.sh` layout with one Tool Container per AI CLI — there's no
in-place converter. Remove the old `.devcontainer/` directory entirely and
re-run this skill fresh.

## SSH deploy key and signing key automation

Not set up for any tool here. Agent-driven `git push` and signed commits need
it — see the
[setup-devcontainer skill](https://github.com/ken-guru/skills/tree/main/skills/setup-devcontainer)
(or ask the agent that built this to add it) to layer it onto a specific
Tool Container without redoing this setup.
