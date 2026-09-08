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
  echo "── Claude Code Tool Container ──"
fi
EOF
fi

# Fix ownership on the mounted Claude config volume — Docker creates a fresh
# named-volume mountpoint root:root regardless of the parent directory's
# ownership, even under /home/vscode.
sudo chown -R vscode:vscode /home/vscode/.claude

# Install Claude Code via the official native installer, as a plain piped
# one-liner rather than a download-then-run wrapper — this is exactly
# Anthropic's own documented invocation
# (code.claude.com/docs/en/quickstart), not npm. The native install auto-
# updates in the background and is what Anthropic's own docs lead with;
# installs to ~/.local/bin/claude, matching the same binary-path
# idempotency-check pattern already used for Codex/Antigravity/Copilot.
# Checked by binary path, not `command -v` — this non-login script's PATH
# doesn't include ~/.local/bin, so a PATH-based check would miss an already-
# installed binary and re-run the installer on every rebuild. A failure here
# is a warning, not a postCreateCommand-aborting error, matching the other
# three tools' pattern.
if [ ! -x "$HOME/.local/bin/claude" ]; then
  curl -fsSL https://claude.ai/install.sh | bash || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
fi
