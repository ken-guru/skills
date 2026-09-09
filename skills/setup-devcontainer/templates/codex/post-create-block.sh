
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
# The installer script also accepts an undocumented CODEX_RELEASE=<version>
# (or --release VERSION) to pin an exact release, verified with a real
# SHA256 digest check against GitHub release metadata — confirmed by
# reading the live script directly, not by any OpenAI documentation, which
# doesn't mention it anywhere public. Left unadopted: depending on an
# unpublished vendor interface risks silent breakage if it ever changes,
# with no deprecation notice to catch it — and unlike Claude Code's
# documented pin (see claude-code/post-create-block.sh), the security
# payoff here is smaller anyway, since this installer already checksum-
# verifies regardless of pinning. Worth revisiting if OpenAI documents it.
chown_config_volume "$HOME/.codex"
install_cli "Codex" "$HOME/.local/bin/codex" "https://chatgpt.com/codex/install.sh" sh CODEX_NON_INTERACTIVE=1
