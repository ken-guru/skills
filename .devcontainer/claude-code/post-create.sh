#!/bin/bash
set -euo pipefail

# Trust /workspace regardless of who owns it. Private Checkout's own clone
# (or git init) already runs as this container's vscode user, so UID
# mismatch isn't the everyday case it was under the old bind-mounted
# workspace — but this stays a defensive backstop against git's "dubious
# ownership" safety check ("detected dubious ownership in repository",
# surfacing through Claude Code's `--worktree` flag as "git identity could
# not be verified") in any scenario where /workspace's ownership doesn't
# match this container's UID regardless of cause. `*` (not just /workspace)
# also covers the nested git worktrees `claude --worktree` creates under
# /workspace/.claude/worktrees/ — now private to this container's own
# Private Checkout, not host-visible noise.
git config --global --add safe.directory '*'

# Git identity — read from .devcontainer/.env (GIT_USER_EMAIL / GIT_USER_NAME).
# Shared across every Tool Container: git identity isn't tool-specific, so
# this block is concatenated into every generated tool's post-create.sh
# rather than duplicated by hand per tool.
git config --global credential.helper '!gh auth setup-git'
git config --global user.email "${GIT_USER_EMAIL:-ken.paulsen@gmail.com}"
git config --global user.name "${GIT_USER_NAME:-Ken Sørevåge}"

# Prints which Tool Container this shell belongs to, at the top of every new
# terminal — cheap insurance against mistaking one CLI's container for
# another's. This matters even beyond user error: VS Code's own built-in
# terminal.integrated.initialHint feature shows a client-side "Type copilot
# to use Copilot CLI" suggestion based on local Copilot/Chat entitlement
# state, not on what's actually installed in the container it's attached to
# — so it can appear inside a non-Copilot Tool Container and point at the
# wrong CLI. That specific hint is suppressed via
# customizations.vscode.settings in this tool's devcontainer.json where
# applicable; this banner is the general-purpose backstop for any other,
# unrelated source of the same confusion.
if ! grep -q "devcontainer-identity-banner" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-identity-banner
if [[ $- == *i* ]]; then
  echo "── Claude Code Tool Container ──"
fi
EOF
fi

# Fix ownership on the mounted Claude config volume — Docker creates a fresh
# named-volume mountpoint root:root regardless of the parent directory's
# ownership, even under /home/vscode.
sudo chown -R vscode:vscode /home/vscode/.claude

# Install Claude Code via the official native installer, as a plain piped
# one-liner rather than a download-then-run wrapper — this is exactly
# Anthropic's own documented invocation
# (code.claude.com/docs/en/quickstart), not npm. The native install auto-
# updates in the background and is what Anthropic's own docs lead with;
# installs to ~/.local/bin/claude, matching the same binary-path
# idempotency-check pattern already used for Codex/Antigravity/Copilot.
# Checked by binary path, not `command -v` — this non-login script's PATH
# doesn't include ~/.local/bin, so a PATH-based check would miss an already-
# installed binary and re-run the installer on every rebuild. A failure here
# is a warning, not a postCreateCommand-aborting error, matching the other
# three tools' pattern.
if [ ! -x "$HOME/.local/bin/claude" ]; then
  curl -fsSL https://claude.ai/install.sh | bash || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
fi

# SSH identity — two keys per Tool Container, persisted in this tool's own
# skills-claude-code-ssh volume, private to this Tool Container (no
# longer shared across tools — see the signing-key prompt from
# post-attach.sh, which says the same thing).
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
# concatenated after this one (other tool setup, the warnings banner below).
# So every precondition below degrades to "skip the rest of this block and
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

# No lock needed here: this tool's skills-claude-code-ssh volume is
# private to this Tool Container's own Private Checkout, so there is no
# sibling container racing to write the same volume the way there was when
# every SSH-enabled tool shared one skills-ssh-config volume.

DEPLOY_KEY_TITLE="skills-claude-code-devcontainer@${DEVCONTAINER_HOST}"
SIGNING_KEY_TITLE="skills-claude-code-devcontainer-signing@${DEVCONTAINER_HOST}"
OLD_SHARED_DEPLOY_KEY_TITLE="skills-devcontainer@${DEVCONTAINER_HOST}"

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
# rotated (e.g. this tool's ssh volume was wiped). In that case remove the
# stale entry and re-register with the new key.
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

# Migration: this repo may still have the old repo-wide shared deploy key
# registered from before Private Checkout, when every SSH-enabled tool
# reused one key pair. It's now redundant — this tool has its own — so
# remove it rather than leave an unused, unrevoked credential standing. Safe
# to run unconditionally: a no-op once no key with the old title remains.
# The old signing key has no equivalent here — GitHub exposes no deletion
# API for signing keys — so it's left for the person migrating this repo to
# remove by hand; the agent running this skill tells them to when it detects
# a pre-Private-Checkout setup (see SKILL.md's migration guidance).
# Same title-uniqueness caveat as stale_id above — bound to one match.
old_shared_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
  --arg title "$OLD_SHARED_DEPLOY_KEY_TITLE" \
  '.[] | select(.title == $title) | .id' | head -1)
if [ -n "$old_shared_id" ]; then
  gh api "repos/${REPO}/keys/${old_shared_id}" -X DELETE
  echo "Removed old shared deploy key (superseded by per-tool keys): $OLD_SHARED_DEPLOY_KEY_TITLE"
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
    echo "⚠ Deploy key NOT found on GitHub — git push/pull will fail. Rebuild this Tool Container to re-register it."
  fi
fi
EOF
fi
