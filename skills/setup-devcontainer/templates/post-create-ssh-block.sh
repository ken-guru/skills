# SSH credentials are developer-owned host files mounted read-only outside the
# Shared Checkout. The code identity receives no ACL on this mount.
sudo mkdir -p /home/vscode/.ssh
sudo chown -R vscode:vscode /home/vscode/.ssh
chmod 700 /home/vscode/.ssh

SSH_SKIP_MARKER="$HOME/.ssh/.ssh-setup-skipped"
rm -f "$SSH_SKIP_MARKER"
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

# SSH client config uses the read-only host-provided deploy key directly.
cat > ~/.ssh/config <<EOF
Host github.com
  IdentityFile $CREDENTIAL_DIR/deploy-key
  IdentitiesOnly yes
  User git
EOF
chmod 600 ~/.ssh/config

if ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
  ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null
fi

# Git's SSH signing integration uses the matching public key to select the
# developer-provided private signing key from the same protected directory.
git config --global gpg.format ssh
git config --global user.signingkey "$CREDENTIAL_DIR/signing-key.pub"
git config --global commit.gpgsign true

echo "Protected SSH credentials validated outside the Shared Checkout."
