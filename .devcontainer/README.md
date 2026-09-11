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
transport: push/pull this repo) and `~/.ssh/id_ed25519_signing` as the
signing key (commit verification). Both are generated unconditionally —
neither needs `GH_TOKEN` at all, only `DEVCONTAINER_HOST` (used to label
them so you can identify and revoke them per machine from GitHub).

**Both keys are registered with GitHub manually by default** — `gh
api repos/.../keys` needs the repo's **Administration** permission, and
that's disproportionate to grant `GH_TOKEN` just for this, especially since
it's sourced into every AI CLI's shell in this container. `postAttachCommand`
prints a one-time combined prompt with each key's public key to paste in:
the deploy key at `https://github.com/ken-guru/skills/settings/keys/new` (as
an **Authentication Key**), the signing key at
<https://github.com/settings/ssh> (as a **Signing Key**). Dismiss each once
done:

```bash
touch ~/.ssh/.deploy-key-registered
touch ~/.ssh/.signing-key-registered
```

**Optional convenience:** if `GH_TOKEN` happens to carry this repo's
**Administration (read/write)** permission, `post-create.sh` auto-registers
(and, on rotation, replaces) the deploy key via the API, so its half of the
prompt above never appears — `.deploy-key-registered` is touched for you.
This is opportunistic only: no permission on `GH_TOKEN` is required, nothing
fails or warns if it's absent, and the manual path above always works
regardless. The signing key has no equivalent auto-registration — there's no
API-driven way to do it without granting `GH_TOKEN` account-level
`write:ssh_signing_key`, which would let it manage every signing key on the
account, not just this project's — so it's always manual.

Both keys live in the `skills-ssh` volume, so they and both the
`.deploy-key-registered` and `.signing-key-registered` markers survive
container rebuilds. Only wiping that volume regenerates the keys and resets
the markers — if the deploy key was auto-registered before, its stale
GitHub entry is auto-replaced on the next rebuild (matched by key
**content**, not title); if it was registered manually, remove the stale
entry yourself.

`postAttachCommand` re-verifies the deploy key on every attach, so an
accidental deletion on GitHub is caught immediately instead of failing
silently on the next `git push`. This check needs no `GH_TOKEN` scope at
all — it runs `ssh -T git@github.com` using the deploy key directly and
reads GitHub's own authenticated greeting, which is a stronger signal than
an API lookup: it proves push/pull actually works right now, not just that
GitHub's key list contains a matching entry.

**`GH_TOKEN` alone doesn't authenticate git push/pull, only the `gh` API.**
The `gh` CLI reads `GH_TOKEN` automatically for API calls, but `git` itself
has no idea it exists. If this repo's remote is an SSH URL (`git@github.com:...`),
the SSH deploy key set up in `post-create.sh` is what makes `git push`/`git
pull` work against `origin` — `git config --global credential.helper
'!gh auth setup-git'` (set in the baseline) only covers an HTTPS remote, and
does nothing for SSH transport. Keeping push access on a separate,
filesystem-resident key like this — rather than folding it into `GH_TOKEN`
— is deliberate: `GH_TOKEN` is an environment variable exposed to every
process in the container, while the deploy key is a file that requires a
much more deliberate, targeted read to exfiltrate, and a leak of one never
hands over the other.

**An unset `DEVCONTAINER_HOST` never fails the container build**, but it
does skip SSH setup entirely (both keys, not just auto-registration) —
`post-create-ssh-block.sh` records why to `~/.ssh/.ssh-setup-skipped`
instead of aborting `postCreateCommand`, which would otherwise also skip
every block concatenated after the SSH layer (the warnings banner below;
CLI installs run earlier and are unaffected). The reason appears once in
the build log, and then at the top of every new terminal (via a
`~/.bashrc` snippet) until it's fixed — along with the other standing SSH
warnings (either key not yet registered; deploy key not currently working),
all read from local files so no terminal pays for a network call just to
open a shell. Fix `.devcontainer/.env`, then **Dev Containers: Rebuild
Container** — no need to re-run this skill.

## Installed CLI Tools
- Claude Code
