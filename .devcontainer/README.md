# Devcontainer setup

One shared devcontainer for this repo. Every AI CLI you add — Claude Code,
Codex, Antigravity, GitHub Copilot — installs into this same container via
its own independent skill (`setup-claude-devcontainer`,
`setup-codex-devcontainer`, `setup-antigravity-devcontainer`,
`setup-copilot-devcontainer`), run separately from this one, in any order,
as many times as you like.

- The container's own definition (`devcontainer.json`, `Dockerfile`) is
  generated once by this skill and never changes when a CLI is added later —
  each CLI skill only ever adds its own install step to `post-create.sh` and,
  if opted into automatic skill sync, its own block to `post-start.sh`.
- Every CLI's config, auth, and history persists across rebuilds in one
  shared named volume (`skills-config`, mounted at `/home/vscode`) —
  each CLI keeps its own subdirectory within it (`~/.claude`, `~/.codex`,
  `~/.antigravity`, `~/.copilot`).
- `gh` CLI auth comes from a `GH_TOKEN` env var supplied via one shared,
  gitignored `.devcontainer/.env` file — see below.
- The workspace at `/workspace` is a live bind-mount of this repo's own
  working directory, not a clone — uncommitted or gitignored changes,
  including to `.devcontainer/` itself, are visible immediately.

## Opening the devcontainer

1. Install Docker Desktop and VS Code's **Dev Containers** extension
   (`ms-vscode-remote.remote-containers`).
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and paste in a
   GitHub token (a fine-grained PAT scoped to this repo). If you skip this,
   `initializeCommand` creates an empty `.env` for you so the build doesn't
   fail, but `gh` won't be authenticated until you fill in a real token and
   rebuild.
3. Open this repo in VS Code, then **Dev Containers: Reopen in Container**
   (Cmd+Shift+P).
4. Run whichever CLI skill(s) you want (`setup-claude-devcontainer`, etc.) to
   add tools, then open a terminal and log in to each.

## Gotchas fixed here (and why)

**`remoteUser` must match the base image's actual non-root user.** The base
image's non-root user is `vscode`, not `node` — using the wrong home path
silently creates an unused directory owned by `root`, and nothing persists
because a tool never actually reads from or writes to the real user's
`$HOME`. Fix: `remoteUser: "vscode"` everywhere, matching the identity baked
into the image.

**A fresh named-volume mountpoint is always created `root:root`**, regardless
of the parent directory's ownership. Without a fix, a CLI's login or config
write fails to persist: the process (running as `vscode`) can't write into a
directory it doesn't own. Fix: each CLI's install block chowns its own config
subdirectory after the container starts.

## Troubleshooting

**`unable to find user vscode: no matching entries in passwd file` on
reopen.** Docker reused a container left over from an unrelated prior
devcontainer setup for this workspace folder instead of building fresh. The
Dev Containers CLI labels containers by
`devcontainer.local_folder=<workspace path>`, independent of what the
current config says, so a stale container survives even after its old
config was deleted or never committed — and the leftover container has no
`vscode` user because it wasn't built from this setup. Find and remove it,
then reopen:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)"
docker rm -f <container id>
```

## SSH deploy key and signing key

- Git push/pull and commit signing use two separate SSH keys, persisted
  across rebuilds in the shared `skills-ssh` named volume, mounted at
  `~/.ssh`. There's one container now, so one shared key pair is all there
  is to manage.

Two separate ED25519 keys exist because GitHub rejects a public key as a
signing key once that same key is already registered as a deploy key.
`post-create.sh` generates `~/.ssh/id_ed25519` as the deploy key (git
transport: push/pull this repo, registered automatically against
`repos/ken-guru/skills/keys` via the `gh` API) and `~/.ssh/id_ed25519_signing`
as the signing key (commit verification, registered manually once via the
GitHub UI — there's no API-driven way to do this without granting the token
account-level `write:ssh_signing_key`, which would let it manage every
signing key on the account, not just this project's).

Both keys live in the `skills-ssh` volume, so they and the
`~/.ssh/.signing-key-registered` marker survive container rebuilds. Only
wiping that volume regenerates the keys and resets the marker.

Deploy-key registration is checked by key **content**, not title — if the
volume is wiped and a new key is generated, the stale GitHub entry (same
title, old content) is deleted and replaced. `postAttachCommand` re-verifies
the deploy key on every attach so an accidental deletion on GitHub is caught
immediately instead of failing silently on the next `git push`.

`GH_TOKEN` needs the repo's **Administration (read/write)** permission to
list, register, and delete deploy keys via `gh api repos/.../keys` — this is
in addition to whatever else you use `gh` for (Issues, Pull requests,
Metadata). No account-level token permissions are needed for any of this.

Register the signing key: `postAttachCommand` prints a one-time prompt with a
public key to paste into <https://github.com/settings/ssh> as a **Signing
Key**. Do that, then dismiss the prompt with
`touch ~/.ssh/.signing-key-registered`.

**An under-scoped or missing `GH_TOKEN`, or an unset `DEVCONTAINER_HOST`, never fails the
container build.** `post-create-ssh-block.sh` probes `GH_TOKEN` before touching any keys; if it's
missing, invalid, or lacks Administration permission (or `DEVCONTAINER_HOST` isn't set), the rest
of the SSH setup is skipped and the reason is recorded to `~/.ssh/.ssh-setup-skipped` instead of
aborting `postCreateCommand` — which would otherwise also skip every block concatenated after the
SSH layer (the warnings banner below; CLI installs run earlier and are unaffected). The reason
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
## Installed CLI Tools
- Claude Code
