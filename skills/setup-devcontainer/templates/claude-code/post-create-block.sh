
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
# exact version. When pinned, DISABLE_AUTOUPDATER (also from .env — see
# templates/env.claude-code-block.example) is expected to be "1", stopping
# Claude Code's own background auto-updater from silently drifting the pin
# away right after install — a "pinned" version that keeps auto-updating
# isn't actually pinned.
chown_config_volume "$HOME/.claude"
if [ ! -x "$HOME/.local/bin/claude" ]; then
  if [ "${CLAUDE_CODE_VERSION:-latest}" = "latest" ]; then
    curl -fsSL https://claude.ai/install.sh | bash
  else
    curl -fsSL https://claude.ai/install.sh | bash -s "${CLAUDE_CODE_VERSION}"
  fi || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
fi
