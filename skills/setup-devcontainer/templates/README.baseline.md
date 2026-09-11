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
  shared named volume (`{{REPO_NAME}}-config`, mounted at `/home/vscode`) —
  each CLI keeps its own subdirectory within it (`~/.claude`, `~/.codex`,
  `~/.antigravity`, `~/.copilot`).
- `gh` CLI auth comes from a host-provided `GH_TOKEN`; secrets are never read
  from the Shared Checkout.
- The workspace at `/workspace` is a live bind-mount of this repo's own
  working directory, not a clone — uncommitted or gitignored changes,
  including to `.devcontainer/` itself, are visible immediately.

## Opening the devcontainer

1. Install Docker Desktop and VS Code's **Dev Containers** extension
   (`ms-vscode-remote.remote-containers`).
2. Export a repository-scoped fine-grained `GH_TOKEN` in the host environment.
   Copy `.devcontainer/.env.example` to `.devcontainer/.env` only for
   non-secret identity/host-label settings.
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

## SSH deploy key and signing key automation

Not set up here. Agent-driven `git push` and signed commits need it — see
the
[setup-devcontainer skill](https://github.com/ken-guru/skills/tree/main/skills/setup-devcontainer)
(or ask the agent that built this to add it).

## Installed CLI Tools
