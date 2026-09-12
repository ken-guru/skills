#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONTRACT="$ROOT/setup-devcontainer/docs/cli-security-contract.md"

fail() { echo "FAIL: $1" >&2; exit 1; }
[ -f "$CONTRACT" ] || fail "base CLI security contract missing"

for skill in setup-claude-devcontainer setup-codex-devcontainer setup-antigravity-devcontainer setup-copilot-devcontainer; do
  doc="$ROOT/$skill/SKILL.md"
  grep -q 'CLI Skill security contract' "$doc" || fail "$skill does not declare the base contract"
  grep -q 'devcontainer-code-runner' "$doc" || fail "$skill does not declare runner use"
  grep -q 'privileged' "$doc" || fail "$skill does not declare privileged-operation policy"
done

grep -q 'Own-Block Contract' "$CONTRACT" || fail "Own-Block Contract missing"
grep -q 'Capability Seam' "$CONTRACT" || fail "Capability Seam missing"
grep -q 'Future CLI Skills' "$CONTRACT" || fail "future CLI guidance missing"

echo "CLI security contract checks passed."
