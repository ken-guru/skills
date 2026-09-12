#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$(cd "$SCRIPT_DIR/../../templates" && pwd)"
README="$TEMPLATES_DIR/README.ssh-block.md"

fail() { echo "FAIL: $1" >&2; exit 1; }

grep -q 'repository-scoped fine-grained token' "$README" || fail "repository-scoped token contract missing"
grep -q 'Issues and pull requests' "$README" || fail "issue/PR authority missing"
grep -qi 'workflow status/history' "$README" || fail "workflow read authority missing"
grep -q 'Administration permission' "$README" || fail "excluded authority missing"
grep -q 'directly through the GitHub API' "$README" || fail "direct file mutation prohibition missing"

echo "GitHub authority contract checks passed."
