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

# Mechanical install skeleton shared by every Tool Container flavor: fix the
# per-tool config volume's ownership (Docker creates a fresh named-volume
# mountpoint root:root regardless of the parent directory's ownership, even
# under /home/vscode), then run a curl-piped installer exactly once. Each
# tool's own post-create-block.sh calls these two functions and keeps only
# the rationale that's genuinely tool-specific (see there for it).
#
# install_cli checks by binary path, not `command -v` — this non-login
# script's PATH doesn't include ~/.local/bin, so a PATH-based check would
# miss an already-installed binary and re-run the network installer on every
# rebuild. A failed install is a warning, not a postCreateCommand-aborting
# error: every CLI installed this way is optional tooling and shouldn't
# block the rest of setup. Extra `VAR=val` arguments (Codex's
# CODEX_NON_INTERACTIVE=1) are passed to the piped shell via `env`, not a
# `</dev/null` redirect or subshell wrapper, so they don't disturb the piped
# command's own stdin — see codex/post-create-block.sh for why that
# distinction matters.
#
# Every one of these four vendor installers already verifies a checksum or
# signed digest of what it downloads before installing — unconditionally,
# not only when a version happens to be pinned: Claude Code (SHA256 vs. a
# GPG-signed manifest), Codex (SHA256 digest vs. GitHub release metadata),
# Antigravity (SHA512 vs. a signed manifest, halting the install on
# mismatch), Copilot (SHA256SUMS.txt, downloaded and checked for whichever
# release resolves, a hard failure on mismatch). None of this is visible
# from this shared `curl | shell` shape alone — see README.baseline.md's
# "CLI installer notes" section for the reader-facing version of this fact,
# kept here too since that's what a maintainer editing this file actually
# needs to know before assuming the pattern below is unverified.
chown_config_volume() {
  sudo chown -R vscode:vscode "$1"
}

install_cli() {
  local label="$1" bin_path="$2" url="$3" shell_bin="$4"
  shift 4
  if [ ! -x "$bin_path" ]; then
    curl -fsSL "$url" | env "$@" "$shell_bin" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  fi
}

# Fix ownership on the .codex config volume mount, then install Codex CLI
# via the official installer, exactly as OpenAI's own docs invoke it
# (developers.openai.com/codex/cli).
#
# CODEX_NON_INTERACTIVE=1 is the installer's own documented switch for
# skipping its prompts, passed through install_cli's `env` wrapper rather
# than a `</dev/null` redirect on the piped `sh`: closing sh's own stdin
# breaks the curl|sh pipe itself (curl gets EPIPE and the install silently
# no-ops without ever erroring), it doesn't just suppress the prompt.
#
# The installer script also accepts an undocumented CODEX_RELEASE=<version> pin (confirmed by reading the live script); left unadopted as an unpublished vendor interface.
chown_config_volume "$HOME/.codex"
install_cli "Codex" "$HOME/.local/bin/codex" "https://chatgpt.com/codex/install.sh" sh CODEX_NON_INTERACTIVE=1

