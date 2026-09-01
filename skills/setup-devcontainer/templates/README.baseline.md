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
bind-mounting this same repo checkout — they're built to run side by side, not
just one at a time. VS Code only connects one container per window, so to use
two tools at once: open a **second** VS Code window (File > New Window) on
this same repo, then **Dev Containers: Reopen in Container** and pick a
*different* Tool Container there. Each window's container keeps running
independently — closing one window's container does not stop the other's.

**One-time sanity check** (not required on every setup, only worth doing once
if you plan to use more than one tool at a time): open two Tool Containers
this way and confirm both stay attached in their own windows at the same
time. If you only ever use one tool, you can skip this entirely.

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
