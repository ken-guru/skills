#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES_DIR="$SKILL_DIR/templates"

fail() { echo "FAIL: $1" >&2; exit 1; }

for file in bash-env.sh env.baseline.example devcontainer.json devcontainer.with-ssh.json post-create-ssh-block.sh; do
  [ -f "$TEMPLATES_DIR/$file" ] || fail "missing credential-boundary template: $file"
done

grep -q 'GH_TOKEN.*localEnv' "$TEMPLATES_DIR/devcontainer.json" || fail "GH_TOKEN is not host-provided"
grep -q 'DEVCONTAINER_CREDENTIALS_DIR' "$TEMPLATES_DIR/devcontainer.with-ssh.json" || fail "SSH credential mount is not host-provided"
grep -q 'CREDENTIAL_DIR="/run/devcontainer-credentials"' "$TEMPLATES_DIR/post-create-ssh-block.sh" || fail "protected credential mount is not validated"
grep -q 'mode 0600 or 0400' "$TEMPLATES_DIR/post-create-ssh-block.sh" || fail "credential permissions are not validated"
grep -q 'source "$ENV_FILE"' "$TEMPLATES_DIR/bash-env.sh" && fail "bash-env must not source workspace env"
grep -q '^GH_TOKEN=' "$TEMPLATES_DIR/env.baseline.example" && fail "workspace env example must not contain GH_TOKEN"
grep -q 'gh api' "$TEMPLATES_DIR/post-create-ssh-block.sh" && fail "SSH setup must not administer deploy keys via API"

echo "Credential-boundary contract checks passed."
