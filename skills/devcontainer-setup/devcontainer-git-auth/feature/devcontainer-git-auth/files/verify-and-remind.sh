#!/bin/bash
# postAttachCommand for the devcontainer-git-auth Feature. Two-tier
# onboarding: the deploy key's liveness is cheap to re-check and its
# failure mode (broken push/pull) is high severity, so it's re-verified
# unconditionally, every attach -- placed AHEAD of the signing-key marker
# check below, not after it, so a regression in the automated part never
# stops getting caught just because the manual part is already marked
# done. The signing key's one-time human step gets a persisted marker
# file instead: presence means done, absence means show the reminder.
# One file, one meaning, checked by presence -- not a second "pending"
# signal that can drift out of sync with it.

set -uo pipefail

WORKSPACE_FOLDER=${1:?"container workspace folder required (pass \${containerWorkspaceFolder})"}
REPO_URL=$(git -C "$WORKSPACE_FOLDER" remote get-url origin 2>/dev/null || true)
REPO=$(echo "$REPO_URL" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')

DEPLOY_KEY_PATH="$HOME/.ssh/id_ed25519"
SIGNING_KEY_PATH="$HOME/.ssh/id_ed25519_signing"
SIGNING_REGISTERED_MARKER="$HOME/.ssh/.signing-key-registered"

# --- Always re-verify the deploy key, every attach, unconditionally ----

if [ -n "$REPO" ] && [ -f "${DEPLOY_KEY_PATH}.pub" ]; then
    DEPLOY_KEY_BODY=$(awk '{print $1, $2}' "${DEPLOY_KEY_PATH}.pub")
    deploy_id=$(gh api "repos/${REPO}/keys" 2>/dev/null | jq -r \
        --arg body "$DEPLOY_KEY_BODY" \
        '.[] | select((.key | split(" ")[:2] | join(" ")) == $body) | .id' || true)

    if [ -z "$deploy_id" ]; then
        echo "WARNING: devcontainer-git-auth: deploy key not found on GitHub. Push/pull will fail." >&2
    fi
fi

# --- Signing key: marker-gated, one-time reminder ----------------------

if [ -f "$SIGNING_KEY_PATH.pub" ] && [ ! -f "$SIGNING_REGISTERED_MARKER" ]; then
    echo ""
    echo "ACTION REQUIRED: register your SSH signing key."
    echo "  1. Open https://github.com/settings/ssh"
    echo "  2. If a key with the same title already exists, delete it first (stale from a previous setup)."
    echo "  3. Click \"New SSH key\""
    echo "  4. Key type: Signing Key -- NOT Authentication Key"
    echo "  5. Paste the public key below."
    echo ""
    cat "$SIGNING_KEY_PATH.pub"
    echo ""
    echo "When done, dismiss this prompt so it doesn't reappear:"
    echo "  touch $SIGNING_REGISTERED_MARKER"
    echo ""
fi
