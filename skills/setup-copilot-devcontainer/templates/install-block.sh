# --- Copilot ---
# Fix ownership on the .copilot config volume mount, then install GitHub
# Copilot CLI via the official install script, as GitHub's own install docs
# invoke it. Always installs whatever's current at build time (no pinning
# knob, no staleness-check machinery, matching the other three tools).
#
# Auth: Copilot reads COPILOT_GITHUB_TOKEN first, then GH_TOKEN, from
# .devcontainer/.env via bash-env.sh. Only a personal-owned fine-grained PAT
# with the Copilot Requests permission works, so an org-scoped GH_TOKEN
# won't. See the "# --- Copilot token ---" block in .env.example.
#
# COPILOT_AUTO_UPDATE=false disables the CLI's own background self-update
# check, which otherwise throws on startup ("Error auto updating: TypeError:
# Invalid Version: latest") — a fixed, non-user-configurable value (not a
# secret, so it doesn't belong in .env), exported here rather than in
# devcontainer.json's containerEnv since that file is base-owned.
#
# Runs once, here in post-create.sh (container creation), not on every
# start — and only if the binary isn't already installed.
chown_config_volume "$HOME/.copilot"
install_cli "Copilot" "$HOME/.local/bin/copilot" "https://gh.io/copilot-install" bash
if ! grep -q "devcontainer-copilot-auto-update" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-copilot-auto-update
export COPILOT_AUTO_UPDATE=false
EOF
fi
