
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
