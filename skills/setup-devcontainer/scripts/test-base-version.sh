#!/bin/bash
set -euo pipefail

# Tests the Base Version Marker through its two scripts' command lines:
# write-base-version.sh records this skill's version into a .devcontainer
# directory, and check-base-version.sh <range> reports whether the marker
# satisfies a CLI Skill's caret range. Writes only into a scratch directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRITE="$SCRIPT_DIR/write-base-version.sh"
CHECK="$SCRIPT_DIR/check-base-version.sh"
RENDER="$SCRIPT_DIR/render-devcontainer.sh"
SKILL_VERSION="$(sed -n 's/^  version: "\([0-9.]*\)" # x-release-please-version$/\1/p' "$SCRIPT_DIR/../SKILL.md")"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAIL_COUNT=0

fail() {
  echo "FAIL: $1" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# expect_check <description> <marker contents or "-" for no marker> <range> <expected exit code> [<expected output fragment>]
expect_check() {
  local description="$1" marker="$2" range="$3" expected_status="$4" expected_output="${5:-}"
  local dir="$TMP_DIR/case-$RANDOM"
  mkdir -p "$dir/.devcontainer"
  if [ "$marker" != "-" ]; then printf '%s\n' "$marker" > "$dir/.devcontainer/.setup-devcontainer-version"; fi
  local output status=0
  output="$(cd "$dir" && "$CHECK" "$range" 2>&1)" || status=$?
  if [ "$status" -ne "$expected_status" ]; then
    fail "$description: expected exit $expected_status, got $status ($output)"
  elif [ -n "$expected_output" ] && ! grep -qF -- "$expected_output" <<<"$output"; then
    fail "$description: expected output to contain '$expected_output', got: $output"
  else
    echo "OK: $description"
  fi
}

expect_check "marker within the range passes" "1.4.0" "^1.0.0" 0
expect_check "marker equal to the range floor passes" "1.3.0" "^1.3.0" 0
expect_check "same major but below the floor's minor is out of range" "1.2.9" "^1.3.0" 1 "1.2.9"
expect_check "the next major is out of range" "2.0.0" "^1.0.0" 1 "Re-run setup-devcontainer first"
expect_check "a missing marker is its own outcome" "-" "^1.0.0" 3 "no Base Version Marker"
expect_check "a malformed marker is its own outcome" "v1" "^1.0.0" 4 "malformed"
expect_check "a 0.x caret range pins the minor" "0.3.0" "^0.2.0" 1
expect_check "a range that is not a caret range is a usage error" "1.0.0" ">=1.0.0" 2

# write-base-version.sh records this skill's own metadata.version.
mkdir -p "$TMP_DIR/written/.devcontainer"
"$WRITE" "$TMP_DIR/written/.devcontainer"
if [ "$(cat "$TMP_DIR/written/.devcontainer/.setup-devcontainer-version")" != "$SKILL_VERSION" ]; then
  fail "write-base-version.sh wrote '$(cat "$TMP_DIR/written/.devcontainer/.setup-devcontainer-version")', expected '$SKILL_VERSION'"
else
  echo "OK: write-base-version.sh records this skill's version ($SKILL_VERSION)"
fi

# Overwriting an older marker (a re-run against an existing container) updates it.
echo "0.9.0" > "$TMP_DIR/written/.devcontainer/.setup-devcontainer-version"
"$WRITE" "$TMP_DIR/written/.devcontainer"
if [ "$(cat "$TMP_DIR/written/.devcontainer/.setup-devcontainer-version")" != "$SKILL_VERSION" ]; then
  fail "a re-run did not update an older marker"
else
  echo "OK: a re-run updates an older marker to this skill's version"
fi

# A fresh render and a re-render both leave the marker beside post-create.sh.
mkdir -p "$TMP_DIR/rendered/.devcontainer"
for pass in 1 2; do
  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$TMP_DIR/rendered/.devcontainer/post-create.sh"
  if [ "$(cat "$TMP_DIR/rendered/.devcontainer/.setup-devcontainer-version" 2>/dev/null)" != "$SKILL_VERSION" ]; then
    fail "render pass $pass did not leave a Base Version Marker with $SKILL_VERSION"
  else
    echo "OK: render pass $pass leaves a Base Version Marker with $SKILL_VERSION"
  fi
done

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All checks passed."
