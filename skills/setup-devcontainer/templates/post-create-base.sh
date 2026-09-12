#!/bin/bash
set -euo pipefail

# BASH_ENV loads only non-secret settings. GH_TOKEN is supplied by the
# developer's host environment and is never read from the Shared Checkout.

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
# for builds, tests, and formatters. The Scaffold/control plane and Git
# metadata are read-only so generated code cannot rewrite trusted lifecycle
# code, the runtime profile, hooks, or repository state.
#
# The read-only ACL below only protects a path's *contents* — POSIX
# rename/unlink permission is governed by the parent directory's write bit,
# not the entry's own ACL, so code-runner's rwX grant on /workspace itself
# would otherwise let it `mv` .devcontainer or .git aside and recreate a
# code-runner-owned replacement. The sticky bit closes that: with it set,
# only an entry's owner (or root) can rename/unlink it, regardless of
# directory-write permission — the same mechanism /tmp uses. That only
# holds if code-runner never owns .devcontainer/.git in the first place, so
# the ownership assertion below fails closed rather than silently trusting
# the invariant.
WORKSPACE_ACL_SKIP_MARKER="$HOME/.devcontainer-workspace-acl-skipped"
rm -f "$WORKSPACE_ACL_SKIP_MARKER"

# Fails closed by default; DEVCONTAINER_ACCEPT_RESIDUAL_RISK can name this
# check (or "all") to record the gap and continue instead. Shared by the SSH
# credential check below, which is appended after this skeleton — defined
# once here so both checks stay in sync. Every call site must guard this
# with `||`: under `set -e` a bare call would abort the script on exactly
# the opt-out path meant to let it continue.
residual_risk_fail_or_skip() {
  local check="$1" reason="$2" marker="$3"
  case ",${DEVCONTAINER_ACCEPT_RESIDUAL_RISK:-}," in
    *,"$check",*|*,all,*)
      echo "⚠ $check check skipped: $reason" >&2
      printf '%s (skipped %s): %s\n' "$check" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$reason" > "$marker"
      return 1
      ;;
    *)
      echo "ERROR: $reason" >&2
      exit 1
      ;;
  esac
}

if command -v setfacl >/dev/null 2>&1; then
  sudo setfacl -R -m u:code-runner:rwX /workspace
  find /workspace -type d -exec sudo setfacl -m d:u:code-runner:rwX {} +
  for protected_path in /workspace/.devcontainer /workspace/.git; do
    if [ -e "$protected_path" ]; then
      sudo setfacl -R -m u:code-runner:r-X "$protected_path"
      find "$protected_path" -type d -exec sudo setfacl -m d:u:code-runner:r-X {} +
    fi
  done
  sudo chmod +t /workspace
  for protected_path in /workspace/.devcontainer /workspace/.git; do
    if [ -e "$protected_path" ]; then
      protected_owner="$(stat -c '%U' "$protected_path" 2>/dev/null || stat -f '%Su' "$protected_path")"
      if [ "$protected_owner" = "code-runner" ]; then
        residual_risk_fail_or_skip workspace-acl "$protected_path is owned by code-runner; the workspace sticky-bit boundary cannot protect it" "$WORKSPACE_ACL_SKIP_MARKER" || break
      fi
    fi
  done
else
  residual_risk_fail_or_skip workspace-acl "ACL support is required to establish the code-runner boundary" "$WORKSPACE_ACL_SKIP_MARKER" || true
fi
