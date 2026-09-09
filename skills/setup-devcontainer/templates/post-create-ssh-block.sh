# SSH identity — two keys per Tool Container, persisted in this tool's own
# {{REPO_NAME}}-{{TOOL_NAME}}-ssh volume, private to this Tool Container (no
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
REPO="{{REPO_SLUG}}"

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

# No lock needed here: this tool's {{REPO_NAME}}-{{TOOL_NAME}}-ssh volume is
# private to this Tool Container's own Private Checkout, so there is no
# sibling container racing to write the same volume the way there was when
# every SSH-enabled tool shared one {{REPO_NAME}}-ssh-config volume.

DEPLOY_KEY_TITLE="{{REPO_NAME}}-{{TOOL_NAME}}-devcontainer@${DEVCONTAINER_HOST}"
SIGNING_KEY_TITLE="{{REPO_NAME}}-{{TOOL_NAME}}-devcontainer-signing@${DEVCONTAINER_HOST}"
OLD_SHARED_DEPLOY_KEY_TITLE="{{REPO_NAME}}-devcontainer@${DEVCONTAINER_HOST}"

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
