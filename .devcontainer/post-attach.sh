#!/bin/bash
set -euo pipefail

# BASH_ENV loads only non-secret settings. GitHub API access comes from the
# developer's host-provided GH_TOKEN.

# Runs each time VS Code attaches to the container.
#
# Deploy-key and signing-key registration are both manual by default (paste
# a public key into GitHub's UI) — the deploy key may also already be
# registered via post-create.sh's optional auto-registration convenience.
# This script verifies the deploy key's actual liveness and, until both keys
# are handled, shows one combined prompt listing whichever step(s) remain.
#
# Lifecycle:
#   Each step's prompt shows until it's dismissed:
#     touch ~/.ssh/.deploy-key-registered    (auto-registration does this for you)
#     touch ~/.ssh/.signing-key-registered
#   Both markers persist in the shared ssh volume, so rebuilds stay quiet.
#   Wiping the volume resets them and the prompts reappear.

# Flag a missing GH_TOKEN once per attach — a local presence check only, no
# API call: this script must need zero GH_TOKEN scope (see the deploy-key
# probe below, judged via SSH transport for the same reason). Runs
# unconditionally, independent of whether the SSH layer below was enabled.
if [ -z "${GH_TOKEN:-}" ]; then
  echo "⚠ GH_TOKEN is not set — gh CLI API calls (issues, PRs, workflow status) will fail." >&2
fi

# SSH setup either was skipped this build (a credential check failed closed —
# see ~/.ssh/.ssh-setup-skipped) or was never enabled at all — either way,
# there's no key material to verify here. ~/.bashrc's warnings snippet
# already surfaces the skip reason on every terminal.
if [ -f "$HOME/.ssh/.ssh-setup-skipped" ] || [ ! -f "$HOME/.ssh/id_ed25519.pub" ]; then
  exit 0
fi

DEPLOY_REGISTERED="$HOME/.ssh/.deploy-key-registered"
SIGNING_REGISTERED="$HOME/.ssh/.signing-key-registered"
DEPLOY_STATUS_FILE="$HOME/.ssh/.deploy-key-status"
REPO="ken-guru/skills"

# Always verify the deploy key on attach — catches accidental deletion even
# after it was registered (auto or manual). Judged via SSH transport, not
# the GitHub API: needs zero GH_TOKEN scope, works identically regardless of
# which registration path was used, and is a stronger signal than an API
# lookup — it proves push/pull actually works right now, not just that
# GitHub's key list contains a matching entry. GitHub's SSH endpoint always
# exits non-zero here (no shell access is ever granted, authenticated or
# not), so success is judged by its greeting text, not the exit code.
ssh_greeting=$(ssh -T -o BatchMode=yes -o ConnectTimeout=5 git@github.com 2>&1 || true)
if echo "$ssh_greeting" | grep -q "successfully authenticated"; then
  echo "ok" > "$DEPLOY_STATUS_FILE"
  deploy_live=true
else
  echo "missing" > "$DEPLOY_STATUS_FILE"
  deploy_live=false
fi

deploy_done=false
[ "$deploy_live" = true ] && deploy_done=true
[ -f "$DEPLOY_REGISTERED" ] && deploy_done=true

signing_done=false
[ -f "$SIGNING_REGISTERED" ] && signing_done=true

# Fast path — both steps already handled; nothing more to show.
if [ "$deploy_done" = true ] && [ "$signing_done" = true ]; then
  exit 0
fi

DEPLOY_KEY_TITLE=$(awk '{print $3}' ~/.ssh/id_ed25519.pub 2>/dev/null || true)
SIGNING_KEY_TITLE=$(awk '{print $3}' ~/.ssh/id_ed25519_signing.pub 2>/dev/null || true)

echo ""
echo "This key pair is shared by every AI CLI in this container — register"
echo "whichever step(s) below are still outstanding, once."
echo "════════════════════════════════════════════════════════════════════"
echo "  Devcontainer SSH setup"
echo "════════════════════════════════════════════════════════════════════"

if [ "$deploy_done" = true ]; then
  echo "  ✓ Deploy key registered (git push/pull: ready)"
else
  if [ -f "$DEPLOY_REGISTERED" ]; then
    echo "  ⚠ Deploy key was registered before but GitHub no longer accepts it"
    echo "    (deleted or rotated?). Rebuild the container to re-register it if"
    echo "    it was auto-registered, or paste it in by hand below."
  fi
  echo "  ⚠ ACTION REQUIRED — register the SSH deploy key with GitHub"
  echo "    1. Open https://github.com/$REPO/settings/keys/new"
  echo "    2. Title:    $DEPLOY_KEY_TITLE"
  echo "    3. Key type: Authentication Key"
  echo "    4. Paste the deploy public key printed below"
  echo "    5. When done, dismiss this reminder:"
  echo "       touch ~/.ssh/.deploy-key-registered"
fi

echo ""

if [ "$signing_done" = true ]; then
  echo "  ✓ Signing key registered"
else
  echo "  ⚠ ACTION REQUIRED — register the SSH signing key with GitHub"
  echo "    This is a one-time step; it survives rebuilds."
  echo "    1. Open https://github.com/settings/ssh"
  echo "    2. If a key named below already exists there, delete it first"
  echo "       (stale from a previous setup): $SIGNING_KEY_TITLE"
  echo "    3. Click 'New SSH key'"
  echo "    4. Title:    $SIGNING_KEY_TITLE"
  echo "    5. Key type: Signing Key  ← NOT Authentication Key"
  echo "    6. Paste the signing public key printed below"
  echo "    7. When done, dismiss this reminder:"
  echo "       touch ~/.ssh/.signing-key-registered"
fi

echo "════════════════════════════════════════════════════════════════════"
echo ""

if [ "$deploy_done" = false ]; then
  echo "Deploy public key:"
  cat ~/.ssh/id_ed25519.pub
  echo ""
fi

if [ "$signing_done" = false ]; then
  echo "Signing public key:"
  cat ~/.ssh/id_ed25519_signing.pub
  echo ""
fi
