#!/bin/bash
set -euo pipefail

# Structural contract test for the fail-closed opt-out mechanism
# (DEVCONTAINER_ACCEPT_RESIDUAL_RISK). Runtime denial/skip behavior is
# exercised in the disposable container verification suite; this test keeps
# the generated Scaffold wiring honest.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATES_DIR="$SKILL_DIR/templates"

fail() { echo "FAIL: $1" >&2; exit 1; }

grep -q 'DEVCONTAINER_ACCEPT_RESIDUAL_RISK' "$TEMPLATES_DIR/bash-env.sh" \
  || fail "bash-env does not export the opt-out variable"
grep -q 'DEVCONTAINER_ACCEPT_RESIDUAL_RISK' "$TEMPLATES_DIR/env.baseline.example" \
  || fail "env example does not document the opt-out variable"

# residual_risk_fail_or_skip is defined once in post-create-base.sh (which
# always precedes post-create-ssh-block.sh in the rendered post-create.sh),
# and reused by the SSH block rather than duplicated.
grep -q 'residual_risk_fail_or_skip() {' "$TEMPLATES_DIR/post-create-base.sh" \
  || fail "shared opt-out helper is not defined in post-create-base.sh"
grep -q 'DEVCONTAINER_ACCEPT_RESIDUAL_RISK' "$TEMPLATES_DIR/post-create-base.sh" \
  || fail "opt-out helper does not read the opt-out variable"
grep -q 'workspace-acl' "$TEMPLATES_DIR/post-create-base.sh" \
  || fail "workspace-acl check name is not wired into post-create-base.sh"

grep -q 'residual_risk_fail_or_skip ssh-credentials' "$TEMPLATES_DIR/post-create-ssh-block.sh" \
  || fail "ssh-credentials check does not call the shared opt-out helper"
! grep -q 'residual_risk_fail_or_skip() {' "$TEMPLATES_DIR/post-create-ssh-block.sh" \
  || fail "ssh-credentials check duplicates the opt-out helper instead of reusing post-create-base.sh's"

grep -q '.ssh-setup-skipped' "$TEMPLATES_DIR/post-create-warnings-block.sh" \
  || fail "warnings snippet lost the existing ssh-credentials marker read"
grep -q 'workspace-acl' "$TEMPLATES_DIR/post-create-warnings-block.sh" \
  || fail "warnings snippet does not surface a skipped workspace-acl check"

# Every check must still fail closed by default (no opt-out set): the
# shared helper's unconditional exit path must remain, not be replaced
# outright, and every call site must guard it with `||` — a bare call would
# abort the script under `set -e` on exactly the opt-out path meant to let
# it continue.
grep -q 'exit 1' "$TEMPLATES_DIR/post-create-base.sh" \
  || fail "opt-out helper lost its fail-closed default"
if grep -qE '^\s*residual_risk_fail_or_skip [^|]*$' "$TEMPLATES_DIR/post-create-base.sh" "$TEMPLATES_DIR/post-create-ssh-block.sh"; then
  fail "found a residual_risk_fail_or_skip call not guarded by ||  (set -e would abort on opt-out)"
fi

echo "Residual-risk opt-out contract checks passed."
