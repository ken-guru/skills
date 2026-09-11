
# SSH identity — one shared deploy key and one shared signing key,
# persisted in the {{REPO_NAME}}-ssh volume for the whole container. There's
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
REPO="{{REPO_SLUG}}"

if [ -z "${DEVCONTAINER_HOST:-}" ]; then
  reason="DEVCONTAINER_HOST is not set in .devcontainer/.env (run \`hostname\` on your host to find it)."
  echo "⚠ SSH layer skipped this build: $reason" >&2
  echo "  Set it, then Dev Containers: Rebuild Container." >&2
  echo "$reason" > "$SSH_SKIP_MARKER"
else

DEPLOY_KEY_TITLE="{{REPO_NAME}}-devcontainer@${DEVCONTAINER_HOST}"
SIGNING_KEY_TITLE="{{REPO_NAME}}-devcontainer-signing@${DEVCONTAINER_HOST}"

# Deploy key — used for git transport (push/pull). Generated locally
# regardless of GH_TOKEN; GitHub-side registration is a separate concern
# handled below/in post-attach.sh, not a precondition of generating it.
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

# Signing key config is local git config only, no GH_TOKEN involved —
# GitHub-side registration is always manual (see post-attach.sh), since
# there's no API-driven way to do it without granting GH_TOKEN
# account-level write:ssh_signing_key, which would let it manage every
# signing key on the account, not just this project's.
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true

# Deploy-key registration on GitHub is manual by default — post-attach.sh
# prints the public key to paste in, and GH_TOKEN needs no Administration
# scope for that path at all. This is the one OPTIONAL, opportunistic
# convenience: if GH_TOKEN happens to already carry Administration access,
# register (and, on rotation, replace) the deploy key automatically so
# post-attach.sh's deploy-key prompt never has to appear. Any failure here —
# missing token, invalid token, insufficient (e.g. read-only) Administration
# — is silently left to the manual path; it's never an error and never
# blocks anything above this point.
if ALL_DEPLOY_KEYS=$(gh api "repos/${REPO}/keys" 2>/dev/null); then
  DEPLOY_PUBKEY=$(cat ~/.ssh/id_ed25519.pub)
  DEPLOY_KEY_BODY=$(echo "$DEPLOY_PUBKEY" | awk '{print $1, $2}')

  # Check by key content — a title match with different content means the key was
  # rotated (e.g. the ssh volume was wiped). In that case remove the stale
  # entry and re-register with the new key.
  existing_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
    --arg body "$DEPLOY_KEY_BODY" \
    '.[] | select((.key | split(" ")[:2] | join(" ")) == $body) | .id')

  if [ -n "$existing_id" ]; then
    echo "Deploy key already registered: $DEPLOY_KEY_TITLE"
    touch ~/.ssh/.deploy-key-registered
  else
    # GitHub doesn't enforce title uniqueness, so bound this to exactly one
    # match — a multi-line result here would break the DELETE call below.
    stale_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
      --arg title "$DEPLOY_KEY_TITLE" \
      '.[] | select(.title == $title) | .id' | head -1)
    if [ -n "$stale_id" ]; then
      if gh api "repos/${REPO}/keys/${stale_id}" -X DELETE 2>/dev/null; then
        echo "Removed stale deploy key (volume was rotated): $DEPLOY_KEY_TITLE"
      fi
    fi
    if gh api "repos/${REPO}/keys" -X POST \
        -f title="$DEPLOY_KEY_TITLE" -f key="$DEPLOY_PUBKEY" -F read_only=false 2>/dev/null; then
      echo "Deploy key auto-registered (GH_TOKEN has Administration access): $DEPLOY_KEY_TITLE"
      touch ~/.ssh/.deploy-key-registered
    fi
  fi
fi

fi
