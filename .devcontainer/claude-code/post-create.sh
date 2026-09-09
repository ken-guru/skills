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


# Fix ownership on the mounted Claude config volume, then install Claude
# Code via the official native installer — exactly Anthropic's own
# documented invocation (code.claude.com/docs/en/setup), not npm. Checked by
# binary path, matching install_cli's own idempotency pattern (see
# install-cli-block.sh) — this tool doesn't go through install_cli itself
# because pinning needs a positional `-s <value>` argument to the piped
# `bash`, which install_cli's signature has no way to pass (it only
# forwards `VAR=val` environment arguments, via `env`).
#
# CLAUDE_CODE_VERSION comes from .env, defaulting to "latest": unset or
# "latest" runs the installer's own documented default invocation, which
# auto-updates in the background afterward same as always; any other value
# is passed straight through as the installer's own `-s` argument to pin an
# exact version.
chown_config_volume "$HOME/.claude"

# DISABLE_AUTOUPDATER (from .env — see templates/env.claude-code-block.example)
# is expected to be "1" when CLAUDE_CODE_VERSION is pinned, stopping Claude
# Code's own background auto-updater from silently drifting the pin away
# right after install — a "pinned" version that keeps auto-updating isn't
# actually pinned. Anthropic's own docs (code.claude.com/docs/en/setup,
# "Disable auto-updates") are explicit that this only takes effect inside
# the `env` key of a Claude Code settings file — Claude Code does NOT read
# it from the process/container environment the way it reads, say,
# CLAUDE_CONFIG_DIR. Setting it only via `.env`/`env_file` (as this
# container otherwise does for every other Claude Code env var) is
# therefore not enough on its own: verified live, a version pinned that way
# still auto-updated past the pin on first start.
#
# Writing it to the *user* settings file ($HOME/.claude/settings.json,
# mounted on the config volume) isn't enough either, and re-applying it
# there on every container start isn't a real fix: Claude Code's own
# first-run onboarding (theme selection, notification prompt) overwrites
# that file wholesale rather than merging into it, silently dropping the
# key the moment a developer completes onboarding — confirmed live, pinned
# to 2.1.265, onboarded, and the very next launch was already running a
# silently auto-updated 2.1.266. A reapply on the next container *start*
# can't catch that: onboarding happens interactively inside an
# already-started container, not between starts.
#
# So this writes to the *managed* settings file instead
# (code.claude.com/docs/en/managed-settings) — /etc/claude-code on Linux,
# same as this container's OS. Two properties make it hold where the user
# file doesn't: onboarding is a user-level flow and never touches an
# admin-level file it has no write access to (hence `sudo` below — `/etc`
# isn't vscode-writable, same as this skill's other `sudo`-gated system
# paths), and managed settings apply "above every other level" per
# Anthropic's docs — no user, project, or local value overrides them,
# regardless of write order. Nothing left needs healing after onboarding,
# so unlike the settings.json approach this doesn't need re-applying in
# post-start.sh too.
#
# Per-variable merging within `env` (rather than one selected source
# supplying its whole `env` block) needs Claude Code 2.1.223+ — moot here,
# since a value old enough to predate that is far below anything this
# skill would ever suggest pinning to, and this container only ever writes
# this one `env` key to this one managed-settings source anyway (nothing
# else to merge against).
#
# Merges rather than overwrites since the file may already hold other
# managed policy. Runs on every postCreateCommand, unconditionally on the
# current .env value — not gated behind the install's own
# already-installed check below — so flipping DISABLE_AUTOUPDATER back to
# "false" and rebuilding (the documented way back to always-latest) also
# clears it, not just leaves a stale "1" behind.
managed_settings_file="/etc/claude-code/managed-settings.json"
sudo mkdir -p "$(dirname "$managed_settings_file")"
[ -f "$managed_settings_file" ] || echo '{}' | sudo tee "$managed_settings_file" > /dev/null
if [ "${DISABLE_AUTOUPDATER:-false}" = "1" ]; then
  jq '.env.DISABLE_AUTOUPDATER = "1"' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
else
  jq 'if .env then .env |= del(.DISABLE_AUTOUPDATER) else . end' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
fi

if [ ! -x "$HOME/.local/bin/claude" ]; then
  if [ "${CLAUDE_CODE_VERSION:-latest}" = "latest" ]; then
    curl -fsSL https://claude.ai/install.sh | bash
  else
    curl -fsSL https://claude.ai/install.sh | bash -s "${CLAUDE_CODE_VERSION}"
  fi || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
fi

