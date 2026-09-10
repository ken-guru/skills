# --- Copilot ---
# Fix ownership on the .copilot config volume mount, then install GitHub
# Copilot CLI via the official install script, as GitHub's own install docs
# invoke it. Always installs whatever's current at build time (no pinning
# knob, no staleness-check machinery, matching the other three tools).
#
# Auth: the installed `copilot` CLI picks up this container's GH_TOKEN
# automatically (falling back to OAuth/`gh auth token` if unset), so no
# separate login step is needed here.
#
# COPILOT_AUTO_UPDATE=false disables the CLI's own background self-update
# check, which otherwise throws on startup ("Error auto updating: TypeError:
# Invalid Version: latest") — a fixed, non-user-configurable value (not a
# secret, so it doesn't belong in .env), exported here rather than in
# devcontainer.json's containerEnv since that file is base-owned.
chown_config_volume "$HOME/.copilot"
install_cli "Copilot" "$HOME/.local/bin/copilot" "https://gh.io/copilot-install" bash
cat >> ~/.bashrc << 'EOF'
export COPILOT_AUTO_UPDATE=false
EOF
