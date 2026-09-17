# Shared devcontainer image. One container for every selected AI CLI —
# each CLI skill installs its own tool at container-create time (postCreateCommand),
# not here, so this Dockerfile never changes when a CLI is added or removed.
#
# Multi-stage: `base` is the plain image; `firewall` extends it with the
# opt-in network-egress-firewall packages (ADR-0005). Both stages live in
# this one file so the shared Node.js/GitHub-CLI/user-setup steps below are
# never duplicated — devcontainer.json's `build.target` selects which stage
# actually gets built ("base" by default, "firewall" when the firewall
# question was answered yes), so this Dockerfile itself never needs to
# change or be swapped for a different file to add or drop the firewall.
#
# Digest-pinned per ADR-0004 (skills/setup-devcontainer/docs/adr/0004-digest-pin-base-image-reject-docker-hardened-images.md)
# so this build is reproducible and immune to silent upstream content drift.
# Dependabot (.github/dependabot.yml, docker ecosystem) opens a PR whenever a
# newer digest is published for the `ubuntu` tag; a weekly CI job
# (.github/workflows/setup-devcontainer-image-scan.yml) CVE-scans the pinned
# digest. If Dependabot is ever paused, refresh manually with:
#   docker buildx imagetools inspect mcr.microsoft.com/devcontainers/base:ubuntu
# and replace the sha256 below with the reported (multi-arch index) digest.
FROM mcr.microsoft.com/devcontainers/base:ubuntu@sha256:edfb983aab9c579a385dc23c57d7d3703f5ec920124d99c16204a2cac465aab4 AS base

# Node.js — none of the AI CLIs need this themselves (all install as native
# binaries), but it's kept as a general-purpose amenity for repos whose own
# project code is JS/TS. npm is bumped to current right after install since
# nodesource's bundled npm lags behind — otherwise every fresh terminal nags
# with npm's own "New major version available" update-notifier the first
# time npm runs. NPM_CONFIG_UPDATE_NOTIFIER=false is kept as a permanent
# guard on top of the bump, so that notice can't resurface just because this
# image goes stale between rebuilds.
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g npm@latest \
    && rm -rf /var/lib/apt/lists/*
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# GitHub CLI — used for auth (GH_TOKEN) and, when the SSH layer is enabled,
# deploy-key/signing-key registration.
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && out=$(mktemp) \
    && wget -nv -O "$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    && cat "$out" | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# The base image's non-root user is already `vscode` at UID/GID 1000:1000 —
# pin it explicitly rather than relying on that staying true upstream.
RUN if ! id vscode >/dev/null 2>&1; then \
      groupadd --gid 1000 vscode && \
      useradd --uid 1000 --gid 1000 -m -s /bin/bash vscode; \
    fi

USER vscode

# ---------------------------------------------------------------------------
# firewall: only built when devcontainer.json's build.target is set to
# "firewall" (the opt-in network egress firewall, ADR-0005). Declining the
# firewall question keeps `target: "base"`, so none of this is ever built or
# present — no image-size/surface cost for a container that doesn't want it.
FROM base AS firewall

USER root

# iptables/ipset plus the tools init-firewall.sh/refresh-allowlist.sh need to
# build and refresh the allowlist (dig for DNS resolution, aggregate to
# collapse GitHub's CIDR list). jq is already provided by the base image.
RUN apt-get update && apt-get install -y --no-install-recommends \
      iptables ipset iproute2 dnsutils aggregate \
    && rm -rf /var/lib/apt/lists/*

# init-firewall.sh/refresh-allowlist.sh (generated into .devcontainer/, the
# bind-mounted workspace — not baked into this image, so a Network Manifest
# or allowed-domains.local.txt edit is picked up without a rebuild) must run
# as root: iptables/ipset need it, and the corresponding CAP_NET_ADMIN/
# CAP_NET_RAW capabilities are granted separately via runArgs (see
# devcontainer.json). This NOPASSWD grant is scoped to exactly those two
# script paths, nothing broader, and baked in here at image build time — not
# written by post-create.sh — so it can't be silently skipped by a lifecycle
# script failing partway through. Mirrors Anthropic's own reference
# devcontainer's approach of baking this into the Dockerfile rather than
# granting it at runtime.
#
# `sudo`'s default env_reset strips every custom env var, including
# refresh-allowlist.sh's own FIREWALL_REFRESH_INTERVAL override — without
# env_keep it silently always falls back to that script's 300s default no
# matter what a repo sets in .env. Scoped to exactly this one variable, for
# exactly the vscode user, not a blanket env passthrough.
RUN { echo 'Defaults:vscode env_keep += "FIREWALL_REFRESH_INTERVAL"'; \
      echo 'vscode ALL=(root) NOPASSWD: /workspace/.devcontainer/init-firewall.sh, /workspace/.devcontainer/refresh-allowlist.sh'; } \
      > /etc/sudoers.d/vscode-firewall \
    && chmod 0440 /etc/sudoers.d/vscode-firewall

USER vscode
