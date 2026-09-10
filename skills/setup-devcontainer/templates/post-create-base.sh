#!/bin/bash
set -euo pipefail

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
