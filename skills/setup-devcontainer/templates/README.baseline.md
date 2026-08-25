# Devcontainer setup

Minimal devcontainer for running Claude Code in an isolated environment, per
[code.claude.com/docs/en/devcontainer](https://code.claude.com/docs/en/devcontainer).

- Base image: `mcr.microsoft.com/devcontainers/base:ubuntu`
- Features: Node.js (required by the Claude Code feature; without it, the
  feature's own Node.js auto-install fails under apt — see gotchas), the
  official `github-cli` feature, and the official `claude-code` devcontainer
  feature
- Claude Code state persists across rebuilds via a named volume
  (`{{REPO_NAME}}-claude-config`) mounted at `~/.claude`, with
  `CLAUDE_CONFIG_DIR` pointed at the same path. This volume holds more than
  auth — conversation transcripts, file-edit history, and session state all
  live under `CLAUDE_CONFIG_DIR` too — so it's namespaced per repo rather than
  shared machine-wide. A container running for one repo can't read another
  repo's conversation history this way, the same reasoning behind scoping
  `GH_TOKEN` and the SSH keys below to this repo alone. The trade-off: you log
  in again the first time each repo's container comes up, not just once per
  machine.
- `gh` CLI auth comes from a `GH_TOKEN` env var supplied via a gitignored
  `.devcontainer/.env` file — see below
- Claude Code skills are wiped and reinstalled from the configured sources
  ({{SKILLS_SOURCES_SUMMARY}}) on every container start — see "Skill
  management" below

## Opening it

1. Install Docker Desktop and VS Code's **Dev Containers** extension
   (`ms-vscode-remote.remote-containers`).
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and paste in a
   GitHub token (a fine-grained PAT scoped to this repo). If you skip this,
   `initializeCommand` creates an empty `.env` for you so the build doesn't
   fail, but `gh` won't be authenticated until you fill in a real token and
   rebuild.
3. Open this repo in VS Code, then **Dev Containers: Reopen in Container**
   (Cmd+Shift+P).
4. Once built, open a terminal and run `claude`, then follow the login prompt.
   `gh auth status` should already show you as logged in — no `gh auth login`
   needed.

## Skill management

`post-start.sh` wipes `~/.claude/skills` and reinstalls the full set from each
configured source on every container start:

```
{{SKILLS_SOURCES_COMMANDS}}
```

`~/.claude/skills` lives inside the same `{{REPO_NAME}}-claude-config` volume
already mounted for Claude Code state, so no separate volume is needed — the
wipe-and-reinstall just keeps the skill set in that volume current with
upstream on every start, rather than persisting a stale copy across rebuilds.
Add or remove a source by editing these lines directly.

## Gotchas fixed here (and why)

**`remoteUser` must match the base image's actual non-root user.** The
`mcr.microsoft.com/devcontainers/base:ubuntu` image's default non-root user is
`vscode`, not `node` — the example in Anthropic's own docs uses `/home/node`,
which only applies to Node-flavored base images. Using the wrong home path
silently creates an unused `/home/node` directory owned by `root`, and the
Claude session never persists because nothing is actually being read from or
written to it under the real user's `$HOME`. Fix: `remoteUser: "vscode"`, and
point the mount + `CLAUDE_CONFIG_DIR` at `/home/vscode/.claude`.

**A fresh named-volume mountpoint is always created `root:root`, regardless of
the parent directory's ownership** — even under `/home/vscode`, which is
otherwise fully owned by `vscode`. Docker does not inherit the parent
directory's ownership when it creates the mount target for a volume used for
the first time. Without a fix, `claude login` fails to persist anything: the
process (running as `vscode`) can't write into a directory it doesn't own,
even though the login flow itself completes successfully in the browser.
Fix: `postCreateCommand` runs `sudo chown -R vscode:vscode /home/vscode/.claude`
after the volume mounts.

**The `claude-code` feature installs the CLI into the nvm-managed global npm
tree as `root`**, even though the container runs as `vscode` afterward.
`vscode` is a member of the `nvm` group but only has read+execute (not write)
on that tree, so `claude update` (and the CLI's own auto-updater) fails with
"Insufficient permissions to install update." Fix: `postCreateCommand` also
chowns `$(npm config get prefix)/lib/node_modules/@anthropic-ai` and
`$(npm config get prefix)/bin/claude` to `vscode:nvm`.

**An outdated Claude Code CLI version can silently fail to persist login in a
container with no init system.** `claude doctor` reports a background daemon
that handles keychain sync and token refresh, managed via
launchd/systemd — but a bare devcontainer has no systemd running, so on an old
CLI build the daemon never starts, no persistence occurs, and `/login` reports
"Login successful" only to immediately fall back to logged out on the very
next check. Run `claude update` (needs the npm-permissions fix above to
succeed) to pick up a build new enough to run the daemon on-demand instead of
depending on a service manager. If login still doesn't persist after a
rebuild, run `claude doctor` first and check the "Background server" section
before assuming it's a mount or permissions problem again.

**There's no `docker-compose.yml` here, so `env_file` isn't available** —
this setup uses a plain `image`, and the devcontainer spec only supports
`env_file` under `dockerComposeFile`. Fix: `runArgs: ["--env-file", ...]`
passes `.devcontainer/.env` straight to `docker run` instead. Unlike
`env_file`'s `required: false`, `--env-file` errors if the file is missing,
so `initializeCommand` copies `.env.example` to `.env` on the host before the
build starts if `.env` doesn't exist yet — the container will build with
`gh` unauthenticated rather than failing outright.

## Troubleshooting

**`unable to find user vscode: no matching entries in passwd file` (or any other "no matching
entries in passwd file" error) on reopen.** Docker reused a container left over from an unrelated
prior devcontainer setup for this workspace folder instead of building fresh. The Dev Containers
CLI labels containers by `devcontainer.local_folder=<workspace path>`, independent of what the
current `devcontainer.json` says, so a stale container survives even after its old config was
deleted or never committed — and the leftover container has no `vscode` user because it wasn't
built from this baseline. Find and remove it, then reopen:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)"
docker rm -f <container id>
```

## SSH deploy key and signing key automation

Not set up here. Agent-driven `git push` and signed commits need it — see the
[setup-devcontainer skill](https://github.com/ken-guru/skills/tree/main/skills/setup-devcontainer)
(or ask the agent that built this to add it) to layer it on without redoing
this baseline.
