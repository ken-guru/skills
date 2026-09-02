
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
