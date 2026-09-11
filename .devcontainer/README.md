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
- `gh` CLI auth comes from a host-provided `GH_TOKEN`; secrets are never read
  from the Shared Checkout — see below.
- The workspace at `/workspace` is a live bind-mount of this repo's own
  working directory, not a clone — uncommitted or gitignored changes,
  including to `.devcontainer/` itself, are visible immediately.

## Opening the devcontainer

1. Install Docker Desktop and VS Code's **Dev Containers** extension
   (`ms-vscode-remote.remote-containers`).
2. Export a repository-scoped fine-grained `GH_TOKEN` in the host environment.
   If you use the optional SSH layer, also export
   `DEVCONTAINER_CREDENTIALS_DIR` to the protected host directory containing
   the deploy and signing keys. `initializeCommand` creates the non-secret
   `.env` file used for identity and host settings.
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

- Git push/pull and commit signing use two separate developer-owned SSH keys.
  Put `deploy-key`, `deploy-key.pub`, `signing-key`, and `signing-key.pub` in
  a host directory and export `DEVCONTAINER_CREDENTIALS_DIR` before reopening
  the Shared Container. The directory is mounted read-only outside the Shared
  Checkout and validated during setup; the code identity cannot read it.

Two separate ED25519 keys exist because GitHub rejects a public key as a
signing key once that same key is already registered as a deploy key.
The setup copies the developer-provided keys into the protected agent home as
`~/.ssh/id_ed25519` and `~/.ssh/id_ed25519_signing` for git transport and
commit verification.

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

No GitHub Administration permission is required for setup. Deploy-key
registration is intentionally manual, and `GH_TOKEN` is never used to manage
repository keys.

The developer-owned source keys remain outside the Shared Checkout. The
copied agent-home keys and registration markers persist in the container
config volume; changing source keys requires rebuilding the Shared Container.

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

If `DEVCONTAINER_CREDENTIALS_DIR` is unset or unsafe, SSH setup fails closed.
Configure the host directory and rebuild the Shared Container.

## Security boundary

Workspace-derived commands run through `devcontainer-code-runner` as the
unprivileged code identity. The agent-operation identity separately performs
GitHub API calls, signed commits, pushes, and pull requests. Never bypass the
runner for repository-controlled scripts if the generated-code boundary is
required.

The Shared Container fails closed when credential isolation or the required
runtime profile cannot be established. A weaker explicit opt-out is recorded
as residual risk. This boundary does not protect against a deliberately
malicious agent-operation process using its own authorized credentials, and it
does not guarantee safety against compromised upstream Curated Skill Set
sources.

Automatic skill refresh replaces only the container-owned Curated Skill Set.
It stages and validates all configured sources before an atomic swap, keeps
the current and immediately previous manifests, restores the previous set on
total failure, and leaves Workspace Skills untouched.

## GitHub authority

Use a repository-scoped fine-grained token. Issues and pull requests are
read/write; repository contents are read-only; workflow files are writable;
workflow status/history and Dependabot, advisories, code scanning, secret
scanning, and security events are read-only. Administration, secrets or
variables management, and workflow-run mutation are not required.

## Installed CLI Tools
- Claude Code
- Codex
