#!/bin/bash
set -euo pipefail

# devcontainer.json's BASH_ENV containerEnv entry already sources
# bash-env.sh (same .env, same `set -a` export) before this script's own
# first line runs, since this is itself a non-interactive bash invocation —
# but source it again directly, defensively, in case this script is ever
# run by hand outside that containerEnv (e.g. `bash post-create.sh` on a
# host shell during local testing). `set -a` exports every var this script
# and its appended blocks read (GH_TOKEN, GIT_USER_EMAIL, GIT_USER_NAME,
# DEVCONTAINER_HOST) for the rest of this script, including every CLI
# skill's block appended after it.
ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# The BASH_ENV mechanism above only fires for non-interactive shells (any
# AI CLI's own tool calls, which run `bash -c ...`) — it's never consulted
# for an interactive shell, which is how a human's VS Code terminal starts.
# Give those the same .env load via ~/.bashrc instead, guarded so a rebuild
# doesn't keep appending duplicates; ~/.bashrc itself lives in the
# persistent config volume, so this only needs to run once per volume, not
# once per rebuild — but idempotent is cheap insurance either way.
if ! grep -q "devcontainer-env-load" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-env-load
source /workspace/.devcontainer/bash-env.sh
EOF
fi

# /workspace is the host's own working directory, bind-mounted directly (VS
# Code's default devcontainer behavior) — not a clone into a separate
# volume. Trust it regardless of who owns it: this is a defensive backstop
# against git's "dubious ownership" safety check ("detected dubious
# ownership in repository", surfacing through Claude Code's `--worktree`
# flag as "git identity could not be verified") in any scenario where the
# bind-mounted directory's ownership doesn't match this container's UID.
# `*` (not just /workspace) also covers nested git worktrees `claude
# --worktree` creates under /workspace/.claude/worktrees/.
git config --global --add safe.directory '*'

# Local Checkout: a workspace with no GitHub `origin` yet. Bind-mounting
# means /workspace already holds whatever the host has — no clone step is
# needed here, unlike the old per-container clone model. If this run's
# answer to "initialize with git init?" was yes and no .git exists yet,
# initialize it now; a genuinely bare Local Checkout (declined git init)
# or a repo that already has a real origin skip this entirely.
if [ "{{LOCAL_CHECKOUT_GIT_INIT}}" = "true" ] && [ ! -d /workspace/.git ]; then
  if [ -n "{{GIT_DEFAULT_BRANCH}}" ]; then
    git init --initial-branch="{{GIT_DEFAULT_BRANCH}}" /workspace
  else
    git init /workspace
  fi
  echo "Local Checkout initialized: git repo, no origin."
fi

# Git identity — read from .devcontainer/.env (GIT_USER_EMAIL / GIT_USER_NAME).
# Base-owned: git identity isn't tool-specific, so this is set once here
# rather than duplicated by any CLI skill.
git config --global credential.helper '!gh auth setup-git'
git config --global user.email "${GIT_USER_EMAIL:-{{GIT_EMAIL_DEFAULT}}}"
git config --global user.name "${GIT_USER_NAME:-{{GIT_NAME_DEFAULT}}}"

# Give the separate code identity the minimum Shared Checkout access needed
# for builds, tests, formatters, and hooks. Credentials are deliberately
# configured by a later security block outside this ACL grant and must never
# be placed in the checkout.
if ! command -v setfacl >/dev/null 2>&1; then
  echo "ERROR: ACL support is required to establish the code-runner boundary" >&2
  exit 1
fi
sudo setfacl -R -m u:code-runner:rwX /workspace
find /workspace -type d -exec sudo setfacl -m d:u:code-runner:rwX {} +
