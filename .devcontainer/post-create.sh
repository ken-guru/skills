#!/bin/bash
set -euo pipefail

# BASH_ENV loads only non-secret settings. GH_TOKEN is supplied by the
# developer's host environment and is never read from the Shared Checkout.

# The BASH_ENV mechanism above only fires for non-interactive shells (any
# AI CLI's own tool calls, which run `bash -c ...`) — it's never consulted
# for an interactive shell, which is how a human's VS Code terminal starts.
# Give those the same .env load via ~/.bashrc instead, guarded so a rebuild
# doesn't keep appending duplicates; ~/.bashrc itself lives in the
# persistent config volume, so this only needs to run once per volume, not
# once per rebuild — but idempotent is cheap insurance either way.
if ! grep -q "devcontainer-env-load" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-env-load
source /workspace/.devcontainer/bash-env.sh
EOF
fi

# /workspace is the host's own working directory, bind-mounted directly (VS
# Code's default devcontainer behavior) — not a clone into a separate
# volume. Trust it regardless of who owns it: this is a defensive backstop
# against git's "dubious ownership" safety check ("detected dubious
# ownership in repository", surfacing through Claude Code's `--worktree`
# flag as "git identity could not be verified") in any scenario where the
# bind-mounted directory's ownership doesn't match this container's UID.
# `*` (not just /workspace) also covers nested git worktrees `claude
# --worktree` creates under /workspace/.claude/worktrees/.
git config --global --add safe.directory '*'

# Local Checkout: a workspace with no GitHub `origin` yet. Bind-mounting
# means /workspace already holds whatever the host has — no clone step is
# needed here, unlike the old per-container clone model. If this run's
# answer to "initialize with git init?" was yes and no .git exists yet,
# initialize it now; a genuinely bare Local Checkout (declined git init)
# or a repo that already has a real origin skip this entirely.
if [ "false" = "true" ] && [ ! -d /workspace/.git ]; then
  if [ -n "" ]; then
    git init --initial-branch="" /workspace
  else
    git init /workspace
  fi
  echo "Local Checkout initialized: git repo, no origin."
fi

# Git identity — read from .devcontainer/.env (GIT_USER_EMAIL / GIT_USER_NAME).
# Base-owned: git identity isn't tool-specific, so this is set once here
# rather than duplicated by any CLI skill.
git config --global credential.helper '!gh auth setup-git'
git config --global user.email "${GIT_USER_EMAIL:-ken.paulsen@gmail.com}"
git config --global user.name "${GIT_USER_NAME:-Ken Sørevåge}"

# Establish the Shared Checkout boundary for workspace-derived commands.
if ! command -v setfacl >/dev/null 2>&1; then
  echo "ERROR: ACL support is required to establish the code-runner boundary" >&2
  exit 1
fi
sudo setfacl -R -m u:code-runner:rwX /workspace
find /workspace -type d -exec sudo setfacl -m d:u:code-runner:rwX {} +


# Mechanical install skeleton shared by every CLI Skill: fix the per-tool
# config subdirectory's ownership (Docker creates a fresh named-volume
# mountpoint root:root regardless of the parent directory's ownership, even
# under /home/vscode), then run a curl-piped installer exactly once. Each
# CLI Skill's own install-block.sh calls these two functions and keeps only
# the rationale that's genuinely tool-specific (see there for it).
#
# install_cli checks by binary path, not `command -v` — this non-login
# script's PATH doesn't include ~/.local/bin, so a PATH-based check would
# miss an already-installed binary and re-run the network installer on every
# rebuild. A failed install is a warning, not a postCreateCommand-aborting
# error: every CLI installed this way is optional tooling and shouldn't
# block the rest of setup. Extra `VAR=val` arguments (Codex's
# CODEX_NON_INTERACTIVE=1) are passed to the piped shell via `env`, not a
# `</dev/null` redirect or subshell wrapper, so they don't disturb the piped
# command's own stdin — see codex/post-create-block.sh for why that
# distinction matters.
chown_config_volume() {
  sudo mkdir -p "$1"
  sudo chown -R vscode:vscode "$1"
}

