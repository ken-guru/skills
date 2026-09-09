# Fix ownership on the .copilot config volume mount, then install GitHub
# Copilot CLI via the official install script, as GitHub's own install docs
# invoke it. Always installs whatever's current at build time (VERSION left
# unset, matching the other three tools — no pinning knob, no
# staleness-check machinery); the compose fragment separately sets
# COPILOT_AUTO_UPDATE=false so this installed version doesn't silently drift
# out from under a rebuild via the CLI's own self-update.
#
# A version-pinning feature (mirroring Claude Code's, see
# claude-code/post-create-block.sh) was already built here once and
# reverted five days later: pinning combined with Copilot's own background
# self-update crashed on startup ("Error auto updating: TypeError: Invalid
# Version: latest"). COPILOT_AUTO_UPDATE=false above ships regardless, for
# that same self-update instability — that may or may not avoid the same
# crash if pinning were re-attempted under it; that's untested, and this
# repo doesn't offer Copilot pinning today. Don't re-add it on a docs read
# alone — confirm against an actual container build first.
#
# Auth: the installed `copilot` CLI picks up this container's GH_TOKEN
# automatically (falling back to OAuth/`gh auth token` if unset), so no
# separate login step is needed here.
chown_config_volume "$HOME/.copilot"
install_cli "Copilot" "$HOME/.local/bin/copilot" "https://gh.io/copilot-install" bash
