#!/bin/bash
set -euo pipefail

# Proves patch-json-array-if-absent.sh is idempotent: running it twice
# against the same fixture produces identical output after the first run.
# Writes only into a scratch mktemp directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH="$SCRIPT_DIR/patch-json-array-if-absent.sh"

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

# --- parent key entirely absent: the Network Manifest case (issue #294).
# Unlike .runArgs above, .{cliName}.networkAllowlist may not exist at all
# yet — no "codex" key, let alone its networkAllowlist array — since a CLI
# Skill's manifest entry is created on first install, not pre-seeded by the
# base skill. ---
MANIFEST="$TMP_DIR/network-manifest.json"
MANIFEST_ENTRIES="$TMP_DIR/manifest-entries.json"

echo '{"baseline": {"networkAllowlist": ["registry.npmjs.org"]}}' > "$MANIFEST"
echo '[{"host": "api.openai.com"}, {"host": "chatgpt.com"}]' > "$MANIFEST_ENTRIES"

"$PATCH" "$MANIFEST" .codex.networkAllowlist "$MANIFEST_ENTRIES"

expected='[{"host":"api.openai.com"},{"host":"chatgpt.com"}]'
actual="$(jq -c .codex.networkAllowlist "$MANIFEST")"
if [ "$actual" != "$expected" ]; then
  echo "FAIL: creating an absent parent key, expected $expected, got $actual" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: absent parent key (.codex) created along with its networkAllowlist array"
fi

baseline_actual="$(jq -c .baseline.networkAllowlist "$MANIFEST")"
if [ "$baseline_actual" != '["registry.npmjs.org"]' ]; then
  echo "FAIL: sibling key .baseline was disturbed: $baseline_actual" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: sibling key (.baseline) left untouched"
fi

cp "$MANIFEST" "$TMP_DIR/manifest-after-run-1.json"
"$PATCH" "$MANIFEST" .codex.networkAllowlist "$MANIFEST_ENTRIES"

if ! diff -q "$TMP_DIR/manifest-after-run-1.json" "$MANIFEST" >/dev/null; then
  echo "FAIL: second run on a freshly-created parent key was not a no-op" >&2
  diff "$TMP_DIR/manifest-after-run-1.json" "$MANIFEST" >&2 || true
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: second run produced zero diff (idempotent) after creating the parent key"
fi

# --- parent key present but with other fields and no networkAllowlist yet:
# creating the array must preserve its siblings within that same object. ---
PARTIAL="$TMP_DIR/network-manifest-partial.json"
echo '{"antigravity": {"binary": "agy"}}' > "$PARTIAL"

"$PATCH" "$PARTIAL" .antigravity.networkAllowlist "$MANIFEST_ENTRIES"

expected_array='[{"host":"api.openai.com"},{"host":"chatgpt.com"}]'
actual_array="$(jq -c .antigravity.networkAllowlist "$PARTIAL")"
if [ "$actual_array" != "$expected_array" ]; then
  echo "FAIL: creating networkAllowlist on an existing-but-incomplete key, expected $expected_array, got $actual_array" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: networkAllowlist array created on an existing parent key"
fi

sibling_field="$(jq -r .antigravity.binary "$PARTIAL")"
if [ "$sibling_field" != "agy" ]; then
  echo "FAIL: sibling field .antigravity.binary was disturbed: $sibling_field" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "OK: sibling field (.antigravity.binary) left untouched"
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All checks passed."
