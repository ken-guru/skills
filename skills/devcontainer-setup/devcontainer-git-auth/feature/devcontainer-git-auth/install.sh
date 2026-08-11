#!/bin/bash
# devcontainer-git-auth Feature install script. Runs as root during
# `docker build`, before any firewall exists -- the safe time for the
# network access installing the gh CLI from its own apt repository needs.
#
# Key generation itself does NOT happen here: the deploy key and signing
# key must be written into the SSH named volume this Feature's own
# devcontainer-feature.json mounts, and that volume doesn't exist yet
# during the image build -- only once the container actually starts. See
# files/setup-keys.sh, this Feature's postCreateCommand.

set -euo pipefail

apt-get update
apt-get install -y --no-install-recommends jq openssh-client
rm -rf /var/lib/apt/lists/*

if command -v gh >/dev/null 2>&1; then
    echo "gh CLI already present, skipping install."
else
    apt-get update
    apt-get install -y --no-install-recommends wget
    mkdir -p -m 755 /etc/apt/keyrings
    out=$(mktemp)
    wget -nv -O "$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg
    cat "$out" > /etc/apt/keyrings/githubcli-archive-keyring.gpg
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
    mkdir -p -m 755 /etc/apt/sources.list.d
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list
    apt-get update
    apt-get install -y --no-install-recommends gh
    rm -rf /var/lib/apt/lists/*
fi

# Pre-create and chown the SSH directory this Feature's own named volume
# (declared in devcontainer-feature.json's mounts) will attach to. Same
# reasoning as devcontainer-scaffold's own non-root-user block: a named
# volume's first mount copies ownership from whatever already exists at
# that exact path; if nothing exists there, Docker creates it as root, and
# ssh-keygen fails with a permission error the first time setup-keys.sh
# runs as the non-root user. This Skill declares its own volume (rather
# than relying on devcontainer-scaffold to have anticipated it) per the
# Retrofit Contract -- it must work even retrofitted onto a devcontainer
# this suite never scaffolded.
USER_HOME="${_REMOTE_USER_HOME:-$HOME}"
USER_NAME="${_REMOTE_USER:-$(id -un)}"
mkdir -p "$USER_HOME/.ssh"
chmod 700 "$USER_HOME/.ssh"
chown -R "$USER_NAME" "$USER_HOME/.ssh" 2>/dev/null || true
