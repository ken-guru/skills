# Shared base image for every Tool Container this skill generates. Each
# tool's own Dockerfile does `FROM {{BASE_IMAGE_TAG}}` — Docker's layer store
# shares these layers across every Tool Container built on this tag, so the
# work below happens once, not once per tool.
#
# Rebuilt and retagged only when this file's rendered content changes (see
# SKILL.md's base-image step); the resulting tag is versioned, never
# `:latest`, so a base-layer change never silently cascades to every already-
# built Tool Container.
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Node.js — none of the four AI CLIs need this themselves (all install as
# native binaries), but it's kept as a general-purpose amenity for repos
# whose own project code is JS/TS, installed once here instead of once per
# Tool Container. npm is bumped to current right after install since
# nodesource's bundled npm lags behind — otherwise every fresh terminal
# nags with npm's own "New major version available" update-notifier the
# first time npm runs. NPM_CONFIG_UPDATE_NOTIFIER=false is kept as a
# permanent guard on top of the bump, so that notice can't resurface just
# because this base image goes stale between rebuilds.
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g npm@latest \
    && rm -rf /var/lib/apt/lists/*
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# GitHub CLI — used by every Tool Container for auth (`GH_TOKEN`) and, for
# tools whose SSH layer is enabled, deploy-key/signing-key registration.
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
# pin it explicitly rather than relying on that staying true upstream, so
# every Tool Container built on this image shares an identical user/UID/GID
# by construction.
RUN if ! id vscode >/dev/null 2>&1; then \
      groupadd --gid 1000 vscode && \
      useradd --uid 1000 --gid 1000 -m -s /bin/bash vscode; \
    fi

# Private Checkout's clone step, run via each Tool Container's
# `onCreateCommand` — before `postCreateCommand`, while the workspace volume
# is still empty, so it can't reference anything workspace-relative (that's
# why this lives baked into the image rather than as a `.devcontainer/`
# template). Self-sufficient for auth (`gh auth setup-git`) rather than
# depending on `postCreateCommand`'s later, tool-specific credential-helper
# setup, since `onCreateCommand` always fires first. Idempotent on
# `/workspace/.git` existing, so a rebuild against an already-cloned (or
# already-`git init`'d) volume is a no-op. A Local Checkout that declined
# `git init` has no `.git` to short-circuit on, so this re-evaluates (and
# re-prints its one status line) on every rebuild — harmless, since it has
# no side effects beyond that echo, just not a true no-op like the other
# two paths.
#
# Branches on {{LOCAL_CHECKOUT}} for a repo with no GitHub connection at all
# (see SKILL.md step 1): `{{LOCAL_CHECKOUT_GIT_INIT}}` decides between
# `git init` (default branch from {{GIT_DEFAULT_BRANCH}}, if the host had
# one configured) and leaving the workspace genuinely bare. Otherwise, falls
# through to the existing clone path unchanged: unlike the optional SSH
# layer, a container with no repo at all has nothing to degrade to, so a
# missing `GH_TOKEN` fails loudly rather than skipping gracefully; an
# invalid one is left to surface via `git clone`'s own authentication error.
#
# Written via `printf`/backslash-continuation rather than a heredoc so this
# builds on any Docker builder (heredocs in RUN need BuildKit; this skill
# doesn't require it elsewhere).
RUN printf '%s\n' \
      '#!/bin/bash' \
      'set -euo pipefail' \
      '' \
      'if [ -d /workspace/.git ]; then' \
      '  echo "Private Checkout already exists at /workspace, skipping."' \
      '  exit 0' \
      'fi' \
      '' \
      '# A fresh named-volume mountpoint is always root:root regardless of the' \
      '# base images default user (same issue documented for config volumes' \
      '# in post-create-block.sh) -- but onCreateCommand runs before any of' \
      '# postCreateCommands own chown fixes, so this has to be handled here' \
      '# first, before git ever touches /workspace.' \
      'sudo chown vscode:vscode /workspace' \
      '' \
      'if [ "{{LOCAL_CHECKOUT}}" = "true" ]; then' \
      '  if [ "{{LOCAL_CHECKOUT_GIT_INIT}}" = "true" ]; then' \
      '    if [ -n "{{GIT_DEFAULT_BRANCH}}" ]; then' \
      '      git init --initial-branch="{{GIT_DEFAULT_BRANCH}}" /workspace' \
      '    else' \
      '      git init /workspace' \
      '    fi' \
      '    echo "Local Checkout initialized: git repo, no origin."' \
      '  else' \
      '    echo "Local Checkout initialized: no git."' \
      '  fi' \
      '  exit 0' \
      'fi' \
      '' \
      'if [ -z "${GH_TOKEN:-}" ]; then' \
      '  echo "✗ GH_TOKEN is not set in .devcontainer/.env — cannot clone the repo." >&2' \
      '  echo "  Set it, then Dev Containers: Rebuild Container." >&2' \
      '  exit 1' \
      'fi' \
      '' \
      'gh auth setup-git' \
      'git clone "https://github.com/{{REPO_SLUG}}.git" /workspace' \
      > /usr/local/bin/clone-checkout.sh \
    && chmod 755 /usr/local/bin/clone-checkout.sh

USER vscode
