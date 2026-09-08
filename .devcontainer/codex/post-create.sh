#!/bin/bash
set -euo pipefail

# Trust /workspace regardless of who owns it. Private Checkout's own clone
# (or git init) already runs as this container's vscode user, so UID
# mismatch isn't the everyday case it was under the old bind-mounted
# workspace — but this stays a defensive backstop against git's "dubious
# ownership" safety check ("detected dubious ownership in repository",
# surfacing through Claude Code's `--worktree` flag as "git identity could
# not be verified") in any scenario where /workspace's ownership doesn't
# match this container's UID regardless of cause. `*` (not just /workspace)
# also covers the nested git worktrees `claude --worktree` creates under
# /workspace/.claude/worktrees/ — now private to this container's own
# Private Checkout, not host-visible noise.
git config --global --add safe.directory '*'

# Git identity — read from .devcontainer/.env (GIT_USER_EMAIL / GIT_USER_NAME).
# Shared across every Tool Container: git identity isn't tool-specific, so
# this block is concatenated into every generated tool's post-create.sh
# rather than duplicated by hand per tool.
git config --global credential.helper '!gh auth setup-git'
git config --global user.email "${GIT_USER_EMAIL:-ken.paulsen@gmail.com}"
git config --global user.name "${GIT_USER_NAME:-Ken Sørevåge}"

# Prints which Tool Container this shell belongs to, at the top of every new
# terminal — cheap insurance against mistaking one CLI's container for
# another's. This matters even beyond user error: VS Code's own built-in
# terminal.integrated.initialHint feature shows a client-side "Type copilot
# to use Copilot CLI" suggestion based on local Copilot/Chat entitlement
# state, not on what's actually installed in the container it's attached to
# — so it can appear inside a non-Copilot Tool Container and point at the
# wrong CLI. That specific hint is suppressed via
# customizations.vscode.settings in this tool's devcontainer.json where
# applicable; this banner is the general-purpose backstop for any other,
# unrelated source of the same confusion.
if ! grep -q "devcontainer-identity-banner" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-identity-banner
if [[ $- == *i* ]]; then
  echo "── Codex Tool Container ──"
fi
EOF
fi

# Fix ownership on the .codex config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.codex"

# Install Codex CLI via the official installer, exactly as OpenAI's own docs
# invoke it (developers.openai.com/codex/cli) — a plain piped one-liner, not
# a download-then-run wrapper. Checked by binary path, not `command -v` —
# this non-login script's PATH doesn't include ~/.local/bin (the installer
# only adds that to .bashrc, which applies to interactive shells only), so a
# PATH-based check would miss an already-installed binary and re-run the
# network installer on every rebuild.
#
# CODEX_NON_INTERACTIVE=1 is the installer's own documented switch for
# skipping its prompts. Do not swap this for a `</dev/null` redirect on the
# piped `sh`: closing sh's own stdin breaks the curl|sh pipe itself (curl
# gets EPIPE and the install silently no-ops without ever erroring), it
# doesn't just suppress the prompt. A failure here is a warning, not a
# postCreateCommand-aborting error — Codex is optional tooling and shouldn't
# block the rest of setup.
if [ ! -x "$HOME/.local/bin/codex" ]; then
  curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh || echo "Warning: Codex CLI install failed, continuing without it" >&2
fi
