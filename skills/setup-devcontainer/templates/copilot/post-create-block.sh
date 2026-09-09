
# Fix ownership on the .copilot config volume mount, then install GitHub
# Copilot CLI via the official install script, as GitHub's own install docs
# invoke it. Always installs whatever's current at build time (VERSION left
# unset, matching the other three tools — no pinning knob, no
# staleness-check machinery); the compose fragment separately sets
# COPILOT_AUTO_UPDATE=false so this installed version doesn't silently drift
# out from under a rebuild via the CLI's own self-update.
#
# Auth: the installed `copilot` CLI picks up this container's GH_TOKEN
# automatically (falling back to OAuth/`gh auth token` if unset), so no
# separate login step is needed here.
chown_config_volume "$HOME/.copilot"
install_cli "Copilot" "$HOME/.local/bin/copilot" "https://gh.io/copilot-install" bash
