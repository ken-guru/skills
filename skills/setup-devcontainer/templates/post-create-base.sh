#!/bin/bash
set -euo pipefail

# Trust the bind-mounted workspace regardless of host/container UID mismatch.
# The base image pins the vscode user to a fixed UID 1000 (see base.Dockerfile)
# so every Tool Container shares an identical identity — but that UID rarely
# matches the *host* user's UID that actually owns the bind-mounted repo
# outside the container. Git's own "dubious ownership" safety check then
# refuses to operate on /workspace at all ("detected dubious ownership in
# repository"), which surfaces through Claude Code's `--worktree` flag as
# "git identity could not be verified" — a confusing wrapper around the same
# underlying refusal. `*` (not just /workspace) also covers the nested git
# worktrees `claude --worktree` creates under /workspace/.claude/worktrees/.
git config --global --add safe.directory '*'

# Git identity — read from .devcontainer/.env (GIT_USER_EMAIL / GIT_USER_NAME).
# Shared across every Tool Container: git identity isn't tool-specific, so
# this block is concatenated into every generated tool's post-create.sh
# rather than duplicated by hand per tool.
git config --global credential.helper '!gh auth setup-git'
git config --global user.email "${GIT_USER_EMAIL:-{{GIT_EMAIL_DEFAULT}}}"
git config --global user.name "${GIT_USER_NAME:-{{GIT_NAME_DEFAULT}}}"
