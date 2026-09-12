# SSH credentials are developer-owned host files mounted read-only outside the
# Shared Checkout. The code identity receives no ACL on this mount.
sudo mkdir -p /home/vscode/.ssh
sudo chown -R vscode:vscode /home/vscode/.ssh
chmod 700 /home/vscode/.ssh

SSH_SKIP_MARKER="$HOME/.ssh/.ssh-setup-skipped"
rm -f "$SSH_SKIP_MARKER"
CREDENTIAL_DIR="/run/devcontainer-credentials"

# residual_risk_fail_or_skip (fails closed by default; DEVCONTAINER_ACCEPT_
# RESIDUAL_RISK can name "ssh-credentials" or "all" to record the gap and
# continue instead) is defined once in post-create-base.sh, which always
# precedes this block. On opt-out it returns 1, so every call below is
# guarded to skip the rest of SSH setup rather than proceeding against
# invalid/missing credentials.
ssh_credentials_ok=true
if [ ! -d "$CREDENTIAL_DIR" ]; then
  residual_risk_fail_or_skip ssh-credentials "SSH layer unavailable: DEVCONTAINER_CREDENTIALS_DIR is not mounted; configure it in the host environment before rebuilding." "$SSH_SKIP_MARKER" || ssh_credentials_ok=false
fi

if [ "$ssh_credentials_ok" = true ]; then
  for credential in deploy-key signing-key; do
    path="$CREDENTIAL_DIR/$credential"
    if [ ! -f "$path" ]; then
      residual_risk_fail_or_skip ssh-credentials "SSH layer unavailable: missing protected credential: $path" "$SSH_SKIP_MARKER" || { ssh_credentials_ok=false; break; }
    fi
    mode="$(stat -c '%a' "$path")"
    case "$mode" in
      600|400) ;;
      *)
        residual_risk_fail_or_skip ssh-credentials "SSH layer unavailable: $path must be mode 0600 or 0400 (actual $mode)" "$SSH_SKIP_MARKER" || { ssh_credentials_ok=false; break; }
        ;;
    esac
    if [ ! -f "$path.pub" ]; then
      residual_risk_fail_or_skip ssh-credentials "SSH layer unavailable: missing public credential: $path.pub" "$SSH_SKIP_MARKER" || { ssh_credentials_ok=false; break; }
    fi
  done
fi

if [ "$ssh_credentials_ok" = true ]; then
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
fi
