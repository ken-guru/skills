#!/bin/bash
set -euo pipefail

# Structural contract test for the host-side SSH key provisioning wizard.
# It runs interactively on the developer's own host machine and touches
# real key material, so this only checks its static shape — not a live run.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WIZARD="$SKILL_DIR/templates/provision-ssh-keys.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -x "$WIZARD" ] || fail "wizard script is executable"
bash -n "$WIZARD" || fail "wizard script has a syntax error"

# Only the authored stages matter here — the shared wizard library (above
# the STAGES marker) legitimately defines open_url/set_secret/etc. even
# when this particular wizard never calls them.
STAGES="$(awk '/^# STAGES:/,0' "$WIZARD")"
[ -n "$STAGES" ] || fail "could not find the STAGES section"

# Scope: keygen + placement only, never registration.
echo "$STAGES" | grep -q 'gh api' && fail "wizard must not call the GitHub API"
echo "$STAGES" | grep -qE '^\s*open_url ' && fail "wizard must not open a browser (no dashboard step exists)"
echo "$STAGES" | grep -q 'post-attach.sh' || fail "wizard must point registration at the existing post-attach.sh flow"

# Deploy key: always freshly generated, never reused across repos.
echo "$STAGES" | grep -q 'deploy-key' || fail "wizard does not provision a deploy key"
echo "$STAGES" | grep -qiE 'reuse.*deploy-key|deploy-key.*reuse' \
  && fail "deploy key must always be freshly generated, never offered for reuse"

# Signing key: detect-and-reuse across repos from a shared, account-scoped
# location outside any single repo's Credential Directory.
echo "$STAGES" | grep -q 'SHARED_SIGNING' || fail "wizard does not check a shared signing-key location"
echo "$STAGES" | grep -q 'Reuse it' || fail "wizard does not offer to reuse an existing signing key"

# Never silently overwrite existing key material.
echo "$STAGES" | grep -q 'confirm "Overwrite' || fail "wizard does not confirm before overwriting an existing key"

# Permissions: private keys 600, public keys 644.
echo "$STAGES" | grep -q 'chmod 600' || fail "wizard does not lock down private key permissions"
echo "$STAGES" | grep -q 'chmod 644' || fail "wizard does not set public key permissions"

# Must actually be wired into the skill's own instructions, not orphaned.
grep -q 'templates/provision-ssh-keys.sh' "$SKILL_DIR/SKILL.md" \
  || fail "SKILL.md does not reference provision-ssh-keys.sh — orphaned script"

echo "SSH key wizard contract checks passed."
