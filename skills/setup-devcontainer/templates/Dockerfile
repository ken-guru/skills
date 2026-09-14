# Shared devcontainer image. One container for every selected AI CLI —
# each CLI skill installs its own tool at container-create time (postCreateCommand),
# not here, so this Dockerfile never changes when a CLI is added or removed.
#
# Digest-pinned per ADR-0004 (skills/setup-devcontainer/docs/adr/0004-digest-pin-base-image-reject-docker-hardened-images.md)
# so this build is reproducible and immune to silent upstream content drift.
# Dependabot (.github/dependabot.yml, docker ecosystem) opens a PR whenever a
# newer digest is published for the `ubuntu` tag; a weekly CI job
# (.github/workflows/setup-devcontainer-image-scan.yml) CVE-scans the pinned
# digest. If Dependabot is ever paused, refresh manually with:
#   docker buildx imagetools inspect mcr.microsoft.com/devcontainers/base:ubuntu
# and replace the sha256 below with the reported (multi-arch index) digest.
FROM mcr.microsoft.com/devcontainers/base:ubuntu@sha256:edfb983aab9c579a385dc23c57d7d3703f5ec920124d99c16204a2cac465aab4

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
