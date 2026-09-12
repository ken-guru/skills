#!/bin/bash
set -euo pipefail

# Proves patch-json-array-if-absent.sh is idempotent: running it twice
# against the same fixture produces identical output after the first run.
# Writes only into a scratch mktemp directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH="$SCRIPT_DIR/../patch-json-array-if-absent.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE="$TMP_DIR/devcontainer.json"
ENTRIES="$TMP_DIR/entries.json"

echo '{"runArgs": ["--pre-existing-flag"]}' > "$FIXTURE"
echo '["--pre-existing-flag", "--cap-add=SYS_ADMIN", "--security-opt=seccomp=unconfined"]' > "$ENTRIES"

FAIL_COUNT=0

"$PATCH" "$FIXTURE" .runArgs "$ENTRIES"

expected='["--pre-existing-flag","--cap-add=SYS_ADMIN","--security-opt=seccomp=unconfined"]'
actual="$(jq -c .runArgs "$FIXTURE")"
if [ "$actual" != "$expected" ]; then
  echo "FAIL: after first run, expected $expected, got $actual" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: first run added only the missing entries, preserved the pre-existing one, no duplicates"
fi

cp "$FIXTURE" "$TMP_DIR/after-run-1.json"
"$PATCH" "$FIXTURE" .runArgs "$ENTRIES"

if ! diff -q "$TMP_DIR/after-run-1.json" "$FIXTURE" >/dev/null; then
  echo "FAIL: second run was not a no-op" >&2
  diff "$TMP_DIR/after-run-1.json" "$FIXTURE" >&2 || true
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: second run produced zero diff (idempotent)"
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All checks passed."
