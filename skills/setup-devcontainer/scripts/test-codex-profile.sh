#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="$SCRIPT_DIR/../templates/seccomp-codex.json"

fail() { echo "FAIL: $1" >&2; exit 1; }

jq empty "$PROFILE" || fail "Codex seccomp profile is not valid JSON"
jq -e '.defaultAction == "SCMP_ACT_ERRNO"' "$PROFILE" >/dev/null || fail "profile must fail closed by default"
jq -e '.syscalls[].names | index("clone") and index("unshare") and index("setns") and index("mount") and index("pivot_root")' "$PROFILE" >/dev/null || fail "sandbox namespace syscalls missing"
grep -q 'seccomp=unconfined' "$PROFILE" && fail "profile must not be unconfined"
grep -q 'SYS_ADMIN' "$PROFILE" && fail "profile must not require SYS_ADMIN"

echo "Codex seccomp profile checks passed."
