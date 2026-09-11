# --- Claude Code ---
# Fix ownership on the mounted Claude config volume, then install Claude
# Code via the official native installer — exactly Anthropic's own
# documented invocation (code.claude.com/docs/en/quickstart), not npm. The
# native install auto-updates in the background and is what Anthropic's own
# docs lead with; installs to ~/.local/bin/claude, matching the same
# binary-path idempotency-check pattern install_cli uses for every tool
# (see the base skill's install-cli-block.sh).
chown_config_volume "$HOME/.claude"
install_cli "Claude Code" "$HOME/.local/bin/claude" "https://claude.ai/install.sh" bash
