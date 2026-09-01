
# Fix ownership on the .antigravity config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.antigravity"

# Install Antigravity CLI via the official installer, as a plain piped
# one-liner rather than a download-then-run wrapper — its own shebang
# (#!/bin/bash) is why this pipes into `bash`, not `sh`. Checked by binary
# path, not `command -v` — this non-login script's PATH doesn't include
# ~/.local/bin, so a PATH-based check would miss an already-installed binary
# and re-run the installer on every rebuild. Antigravity is optional
# tooling, so a download/install failure here is a warning, not a
# postCreateCommand-aborting error.
#
# A prior version of this block hand-rolled architecture detection and
# downloaded a tarball directly from a storage.googleapis.com URL that has
# since gone stale (confirmed 404 in practice) — the official installer
# handles detection, download, and idempotency itself, so there's nothing
# left for this script to duplicate.
if [ ! -x "$HOME/.local/bin/agy" ]; then
  curl -fsSL https://antigravity.google/cli/install.sh | bash || echo "Warning: Antigravity CLI install failed, continuing without it" >&2
fi
