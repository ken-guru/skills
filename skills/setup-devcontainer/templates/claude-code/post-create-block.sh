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
