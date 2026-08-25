#!/bin/bash
set -euo pipefail

# Fix ownership on mounted volumes.
# The claude-code devcontainer feature installs as root into the nvm tree;
# hand it back to vscode so the manifest-managed startup update works without
# sudo.
sudo chown -R vscode:vscode /home/vscode/.claude
NVM_NODE_PREFIX=$(npm config get prefix)
sudo chown -R vscode:nvm "${NVM_NODE_PREFIX}/lib/node_modules/@anthropic-ai"
sudo chown vscode:nvm "${NVM_NODE_PREFIX}/bin/claude"

# Git identity — read from .devcontainer/.env (GIT_USER_EMAIL / GIT_USER_NAME).
git config --global credential.helper '!gh auth setup-git'
git config --global user.email "${GIT_USER_EMAIL:-{{GIT_EMAIL_DEFAULT}}}"
git config --global user.name "${GIT_USER_NAME:-{{GIT_NAME_DEFAULT}}}"