install_cli() {
  local label="$1" bin_path="$2" url="$3" shell_bin="$4"
  shift 4
  if [ ! -x "$bin_path" ]; then
    curl -fsSL "$url" | env "$@" "$shell_bin" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  fi
}


# SSH identity — one shared deploy key and one shared signing key,
# persisted in the skills-ssh volume for the whole container. There's
# only one container now, so there's no other container for this key
# material to be scoped away from — see post-attach.sh's registration
# prompt.
#   id_ed25519         — deploy key: scoped auth for this repo (registration is manual
#                         by default — see post-attach.sh — auto-registered only as an
#                         opportunistic convenience when GH_TOKEN happens to carry
#                         Administration:write; see below)
#   id_ed25519_signing — signing key: commit verification (always registered manually)
#
# Two separate keys because GitHub rejects a public key as a signing key once
# that same key is already registered as a deploy key.
#
# Key generation and SSH client config run unconditionally below — neither
# needs GH_TOKEN at all, only DEVCONTAINER_HOST (for key titles). GH_TOKEN is
# only ever consulted afterward, optionally, to decide whether to attempt the
# deploy-key auto-registration convenience — nothing here may depend on
# GH_TOKEN having any particular scope, so this block never fails the build
# and never skips key generation on its account.
sudo mkdir -p /home/vscode/.ssh
sudo chown -R vscode:vscode /home/vscode/.ssh
chmod 700 /home/vscode/.ssh

SSH_SKIP_MARKER="$HOME/.ssh/.ssh-setup-skipped"
rm -f "$SSH_SKIP_MARKER"
REPO="ken-guru/skills"

if [ -z "${DEVCONTAINER_HOST:-}" ]; then
  reason="DEVCONTAINER_HOST is not set in .devcontainer/.env (run \`hostname\` on your host to find it)."
  echo "⚠ SSH layer skipped this build: $reason" >&2
  echo "  Set it, then Dev Containers: Rebuild Container." >&2
  echo "$reason" > "$SSH_SKIP_MARKER"
else

DEPLOY_KEY_TITLE="skills-devcontainer@${DEVCONTAINER_HOST}"
SIGNING_KEY_TITLE="skills-devcontainer-signing@${DEVCONTAINER_HOST}"
CREDENTIAL_DIR="/run/devcontainer-credentials"

if [ ! -d "$CREDENTIAL_DIR" ]; then
  reason="DEVCONTAINER_CREDENTIALS_DIR is not mounted; configure it in the host environment before rebuilding."
  echo "ERROR: SSH layer unavailable: $reason" >&2
  echo "$reason" > "$SSH_SKIP_MARKER"
  exit 1
fi

for credential in deploy-key signing-key; do
  path="$CREDENTIAL_DIR/$credential"
  if [ ! -f "$path" ]; then
    reason="missing protected credential: $path"
    echo "ERROR: SSH layer unavailable: $reason" >&2
    echo "$reason" > "$SSH_SKIP_MARKER"
    exit 1
  fi
  mode="$(stat -c '%a' "$path")"
  case "$mode" in
    600|400) ;;
    *)
      reason="$path must be mode 0600 or 0400 (actual $mode)"
      echo "ERROR: SSH layer unavailable: $reason" >&2
      echo "$reason" > "$SSH_SKIP_MARKER"
      exit 1
      ;;
  esac
  if [ ! -f "$path.pub" ]; then
    reason="missing public credential: $path.pub"
    echo "ERROR: SSH layer unavailable: $reason" >&2
    echo "$reason" > "$SSH_SKIP_MARKER"
    exit 1
  fi
done

# Deploy key — used for git transport (push/pull). The developer owns the
# private key outside the Shared Checkout; this copy remains inaccessible to
# the code identity because its home directory is not shared with it.
install -m 600 "$CREDENTIAL_DIR/deploy-key" ~/.ssh/id_ed25519
install -m 644 "$CREDENTIAL_DIR/deploy-key.pub" ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub

# Signing key — used only for commit signing, not for git transport.
install -m 600 "$CREDENTIAL_DIR/signing-key" ~/.ssh/id_ed25519_signing
install -m 644 "$CREDENTIAL_DIR/signing-key.pub" ~/.ssh/id_ed25519_signing.pub
chmod 600 ~/.ssh/id_ed25519_signing
chmod 644 ~/.ssh/id_ed25519_signing.pub

