#!/bin/bash
set -euo pipefail
# Runs each time VS Code attaches to the container.
# If the SSH signing key hasn't been registered yet, shows a setup prompt.
# Also verifies the deploy key is live on GitHub so any accidental deletion
# is caught early.
#
# Lifecycle:
#   Prompt shows until the developer dismisses it with:
#     touch ~/.ssh/.signing-key-registered
#   That file persists in the {{REPO_NAME}}-ssh-config volume, so rebuilds stay quiet.
#   Wiping the volume resets it and the prompt reappears.

REGISTERED="$HOME/.ssh/.signing-key-registered"
REPO="{{REPO_SLUG}}"
DEPLOY_KEY_BODY=$(awk '{print $1, $2}' ~/.ssh/id_ed25519.pub 2>/dev/null)

# Always verify the deploy key on attach — catches accidental deletion even
# after the signing key has been registered.
deploy_id=$(gh api "repos/${REPO}/keys" 2>/dev/null | jq -r \
  --arg body "$DEPLOY_KEY_BODY" \
  '.[] | select((.key | split(" ")[:2] | join(" ")) == $body) | .id' || true)

if [ -z "$deploy_id" ]; then
  echo ""
  echo "⚠ Deploy key NOT found on GitHub — git push/pull will fail."
  echo "  Rebuild this Tool Container (Dev Containers: Rebuild Container) to re-register it."
  echo ""
fi

# Fast path — signing key already registered; nothing more to do.
[ -f "$REGISTERED" ] && exit 0

SIGNING_KEY_TITLE=$(awk '{print $3}' ~/.ssh/id_ed25519_signing.pub 2>/dev/null)

echo ""
echo "This registration is shared across every SSH-enabled Tool Container in this"
echo "repo — do this ONCE, from whichever tool's window shows this prompt first."
echo "Dismissing it here (see below) dismisses it for every other tool too, since"
echo "they all read the same marker file from the same shared volume."
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  Devcontainer SSH setup status                                      ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"

if [ -n "$deploy_id" ]; then
  echo "║  ✓ Deploy key registered (git push/pull: ready)                     ║"
else
  echo "║  ✗ Deploy key NOT found on GitHub — rebuild this Tool Container            ║"
fi

echo "║                                                                      ║"
echo "║  ⚠ ACTION REQUIRED — register your SSH signing key with GitHub      ║"
echo "║    This is a one-time step per machine; it survives rebuilds.        ║"
echo "║                                                                      ║"
echo "║  1. Open https://github.com/settings/ssh                            ║"
echo "║  2. If a key named below already exists there, delete it first       ║"
printf  "║     (stale from a previous setup): %-32s  ║\n" "$SIGNING_KEY_TITLE"
echo "║  3. Click 'New SSH key'                                              ║"
printf  "║  4. Title:    %-53s  ║\n" "$SIGNING_KEY_TITLE"
echo "║  5. Key type: Signing Key  ← NOT Authentication Key                 ║"
echo "║  6. Paste the public key printed below                               ║"
echo "║                                                                      ║"
echo "║  When done, dismiss this reminder:                                   ║"
echo "║    touch ~/.ssh/.signing-key-registered                              ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
cat ~/.ssh/id_ed25519_signing.pub
echo ""
