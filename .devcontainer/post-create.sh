#!/bin/bash
set -euo pipefail

# devcontainer.json's BASH_ENV containerEnv entry already sources
# bash-env.sh (same .env, same `set -a` export) before this script's own
# first line runs, since this is itself a non-interactive bash invocation —
# but source it again directly, defensively, in case this script is ever
# run by hand outside that containerEnv (e.g. `bash post-create.sh` on a
# host shell during local testing). `set -a` exports every var this script
# and its appended blocks read (GH_TOKEN, GIT_USER_EMAIL, GIT_USER_NAME,
# DEVCONTAINER_HOST) for the rest of this script, including every CLI
# skill's block appended after it.
ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

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
# material to be scoped away from — see post-attach.sh's signing-key prompt.
#   id_ed25519         — deploy key: scoped auth for this repo (registered automatically)
#   id_ed25519_signing — signing key: commit verification (registered manually once)
#
# Two separate keys because GitHub rejects a public key as a signing key once
# that same key is already registered as a deploy key.
sudo mkdir -p /home/vscode/.ssh
sudo chown -R vscode:vscode /home/vscode/.ssh
chmod 700 /home/vscode/.ssh

# Nothing about this optional layer may be able to fail the whole container
# build — a postCreateCommand abort here would also skip every block
# concatenated after this one (CLI installs, the warnings banner below). So
# every precondition below degrades to "skip the rest of this block and
# record why" instead of exiting; this block never uses `exit` past this
# point. SSH_SKIP_MARKER is what the warnings banner (appended after this
# block) and post-attach.sh both check to know SSH was never configured.
SSH_SKIP_MARKER="$HOME/.ssh/.ssh-setup-skipped"
rm -f "$SSH_SKIP_MARKER"
SSH_SETUP_OK=true
REPO="ken-guru/skills"

# Probed first, before generating or touching any keys, so a bad token is
# classified and reported before anything else runs. This call's only job is
# classifying GH_TOKEN's error, via the same `gh: <message> (HTTP <code>)`
# stderr format `gh api` always uses on failure.
if ! probe_err=$(gh api "repos/${REPO}/keys" 2>&1 1>/dev/null); then
  case "$probe_err" in
    *"(HTTP 401)"*)
      reason="GH_TOKEN is missing or invalid (401 from GitHub) — set a valid token in .devcontainer/.env." ;;
    *"(HTTP 403)"*)
      reason="GH_TOKEN lacks the repo's Administration (read/write) permission (403 from GitHub), needed to manage deploy keys." ;;
    *)
      reason="GitHub API call failed unexpectedly: ${probe_err:-no response}" ;;
  esac
  echo "⚠ SSH layer skipped this build: $reason" >&2
  echo "  Fix .devcontainer/.env, then Dev Containers: Rebuild Container." >&2
  echo "$reason" > "$SSH_SKIP_MARKER"
  SSH_SETUP_OK=false
fi

if [ "$SSH_SETUP_OK" = true ] && [ -z "${DEVCONTAINER_HOST:-}" ]; then
  reason="DEVCONTAINER_HOST is not set in .devcontainer/.env (run \`hostname\` on your host to find it)."
  echo "⚠ SSH layer skipped this build: $reason" >&2
  echo "  Set it, then Dev Containers: Rebuild Container." >&2
  echo "$reason" > "$SSH_SKIP_MARKER"
  SSH_SETUP_OK=false
fi

if [ "$SSH_SETUP_OK" = true ]; then

DEPLOY_KEY_TITLE="skills-devcontainer@${DEVCONTAINER_HOST}"
SIGNING_KEY_TITLE="skills-devcontainer-signing@${DEVCONTAINER_HOST}"

# Deploy key — used for git transport (push/pull)
if [ ! -f ~/.ssh/id_ed25519 ]; then
  ssh-keygen -t ed25519 -C "$DEPLOY_KEY_TITLE" -f ~/.ssh/id_ed25519 -N ""
fi
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub

# Signing key — used only for commit signing, not for git transport
if [ ! -f ~/.ssh/id_ed25519_signing ]; then
  ssh-keygen -t ed25519 -C "$SIGNING_KEY_TITLE" -f ~/.ssh/id_ed25519_signing -N ""
fi
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

DEPLOY_PUBKEY=$(cat ~/.ssh/id_ed25519.pub)
DEPLOY_KEY_BODY=$(echo "$DEPLOY_PUBKEY" | awk '{print $1, $2}')

ALL_DEPLOY_KEYS=$(gh api "repos/${REPO}/keys")

# Check by key content — a title match with different content means the key was
# rotated (e.g. the ssh volume was wiped). In that case remove the stale
# entry and re-register with the new key.
existing_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
  --arg body "$DEPLOY_KEY_BODY" \
  '.[] | select((.key | split(" ")[:2] | join(" ")) == $body) | .id')

if [ -n "$existing_id" ]; then
  echo "Deploy key already registered: $DEPLOY_KEY_TITLE"
else
  # GitHub doesn't enforce title uniqueness, so bound this to exactly one
  # match — a multi-line result here would break the DELETE call below.
  stale_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
    --arg title "$DEPLOY_KEY_TITLE" \
    '.[] | select(.title == $title) | .id' | head -1)
  if [ -n "$stale_id" ]; then
    gh api "repos/${REPO}/keys/${stale_id}" -X DELETE
    echo "Removed stale deploy key (volume was rotated): $DEPLOY_KEY_TITLE"
  fi
  gh api "repos/${REPO}/keys" -X POST \
    -f title="$DEPLOY_KEY_TITLE" -f key="$DEPLOY_PUBKEY" -F read_only=false
  echo "Deploy key registered: $DEPLOY_KEY_TITLE"
fi

# Signing key is separate from the deploy key so it can be registered on GitHub
# without hitting the "key is already in use" constraint.
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true

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
    echo "⚠ Deploy key NOT found on GitHub — git push/pull will fail. Rebuild the container to re-register it."
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
