#!/bin/bash
# devcontainer-agentic-clis Feature install script. Runs as root during
# `docker build`, before any firewall exists -- the safe time for the
# network access every `npm install` below needs.
#
# Requires Node.js/npm already present on the base image (via
# devcontainer-scaffold or otherwise). This Skill installs CLI binaries
# and MCP servers; it does not install a JavaScript runtime for itself,
# since that's a general build-ordering concern devcontainer-scaffold
# already owns.

set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm not found. devcontainer-agentic-clis needs a Node.js-capable base image; add Node.js to your Dockerfile (devcontainer-scaffold's own build-time package-install step is the right place) before installing this Feature." >&2
    exit 1
fi

apt-get update
apt-get install -y --no-install-recommends jq
rm -rf /var/lib/apt/lists/*

# npm's default global-install prefix is root-owned; repoint it under the
# non-root user's home directory before any `npm install -g`, and mirror
# PATH into /etc/profile.d so it survives login shells too -- Debian and
# Ubuntu's own /etc/profile resets PATH unconditionally for non-root login
# shells, discarding whatever ENV PATH a Dockerfile RUN layer set. Moved
# here from devcontainer-scaffold: this is the only Skill that actually
# installs npm-based CLIs, so it's the only one that needs this fix.
USER_HOME="${_REMOTE_USER_HOME:-$HOME}"
USER_NAME="${_REMOTE_USER:-$(id -un)}"
NPM_GLOBAL_DIR="$USER_HOME/.npm-global"
mkdir -p "$NPM_GLOBAL_DIR"
chown -R "$USER_NAME:$USER_NAME" "$NPM_GLOBAL_DIR" 2>/dev/null || true
export NPM_CONFIG_PREFIX="$NPM_GLOBAL_DIR"
export PATH="$NPM_GLOBAL_DIR/bin:$PATH"
{
    echo "export NPM_CONFIG_PREFIX=$NPM_GLOBAL_DIR"
    echo "export PATH=$NPM_GLOBAL_DIR/bin:\$PATH"
} > /etc/profile.d/devcontainer-agentic-clis-npm-path.sh
chmod +x /etc/profile.d/devcontainer-agentic-clis-npm-path.sh

# CLI binaries to install globally. Replace with your project's own list --
# these install as a plain, one-time `npm install -g` at build time, not
# through the staged-install mechanism below: a CLI binary has no MCP
# protocol handshake to verify, and re-running the build is already how
# this suite expects a baseline to be refreshed.
CLI_PACKAGES=(
    "@anthropic-ai/claude-code"
    # "@openai/codex"
    # "@google/gemini-cli"
)
for package in "${CLI_PACKAGES[@]}"; do
    echo "Installing $package globally..."
    # Feature install.sh runs as root, but the installed CLI must be usable
    # and upgradeable by the configured non-root runtime user.
    su - "$USER_NAME" -s /bin/bash -c \
        "NPM_CONFIG_PREFIX=$(printf '%q' "$NPM_GLOBAL_DIR") PATH=$(printf '%q' "$NPM_GLOBAL_DIR/bin:$PATH") npm install -g $(printf '%q' "$package")"
done

# Baseline-install every MCP server listed in the manifest (copied from
# mcp-servers.manifest.example.json), via stage/verify/atomic-swap -- see
# staged-install-handshake-atomic-swap.sh for what "install" actually does.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MANIFEST="$SCRIPT_DIR/files/mcp-servers.manifest.json"
if [ -f "$MANIFEST" ]; then
    while read -r key; do
        echo "Installing MCP server: $key..."
        su - "$USER_NAME" -s /bin/bash -c \
            "HOME=$(printf '%q' "$USER_HOME") MCP_MANIFEST=$(printf '%q' "$MANIFEST") MCP_INSTALL_ROOT=$(printf '%q' "$USER_HOME/.local/share/devcontainer-agentic-clis-mcp") bash $(printf '%q' "$SCRIPT_DIR/files/staged-install-handshake-atomic-swap.sh") install $(printf '%q' "$key")"
    done < <(jq -r '.servers | keys[]' "$MANIFEST")
else
    echo "No mcp-servers.manifest.json found -- copy mcp-servers.manifest.example.json and fill it in to install MCP servers." >&2
fi
