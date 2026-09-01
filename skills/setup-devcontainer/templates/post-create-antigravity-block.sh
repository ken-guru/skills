# Fix ownership on the .gemini config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.gemini"

# Install Antigravity CLI via the official bootstrapper. Checked by binary
# path, not `command -v` — this non-login script's PATH doesn't include
# ~/.local/bin, so a PATH-based check would miss an already-installed binary
# and redownload it on every rebuild. Use the upstream installer rather than
# hand-rolling the download: it resolves the current release through a
# manifest instead of a fixed URL (a hardcoded
# storage.googleapis.com/antigravity-cli/... URL 404s once the release
# layout moves), verifies a SHA512 checksum, and already no-ops if the binary
# exists. Antigravity is optional tooling, so a download/install failure here
# is a warning, not a postCreateCommand-aborting error.
if [ ! -x "$HOME/.local/bin/agy" ]; then
  curl -fsSL https://antigravity.google/cli/install.sh | sh || echo "Warning: Antigravity CLI install failed, continuing without it" >&2
fi
