#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROFILE="$SCRIPT_DIR/../../templates/seccomp-codex.json"

fail() { echo "FAIL: $1" >&2; exit 1; }

# The profile is Codex-specific: it must be Codex-installed, not
# unconditionally installed by the base skill regardless of use (Own-Block
# Contract). The reviewed source itself stays base-owned.
grep -q 'seccomp-codex.json' "$SKILLS_ROOT/setup-devcontainer/SKILL.md" \
  && fail "base skill's generation steps must not install seccomp-codex.json unconditionally"
grep -q 'cp setup-devcontainer/templates/seccomp-codex.json' "$SKILLS_ROOT/setup-codex-devcontainer/SKILL.md" \
  || fail "setup-codex-devcontainer does not install the reviewed profile itself"

jq empty "$PROFILE" || fail "Codex seccomp profile is not valid JSON"
jq -e '.defaultAction == "SCMP_ACT_ERRNO"' "$PROFILE" >/dev/null || fail "profile must fail closed by default"
jq -e '.syscalls[].names | index("clone") and index("unshare") and index("setns") and index("mount") and index("pivot_root")' "$PROFILE" >/dev/null || fail "sandbox namespace syscalls missing"
jq -e '.syscalls[].names | index("setxattr") and index("getxattr")' "$PROFILE" >/dev/null || fail "ACL extended-attribute syscalls missing"
grep -q 'seccomp=unconfined' "$PROFILE" && fail "profile must not be unconfined"
grep -q 'SYS_ADMIN' "$PROFILE" && fail "profile must not require SYS_ADMIN"

echo "Codex seccomp profile checks passed."
