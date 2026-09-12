#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

run() {
  echo "==> $*"
  "$@"
}

run "$SCRIPT_DIR/test-code-runner.sh"
run "$SCRIPT_DIR/test-credential-boundary.sh"
run "$SCRIPT_DIR/test-residual-risk-opt-out.sh"
run "$SCRIPT_DIR/test-ssh-key-wizard.sh"
run "$SCRIPT_DIR/test-github-authority.sh"
run "$SCRIPT_DIR/test-codex-profile.sh"
run "$SCRIPT_DIR/test-skills-refresh.sh"
run "$SCRIPT_DIR/test-cli-security-contract.sh"
run "$SCRIPT_DIR/test-devcontainer.sh"
run "$SCRIPT_DIR/test-integration.sh"
run bash -n \
  "$ROOT/.devcontainer/bash-env.sh" \
  "$ROOT/.devcontainer/post-create.sh" \
  "$ROOT/.devcontainer/post-start.sh" \
  "$ROOT/.devcontainer/post-attach.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }

grep -q 'devcontainer-code-runner' "$ROOT/.devcontainer/code-runner.sh" || fail "current runner missing"
grep -q 'setfacl -R -m u:code-runner:rwX /workspace' "$ROOT/.devcontainer/post-create.sh" || fail "current checkout ACL missing"
grep -q 'for protected_path in /workspace/.devcontainer /workspace/.git' "$ROOT/.devcontainer/post-create.sh" || fail "current control-plane paths are not protected"
grep -q 'setfacl -R -m u:code-runner:r-X' "$ROOT/.devcontainer/post-create.sh" || fail "current control-plane paths are not read-only"
grep -q 'skills-refresh.sh' "$ROOT/.devcontainer/post-start.sh" || fail "current refresh primitive not wired"
grep -q 'DEVCONTAINER_CREDENTIALS_DIR' "$ROOT/.devcontainer/devcontainer.json" || fail "current protected credential mount missing"
grep -q 'localEnv:GH_TOKEN' "$ROOT/.devcontainer/devcontainer.json" || fail "current host token injection missing"
grep -q 'seccomp-codex.json' "$ROOT/.devcontainer/devcontainer.json" || fail "current Codex profile missing"
if grep -qE 'seccomp=unconfined|cap-add=SYS_ADMIN|systempaths=unconfined' "$ROOT/.devcontainer/devcontainer.json"; then
  fail "current Scaffold still contains a broad runtime exception"
fi
if grep -qE 'rm -rf .*(claude|codex|copilot|antigravity)/skills' "$ROOT/.devcontainer/post-start.sh"; then
  fail "current refresh still destructively wipes skills"
fi

echo "Automated Shared Container security-boundary checks passed."
echo "Fresh-container runtime, credential, GitHub-authority, and signing probes remain required before merge."
