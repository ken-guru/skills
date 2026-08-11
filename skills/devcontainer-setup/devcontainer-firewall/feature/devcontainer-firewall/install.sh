#!/bin/bash
# devcontainer-firewall Feature install script. Runs as root during
# `docker build`, before any firewall this Feature itself will later
# enforce exists -- the one safe time to install its own dependencies.
# Installs OS packages only; the actual firewall scripts are ordinary
# project-source files under this Feature's own files/ directory, reachable
# at runtime through the workspace bind mount, so nothing needs copying
# anywhere here.

set -euo pipefail

apt-get update
apt-get install -y --no-install-recommends \
    iptables \
    ipset \
    jq \
    dnsutils \
    curl
rm -rf /var/lib/apt/lists/*
