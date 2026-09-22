# --- Antigravity ---
# Fix ownership on the .gemini config volume mount (where agy actually
# reads/writes settings and skills — see SKILL.md's Security & Trust section;
# ~/.antigravity is never touched by either the installer or agy itself),
# then install Antigravity CLI via the official installer — its own shebang
# (#!/bin/bash) is why this pipes into `bash`, not `sh`.
#
# A prior version of this block hand-rolled architecture detection and
# downloaded a tarball directly from a storage.googleapis.com URL that has
# since gone stale (confirmed 404 in practice) — the official installer
# handles detection, download, and idempotency itself, so there's nothing
# left for this script to duplicate.
#
# Runs once, here in post-create.sh (container creation), not on every
# start — and only if the binary isn't already installed.
chown_config_volume "$HOME/.gemini"
install_cli "Antigravity" "$HOME/.local/bin/agy" "https://antigravity.google/cli/install.sh" bash
