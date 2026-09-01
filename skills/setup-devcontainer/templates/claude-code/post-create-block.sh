
# Fix ownership on the mounted Claude config volume — Docker creates a fresh
# named-volume mountpoint root:root regardless of the parent directory's
# ownership, even under /home/vscode.
sudo chown -R vscode:vscode /home/vscode/.claude

# Install Claude Code via the official native installer
# (code.claude.com/docs/en/quickstart's recommended method), not npm — the
# native install auto-updates in the background and is what Anthropic's own
# docs lead with; installs to ~/.local/bin/claude, matching the same binary-
# path idempotency-check pattern already used for Codex/Antigravity/Copilot.
# Checked by binary path, not `command -v` — this non-login script's PATH
# doesn't include ~/.local/bin, so a PATH-based check would miss an already-
# installed binary and re-run the installer on every rebuild. A failure here
# is a warning, not a postCreateCommand-aborting error, matching the other
# three tools' pattern.
if [ ! -x "$HOME/.local/bin/claude" ]; then
  tmpscript=$(mktemp)
  (
    curl -fsSL https://claude.ai/install.sh -o "$tmpscript" &&
    bash "$tmpscript" </dev/null
  ) || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
  rm -f "$tmpscript"
fi
