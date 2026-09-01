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

# Node.js — required by the Claude Code CLI and available to any tool that
# wants it, installed once here instead of once per Tool Container.
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

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
# by construction. This is what makes UID drift across Tool Containers
# sharing one bind-mounted workspace structurally impossible: there is only
# one place this identity is defined, not four.
RUN if ! id vscode >/dev/null 2>&1; then \
      groupadd --gid 1000 vscode && \
      useradd --uid 1000 --gid 1000 -m -s /bin/bash vscode; \
    fi

# The NodeSource apt package's npm ships with a root-owned global prefix
# (/usr/lib/node_modules), so `npm install -g` as `vscode` fails with EACCES
# without this. Giving `vscode` its own writable global prefix means any
# Tool Container's post-create script (e.g. Claude Code's `npm install -g
# @anthropic-ai/claude-code`) can install global packages without sudo.
ENV NPM_CONFIG_PREFIX=/home/vscode/.npm-global
ENV PATH="${NPM_CONFIG_PREFIX}/bin:${PATH}"
RUN mkdir -p "${NPM_CONFIG_PREFIX}" && chown -R vscode:vscode "${NPM_CONFIG_PREFIX}"

USER vscode
