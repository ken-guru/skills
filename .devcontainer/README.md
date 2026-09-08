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

## SSH deploy key and signing key

- Git push/pull and commit signing use two separate SSH keys, persisted
  across rebuilds in **this Tool Container's own** named volume
  (`skills-<tool>-ssh`) mounted at `~/.ssh` — private to this tool,
  not shared with any other Tool Container. Each SSH-enabled Tool Container
  registers and manages its own key pair.

**Why every tool gets its own key pair.** Once each Tool Container has its
own Private Checkout (its own isolated on-disk clone — see
[CONTEXT.md](../CONTEXT.md)), a shared SSH volume would be the one surface
still connecting them: a compromised or runaway agent in one container could
still read the key material every other container's `git push` and commit
signing depend on. Per-tool keys close that surface and buy *selective
revocation* — distrust one tool's key without touching any other's — at the
cost of the signing key's manual GitHub-UI registration step happening once
per SSH-enabled tool instead of once for the whole repo. See
`docs/adr/0001-per-container-ssh-keys.md` in this skill's own repo for the
full reasoning.

Two separate ED25519 keys exist because GitHub rejects a public key as a
signing key once that same key is already registered as a deploy key. Each
SSH-enabled Tool Container's `post-create.sh` generates `~/.ssh/id_ed25519`
as the deploy key (git transport: push/pull this repo, registered
automatically against `repos/ken-guru/skills/keys` via the `gh` API) and
`~/.ssh/id_ed25519_signing` as the signing key (commit verification,
registered manually once per tool via the GitHub UI — there's no API-driven
way to do this without granting the token account-level
`write:ssh_signing_key`, which would let it manage every signing key on the
account, not just this project's).

Both keys live in that tool's own `skills-<tool>-ssh` volume, so they
and the `~/.ssh/.signing-key-registered` marker survive that tool's
container rebuilds. Only wiping that specific volume regenerates that tool's
keys and resets its marker — it has no effect on any other tool.

Deploy-key registration is checked by key **content**, not title — if the
volume is wiped and a new key is generated, the stale GitHub entry (same
title, old content) is deleted and replaced. `postAttachCommand` re-verifies
the deploy key on every attach so an accidental deletion on GitHub is caught
immediately instead of failing silently on the next `git push`.

**Migrating from a repo-wide shared key pair.** If this repo was previously
set up before per-tool keys existed, each Tool Container's first rebuild
under the new scheme automatically removes the old repo-wide shared deploy
key once its own per-tool key is registered — no unused, unrevoked deploy
key is left standing. The old shared *signing* key has no equivalent
automatic cleanup (GitHub exposes no deletion API for it); remove it by hand
from <https://github.com/settings/keys> once every tool has registered its
own.

`GH_TOKEN` needs the repo's **Administration (read/write)** permission to
list, register, and delete deploy keys via `gh api repos/.../keys` — this is
in addition to whatever else you use `gh` for (Issues, Pull requests,
Metadata). No account-level token permissions are needed for any of this.

Register the signing key: `postAttachCommand` prints a one-time prompt with a
public key to paste into <https://github.com/settings/ssh> as a **Signing
Key**. Do that, then dismiss the prompt with
`touch ~/.ssh/.signing-key-registered`. **Do this once per SSH-enabled Tool
Container** — each tool has its own key pair and its own marker file on its
own volume now, so dismissing the prompt in one tool's window has no effect
on any other tool's.

**An under-scoped or missing `GH_TOKEN`, or an unset `DEVCONTAINER_HOST`, never fails the
container build.** `post-create-ssh-block.sh` probes `GH_TOKEN` before touching any keys; if it's
missing, invalid, or lacks Administration permission (or `DEVCONTAINER_HOST` isn't set), the rest
of the SSH setup is skipped and the reason is recorded to `~/.ssh/.ssh-setup-skipped` instead of
aborting `postCreateCommand` — which would otherwise also skip every block concatenated after the
SSH layer (the warnings banner below; tool installs run earlier and are unaffected). The reason
appears once in the build log, and then at the top of every
new terminal (via a `~/.bashrc` snippet) until it's fixed — along with the two other standing SSH
warnings (signing key not yet registered; deploy key missing on GitHub), all read from local files
so no terminal pays for a network call just to open a shell. Fix `.devcontainer/.env`, then
**Dev Containers: Rebuild Container** — no need to re-run this skill.

**`GH_TOKEN` alone doesn't authenticate git push/pull, only the `gh` API.**
The `gh` CLI reads `GH_TOKEN` automatically for API calls, but `git` itself
has no idea it exists. If this repo's remote is an SSH URL (`git@github.com:...`),
the SSH deploy key set up in `post-create.sh` is what makes `git push`/`git
pull` work against `origin` — `git config --global credential.helper
'!gh auth setup-git'` (set in the baseline) only covers an HTTPS remote, and
does nothing for SSH transport.
