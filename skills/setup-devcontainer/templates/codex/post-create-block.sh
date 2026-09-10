# Fix ownership on the .codex config volume mount, then install Codex CLI
# via npm — a vendor-signed distribution channel (npm registry signatures
# + SLSA provenance, the strongest integrity evidence of any of the four
# vendors researched for #232), replacing the curl|bash installer. Extended
# here from Claude Code's pilot (#234) since that one held.
#
# Unlike Claude Code, `codex doctor` self-reports no background
# auto-updater at all — Codex only updates via the explicit `codex update`
# subcommand, never silently. Confirmed live: a version pinned via npm's
# own `@<version>` syntax holds with no extra auto-update-disable setting
# needed, across a fresh container start against a filesystem snapshot
# taken right after install — no `DISABLE_UPDATES`-equivalent required.
#
# CODEX_VERSION (from .env) defaults to "latest": unset or "latest"
# installs npm's own `latest` dist-tag; any other value pins an exact
# version via npm's own `@<version>` syntax. Codex's own installer accepted
# an undocumented CODEX_RELEASE=<version> pin lever too (confirmed by
# reading the live script when this tool still used curl|bash) — moot now
# that npm's documented, vendor-signed version pin covers the same need.
chown_config_volume "$HOME/.codex"
install_npm_cli "Codex" "@openai/codex" "${CODEX_VERSION:-latest}"
