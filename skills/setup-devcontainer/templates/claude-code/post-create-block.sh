
# Fix ownership on the mounted Claude config volume — Docker creates a fresh
# named-volume mountpoint root:root regardless of the parent directory's
# ownership, even under /home/vscode.
sudo chown -R vscode:vscode /home/vscode/.claude

# Install Claude Code CLI. Checked by binary path, not `command -v` — this
# non-login script's PATH doesn't necessarily include npm's global bin dir in
# every base image, so a PATH-based check could miss an already-installed
# binary and re-run the installer on every rebuild.
if ! [ -x "$(npm config get prefix)/bin/claude" ]; then
  npm install -g @anthropic-ai/claude-code
fi
