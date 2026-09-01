
# SSH identity — two keys per host machine, both persisted in the
# {{REPO_NAME}}-ssh-config volume, and SHARED across every Tool Container
# that has this layer enabled (they all mount the same volume). Registration
# happens ONCE FOR THE WHOLE REPO, never once per tool — see the signing-key
# prompt from post-attach.sh, which says the same thing.
#   id_ed25519         — deploy key: scoped auth for this repo (registered automatically)
#   id_ed25519_signing — signing key: commit verification (registered manually once)
#
# Two separate keys because GitHub rejects a public key as a signing key once
# that same key is already registered as a deploy key.
sudo mkdir -p /home/vscode/.ssh
sudo chown -R vscode:vscode /home/vscode/.ssh
chmod 700 /home/vscode/.ssh

if [ -z "${DEVCONTAINER_HOST:-}" ]; then
  echo "ERROR: DEVCONTAINER_HOST is not set." >&2
  echo "       Copy .devcontainer/.env.example to .devcontainer/.env and set DEVCONTAINER_HOST." >&2
  exit 1
fi

# Every SSH-enabled Tool Container mounts this same shared volume. If two are
# opened for the first time at once (exactly what Concurrent Workspace use
# encourages), both would otherwise race to generate and register keys at the
# same time — this lock serializes them: whichever container gets here first
# does the real work, and any other container waits for the lock, then finds
# the keys already in place and skips straight to "already registered".
(
flock -x 201

DEPLOY_KEY_TITLE="{{REPO_NAME}}-devcontainer@${DEVCONTAINER_HOST}"
SIGNING_KEY_TITLE="{{REPO_NAME}}-devcontainer-signing@${DEVCONTAINER_HOST}"

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
REPO="{{REPO_SLUG}}"

ALL_DEPLOY_KEYS=$(gh api "repos/${REPO}/keys")

# Check by key content — a title match with different content means the key was
# rotated (e.g. the ssh-config volume was wiped). In that case remove the
# stale entry and re-register with the new key.
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

) 201>/home/vscode/.ssh/.setup.lock

# Signing key is separate from the deploy key so it can be registered on GitHub
# without hitting the "key is already in use" constraint.
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true
