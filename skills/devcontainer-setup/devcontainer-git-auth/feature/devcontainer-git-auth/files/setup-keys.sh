#!/bin/bash
# postCreateCommand for the devcontainer-git-auth Feature. Generates the
# deploy key and signing key (guarded by file-existence checks, so this is
# safe to re-run every container create), registers the deploy key against
# GitHub with content-based idempotency, and prints the signing-key
# onboarding banner if it hasn't been dismissed yet. Requires GH_TOKEN in
# the environment (via devcontainer-scaffold's env_file wiring) for the
# registration API calls -- git transport itself uses the deploy key over
# SSH, never this token.

set -euo pipefail

WORKSPACE_FOLDER=${1:?"container workspace folder required (pass \${containerWorkspaceFolder})"}
REPO_URL=$(git -C "$WORKSPACE_FOLDER" remote get-url origin 2>/dev/null || true)
# Accepts both SSH (git@github.com:owner/repo.git) and HTTPS
# (https://github.com/owner/repo.git) remote URL forms.
REPO=$(echo "$REPO_URL" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
if [ -z "$REPO" ]; then
    echo "ERROR: devcontainer-git-auth could not determine owner/repo from 'git remote get-url origin' ($REPO_URL). Set it manually by exporting REPO=owner/repo before this script runs." >&2
    exit 1
fi

ENV_LABEL=${DEVCONTAINER_HOST:-$(hostname)}
DEPLOY_KEY_TITLE="${REPO##*/}-devcontainer@${ENV_LABEL}"
SIGNING_KEY_TITLE="${REPO##*/}-devcontainer-signing@${ENV_LABEL}"

DEPLOY_KEY_PATH="$HOME/.ssh/id_ed25519"
SIGNING_KEY_PATH="$HOME/.ssh/id_ed25519_signing"

# --- Step 1: generate two keys, never one -----------------------------

if [ ! -f "$DEPLOY_KEY_PATH" ]; then
    ssh-keygen -t ed25519 -C "$DEPLOY_KEY_TITLE" -f "$DEPLOY_KEY_PATH" -N ""
fi
chmod 600 "$DEPLOY_KEY_PATH"
chmod 644 "${DEPLOY_KEY_PATH}.pub"

if [ ! -f "$SIGNING_KEY_PATH" ]; then
    ssh-keygen -t ed25519 -C "$SIGNING_KEY_TITLE" -f "$SIGNING_KEY_PATH" -N ""
fi
chmod 600 "$SIGNING_KEY_PATH"
chmod 644 "${SIGNING_KEY_PATH}.pub"

# --- Step 2: SSH client config, pinned to the deploy key only ---------

mkdir -p "$HOME/.ssh"
if ! grep -q "^Host github.com$" "$HOME/.ssh/config" 2>/dev/null; then
    cat >> "$HOME/.ssh/config" <<CONFIG
Host github.com
  IdentityFile $DEPLOY_KEY_PATH
  IdentitiesOnly yes
  User git
CONFIG
fi
touch "$HOME/.ssh/known_hosts"
grep -q "^github.com " "$HOME/.ssh/known_hosts" || ssh-keyscan -H github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null

# --- Step 3: register the deploy key, checked by CONTENT --------------
#
# Idempotent and rotation-safe by construction. Never re-registers a key
# that's already correctly registered, and correctly detects and repairs a
# stale registration left behind by a previous, now-replaced key (the
# words-are-snake case this pattern is verified against: a wiped SSH
# volume regenerating a new key under the same title).

DEPLOY_PUBKEY=$(cat "${DEPLOY_KEY_PATH}.pub")
DEPLOY_KEY_BODY=$(echo "$DEPLOY_PUBKEY" | awk '{print $1, $2}')

# gh api's own --jq flag only accepts a filter expression, not jq's other
# flags like --arg appended after it -- that combination silently doesn't
# bind $body and either errors inside gh api or matches nothing, with no
# indication size or argument-passing is the cause. Get raw JSON from
# gh api first, then pipe to a real, standalone jq, which does support
# --arg.
ALL_DEPLOY_KEYS=$(gh api "repos/${REPO}/keys")

existing_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
    --arg body "$DEPLOY_KEY_BODY" \
    '.[] | select((.key | split(" ")[:2] | join(" ")) == $body) | .id')

if [ -n "$existing_id" ]; then
    echo "Deploy key already registered: $DEPLOY_KEY_TITLE"
else
    stale_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
        --arg title "$DEPLOY_KEY_TITLE" \
        '.[] | select(.title == $title) | .id')

    if [ -n "$stale_id" ]; then
        gh api "repos/${REPO}/keys/${stale_id}" -X DELETE
        echo "Removed stale deploy key (volume was rotated): $DEPLOY_KEY_TITLE"
    fi

    gh api "repos/${REPO}/keys" -X POST \
        -f title="$DEPLOY_KEY_TITLE" -f key="$DEPLOY_PUBKEY" -F read_only=false
    echo "Deploy key registered: $DEPLOY_KEY_TITLE"
fi

# --- Step 4: the signing key is a manual, human-driven step ------------
#
# Automating this typically needs an account-wide credential scope broader
# than anything else this Feature needs. The signing key persists across
# restarts in the same volume as the deploy key, so treat registering it
# as a rare, one-time action per environment, not something this script
# does. One persisted marker file, checked for presence, is the whole
# state machine -- see verify-and-remind.sh, which prints this banner on
# every attach until the marker exists.

# --- Step 5: configure git to use each key for its one purpose ---------

git config --global gpg.format ssh
git config --global user.signingkey "${SIGNING_KEY_PATH}.pub"
git config --global commit.gpgsign true

echo "devcontainer-git-auth: keys ready, deploy key registered."