# SSH client config — deploy key for GitHub transport only, no agent.
if ! grep -q "Host github.com" ~/.ssh/config 2>/dev/null; then
  cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  User git
EOF
  chmod 600 ~/.ssh/config
fi

# Trust GitHub's host key without an interactive prompt.
if ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
  ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null
fi

# Signing key config is local git config only, no GH_TOKEN involved —
# GitHub-side registration is always manual (see post-attach.sh), since
# there's no API-driven way to do it without granting GH_TOKEN
# account-level write:ssh_signing_key, which would let it manage every
# signing key on the account, not just this project's.
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true

# GitHub deploy-key registration remains a manual developer step. It requires
# no Administration scope on GH_TOKEN; post-attach.sh prints the public key.

fi


# Standing setup warnings, surfaced at the top of every new terminal — not
# just once at attach. postCreateCommand/postAttachCommand each fire once per
# rebuild/attach, not per terminal tab, so anything that should stay visible
# until fixed has to live in ~/.bashrc instead. This covers all three
# standing warnings this SSH layer can leave behind: SSH setup skipped
# (post-create-ssh-block.sh), the signing key not yet registered, and the
# deploy key missing from GitHub. Every check here is a cheap local file
# read — the one warning that needs a network call (deploy key liveness) is
# verified once per attach by post-attach.sh, which caches its result to
# ~/.ssh/.deploy-key-status for this snippet to read, so no terminal ever
# pays for its own API call just to open a shell. Guarded like the other
# ~/.bashrc-appending blocks in this skill: postCreateCommand only fires
# once per fresh rebuild in normal operation, but this stays idempotent
# rather than relying on that.
if ! grep -q "devcontainer-ssh-warnings" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-ssh-warnings
if [[ $- == *i* ]]; then
  if [ -f "$HOME/.ssh/.ssh-setup-skipped" ]; then
    echo "⚠ SSH layer skipped this build: $(cat "$HOME/.ssh/.ssh-setup-skipped")"
    echo "  Fix .devcontainer/.env, then Dev Containers: Rebuild Container."
  fi
  if [ -f "$HOME/.ssh/id_ed25519_signing.pub" ] && [ ! -f "$HOME/.ssh/.signing-key-registered" ]; then
    echo "⚠ SSH signing key not yet registered with GitHub — run: cat ~/.ssh/id_ed25519_signing.pub"
  fi
  if [ -f "$HOME/.ssh/.deploy-key-status" ] && [ "$(cat "$HOME/.ssh/.deploy-key-status")" = "missing" ]; then
    echo "⚠ Deploy key not working — git push/pull will fail. See the setup prompt on your next"
    echo "  attach for registration instructions (or rebuild if it was auto-registered before)."
  fi
fi
EOF
fi

# --- Claude Code ---
# Fix ownership on the mounted Claude config volume, then install Claude
# Code via the official native installer — exactly Anthropic's own
# documented invocation (code.claude.com/docs/en/quickstart), not npm. The
# native install auto-updates in the background and is what Anthropic's own
# docs lead with; installs to ~/.local/bin/claude, matching the same
# binary-path idempotency-check pattern install_cli uses for every tool
# (see the base skill's install-cli-block.sh).
chown_config_volume "$HOME/.claude"
install_cli "Claude Code" "$HOME/.local/bin/claude" "https://claude.ai/install.sh" bash
# --- Codex ---
# Fix ownership on the .codex config volume mount, then install Codex CLI
# via the official installer, exactly as OpenAI's own docs invoke it
# (developers.openai.com/codex/cli).
#
# CODEX_NON_INTERACTIVE=1 is the installer's own documented switch for
# skipping its prompts, passed through install_cli's `env` wrapper rather
# than a `</dev/null` redirect on the piped `sh`: closing sh's own stdin
# breaks the curl|sh pipe itself (curl gets EPIPE and the install silently
# no-ops without ever erroring), it doesn't just suppress the prompt.
chown_config_volume "$HOME/.codex"
install_cli "Codex" "$HOME/.local/bin/codex" "https://chatgpt.com/codex/install.sh" sh CODEX_NON_INTERACTIVE=1
