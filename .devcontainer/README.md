# Devcontainer setup

Each selected AI CLI runs in its own isolated **Tool Container** — a
devcontainer definition dedicated to exactly one CLI — instead of one shared
container installing every tool together. This means one tool's permission
grants, config, or install steps never affect another's, and you can open
more than one Tool Container at once (see "Running tools concurrently"
below).

Selected tools this run: Claude Code, Codex.

- All Tool Containers share one base image (`.devcontainer/base.Dockerfile`,
  tagged `skills-tool-container-base:v1`) — Node.js, the GitHub CLI, and a
  fixed `vscode` user/UID/GID, built once and reused across every tool rather than
  reinstalled per tool. It's rebuilt (and its tag bumped) only when this
  skill detects the rendered `base.Dockerfile` has changed, and always asks
  before bumping.
- Each Tool Container persists its own state across rebuilds via its own
  named volume (e.g. `skills-claude-config` for Claude Code), so one
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

`mattpocock/skills` (full) sync automatically on every container start, into
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

Neither tool selected this run has its YOLO alias enabled — both were
declined at setup time. Re-run this skill's "Adding another Tool Container
later" flow with a fresh answer to add one later.

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

**Codex Linux sandbox**: Codex's Tool Container carries `capAdd`/`securityOpt` grants so
Codex's own Bubblewrap sandbox (`codex-yolo`'s `--sandbox workspace-write`) can actually create
its namespace — scoped to Codex's own container only, never any other tool's. This skill does
not include a runtime health probe to verify the sandbox is confining anything on your specific
host — if `codex-yolo` ever behaves as though unsandboxed, that's the first thing to check by
hand.

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
