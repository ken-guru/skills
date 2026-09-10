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

# Mechanical install skeleton shared by every Tool Container flavor:
# chown_config_volume fixes the per-tool config volume's ownership (Docker
# creates a fresh named-volume mountpoint root:root regardless of the
# parent directory's ownership, even under /home/vscode) — every tool uses
# this. install_cli runs a curl-piped installer exactly once — only
# Antigravity's post-create-block.sh still calls it; install_npm_cli runs
# an `npm install -g` instead, used by Claude Code, Codex, and Copilot (see
# each tool's own post-create-block.sh) — Claude Code was the pilot for
# #234, extended to the other two once it held up, at which point the
# repeated latest-vs-pinned shape across all three earned this helper
# (initially inlined per-file, deliberately not factored out until a third
# caller proved the shape wasn't Claude-Code-specific). Antigravity has no
# npm/Homebrew/apt package to swap to (confirmed by #232's research), so it
# stays on install_cli.
#
# install_cli checks by binary path, not `command -v` — this non-login
# script's PATH doesn't include ~/.local/bin, so a PATH-based check would
# miss an already-installed binary and re-run the network installer on every
# rebuild. A failed install is a warning, not a postCreateCommand-aborting
# error: every CLI installed this way is optional tooling and shouldn't
# block the rest of setup. The `env "$@"` forwarding exists for extra
# `VAR=val` arguments a future curl|bash installer might need (Codex's
# now-removed CODEX_NON_INTERACTIVE=1 was the original case) — passed via
# `env`, not a `</dev/null` redirect or subshell wrapper, so they don't
# disturb the piped command's own stdin.
#
# install_npm_cli takes the same failed-install-is-a-warning posture as
# install_cli, but doesn't need install_cli's binary-path existence check —
# `npm install -g` is idempotent on its own (a no-op if already at the
# requested version). `version` is the caller's already-`:-latest`-defaulted
# `_VERSION` env var (e.g. `CLAUDE_CODE_VERSION`): "latest" installs npm's
# own `latest` dist-tag; anything else pins via npm's `@<version>` syntax.
# Extra args (Claude Code's `--allow-scripts=@anthropic-ai/claude-code` —
# npm's allowScripts gate blocks that package's postinstall, which
# downloads its actual native binary, unless explicitly allowed) are
# forwarded positionally to `npm install -g`, before the package name.
#
# Antigravity's installer already verifies a checksum or signed digest of
# what it downloads before installing — unconditionally, not only when a
# version happens to be pinned: SHA512 vs. a signed manifest, halting the
# install on mismatch. None of this is visible from this shared
# `curl | shell` shape alone — see README.baseline.md's "CLI installer
# notes" section for the reader-facing version of this fact, kept here too
# since that's what a maintainer editing this file actually needs to know
# before assuming the pattern below is unverified. Claude Code, Codex, and
# Copilot no longer go through this shared curl|bash skeleton at all (see
# above) — their integrity model is npm's registry signature (plus, for
# Codex, SLSA provenance) instead, documented in each tool's own
# post-create-block.sh.
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

install_npm_cli() {
  local label="$1" package="$2" version="$3"
  shift 3
  if [ "$version" = "latest" ]; then
    sudo npm install -g "$@" "$package" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  else
    sudo npm install -g "$@" "${package}@${version}" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  fi
}

# Fix ownership on the mounted Claude config volume, then install Claude
# Code via npm (install_npm_cli, see install-cli-block.sh) — a vendor-
# signed distribution channel (npm registry signatures), replacing the
# native curl|bash installer Antigravity still uses. Was the pilot for
# #234, since extended to Codex and Copilot; Antigravity wasn't, since no
# npm/Homebrew/apt package exists for it.
#
# npm's global install location isn't vscode-writable by default (confirmed
# live: EACCES on /usr/lib/node_modules) — hence install_npm_cli's `sudo`,
# consistent with this skill's other privileged-path writes.
# `--allow-scripts=@anthropic-ai/claude-code` is required every run: npm's
# allowScripts gate blocks this package's postinstall (which downloads the
# actual native binary) unless explicitly allowed — without it, `claude`
# installs as a broken shim with no binary behind it (confirmed live).
#
# CLAUDE_CODE_VERSION (from .env) defaults to "latest": unset or "latest"
# installs npm's own `latest` dist-tag, which self-updates in the
# background afterward same as today's behavior. Any other value pins an
# exact version via npm's own `@<version>` syntax.
chown_config_volume "$HOME/.claude"

# DISABLE_UPDATES (not DISABLE_AUTOUPDATER — this repo tried and reverted
# that weaker setting three times over three different delivery mechanisms;
# see README's "CLI installer notes" for the full failure history) is
# written into Claude Code's *managed* settings file whenever a version is
# pinned. Anthropic's docs (code.claude.com/docs/en/setup, "Disable
# auto-updates") describe DISABLE_UPDATES as blocking every update path,
# broader than DISABLE_AUTOUPDATER, which only stops the background check —
# the gap that let a pinned version silently drift past its pin three times
# running. Managed settings (/etc/claude-code/managed-settings.json) apply
# "above every other level," and onboarding has no write access to them —
# the one property that let DISABLE_AUTOUPDATER's own managed-settings
# attempt survive onboarding, even though that attempt still didn't stop
# every update path.
#
# Verified live: immediately after a pinned install, `claude doctor`
# reports `Auto-updates: disabled (set by env: DISABLE_UPDATES)` and `Last
# update attempt: none recorded` — and both still hold from a fresh
# container start against a filesystem snapshot taken right after install,
# the same "next launch" moment where the DISABLE_AUTOUPDATER-based attempt
# silently lost its pin. Not a guarantee against every future Claude Code
# release, but the strongest evidence this repo has collected across four
# attempts — the first three never got a self-reported confirmation this
# direct, only a settings-file presence check.
#
# Merges rather than overwrites since the file may already hold other
# managed policy. Runs on every postCreateCommand, unconditionally on the
# current .env value, so flipping CLAUDE_CODE_VERSION back to "latest" and
# rebuilding also clears this key, not just leaves a stale "1" behind.
managed_settings_file="/etc/claude-code/managed-settings.json"
sudo mkdir -p "$(dirname "$managed_settings_file")"
[ -f "$managed_settings_file" ] || echo '{}' | sudo tee "$managed_settings_file" > /dev/null
if [ "${CLAUDE_CODE_VERSION:-latest}" != "latest" ]; then
  jq '.env.DISABLE_UPDATES = "1"' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
else
  jq 'if .env then .env |= del(.DISABLE_UPDATES) else . end' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
fi

install_npm_cli "Claude Code" "@anthropic-ai/claude-code" "${CLAUDE_CODE_VERSION:-latest}" "--allow-scripts=@anthropic-ai/claude-code"

