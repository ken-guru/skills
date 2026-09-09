
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
# the `env` key of Claude Code's own settings.json — Claude Code does NOT
# read it from the process/container environment the way it reads, say,
# CLAUDE_CONFIG_DIR. Setting it only via `.env`/`env_file` (as this
# container otherwise does for every other Claude Code env var) is
# therefore not enough on its own: verified live, a version pinned that way
# still auto-updated past the pin on first start. So this writes it
# directly into settings.json here, merging rather than overwriting since
# the file may already hold other keys (and persists across rebuilds on the
# mounted config volume). Runs on every postCreateCommand, unconditionally
# on the current .env value — not gated behind the install's own
# already-installed check below — so flipping DISABLE_AUTOUPDATER back to
# "false" and rebuilding (the documented way back to always-latest) also
# clears it from settings.json, not just leaves a stale "1" behind.
settings_file="$HOME/.claude/settings.json"
[ -f "$settings_file" ] || echo '{}' > "$settings_file"
if [ "${DISABLE_AUTOUPDATER:-false}" = "1" ]; then
  jq '.env.DISABLE_AUTOUPDATER = "1"' "$settings_file" > "$settings_file.tmp" && mv "$settings_file.tmp" "$settings_file"
else
  jq 'if .env then .env |= del(.DISABLE_AUTOUPDATER) else . end' "$settings_file" > "$settings_file.tmp" && mv "$settings_file.tmp" "$settings_file"
fi

if [ ! -x "$HOME/.local/bin/claude" ]; then
  if [ "${CLAUDE_CODE_VERSION:-latest}" = "latest" ]; then
    curl -fsSL https://claude.ai/install.sh | bash
  else
    curl -fsSL https://claude.ai/install.sh | bash -s "${CLAUDE_CODE_VERSION}"
  fi || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
fi
