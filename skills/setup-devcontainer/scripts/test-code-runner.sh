#!/bin/bash
set -euo pipefail

# Structural contract test for the generated runner seam. Runtime identity
# and credential-denial behavior are exercised in the disposable container
# verification suite; this test keeps the generated Scaffold wiring honest.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES_DIR="$SKILL_DIR/templates"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -x "$TEMPLATES_DIR/code-runner.sh" ] || fail "runner template is executable"
grep -q 'sudo -u code-runner' "$TEMPLATES_DIR/code-runner.sh" || fail "runner uses separate identity"
grep -q 'env -i' "$TEMPLATES_DIR/code-runner.sh" || fail "runner scrubs environment"
grep -q 'HOME=/home/code-runner' "$TEMPLATES_DIR/code-runner.sh" || fail "runner sets code identity home"
grep -q 'setfacl -R -m u:code-runner:rwX /workspace' "$TEMPLATES_DIR/post-create-base.sh" || fail "post-create grants checkout ACL"
grep -q 'for protected_path in /workspace/.devcontainer /workspace/.git' "$TEMPLATES_DIR/post-create-base.sh" || fail "control-plane paths are not protected"
grep -q 'setfacl -R -m u:code-runner:r-X' "$TEMPLATES_DIR/post-create-base.sh" || fail "control-plane paths are not read-only"
grep -q 'COPY code-runner.sh /usr/local/bin/devcontainer-code-runner' "$TEMPLATES_DIR/Dockerfile" || fail "image installs runner"
grep -q 'apt-get install -y --no-install-recommends acl' "$TEMPLATES_DIR/Dockerfile" || fail "image installs ACL support"

echo "Code-runner contract checks passed."
