
# Fix ownership on the .antigravity config volume mount, then install
# Antigravity CLI via the official installer — its own shebang (#!/bin/bash)
# is why this pipes into `bash`, not `sh`.
#
# A prior version of this block hand-rolled architecture detection and
# downloaded a tarball directly from a storage.googleapis.com URL that has
# since gone stale (confirmed 404 in practice) — the official installer
# handles detection, download, and idempotency itself, so there's nothing
# left for this script to duplicate.
chown_config_volume "$HOME/.antigravity"
install_cli "Antigravity" "$HOME/.local/bin/agy" "https://antigravity.google/cli/install.sh" bash
