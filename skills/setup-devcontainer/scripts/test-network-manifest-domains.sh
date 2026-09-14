#!/bin/bash
set -euo pipefail

# Exercises templates/network-manifest-domains.sh (the Network Manifest's
# jq-based derivation helper — see CONTEXT.md's "Network Manifest" and
# ADR-0005) against fixture manifest files, never any real
# .devcontainer/network-manifest.json. Covers: the seeded baseline alone, a
# manifest with multiple keyed entries, an entry with an empty
# `networkAllowlist`, an entry with the field missing entirely, dedup
# across entries, and the fail-loudly error paths (missing file, empty
# derived result).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAINS="$SCRIPT_DIR/../templates/network-manifest-domains.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RUN_COUNT=0
FAIL_COUNT=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  RUN_COUNT=$((RUN_COUNT + 1))
  if [ "$expected" != "$actual" ]; then
    echo "FAIL: $label" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_nonzero_exit() {
  local label="$1"; shift
  RUN_COUNT=$((RUN_COUNT + 1))
  if "$@" >"$TMP_DIR/last-stdout" 2>"$TMP_DIR/last-stderr"; then
    echo "FAIL: $label — expected non-zero exit, got 0" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# --- the seeded baseline alone ---
baseline_only="$TMP_DIR/baseline-only.json"
cat > "$baseline_only" <<'EOF'
{
  "baseline": {
    "networkAllowlist": [
      {"host": "registry.npmjs.org", "purpose": "npm/npx", "source": "https://docs.npmjs.com/cli/v10/using-npm/registry"},
      {"host": "github.com", "purpose": "git", "source": "https://docs.github.com/en/get-started/quickstart/set-up-git"},
      {"host": "api.github.com", "purpose": "gh CLI", "source": "https://docs.github.com/en/rest"}
    ]
  }
}
EOF
actual="$("$DOMAINS" "$baseline_only")"
expected="$(printf 'registry.npmjs.org\ngithub.com\napi.github.com')"
assert_eq "baseline alone: exact host list, in manifest order" "$expected" "$actual"

# --- multiple keyed entries ---
multi="$TMP_DIR/multi.json"
cat > "$multi" <<'EOF'
{
  "baseline": {
    "networkAllowlist": [
      {"host": "registry.npmjs.org", "purpose": "npm/npx", "source": "https://docs.npmjs.com/cli/v10/using-npm/registry"},
      {"host": "github.com", "purpose": "git", "source": "https://docs.github.com/en/get-started/quickstart/set-up-git"},
      {"host": "api.github.com", "purpose": "gh CLI", "source": "https://docs.github.com/en/rest"}
    ]
  },
  "claude": {
    "networkAllowlist": [
      {"host": "api.anthropic.com", "purpose": "Claude Code API requests", "source": "https://code.claude.com/docs/en/network-config"},
      {"host": "claude.ai", "purpose": "Claude account authentication", "source": "https://code.claude.com/docs/en/network-config"}
    ]
  },
  "codex": {
    "networkAllowlist": [
      {"host": "api.openai.com", "purpose": "Codex API requests", "source": "https://platform.openai.com/docs/api-reference"}
    ]
  }
}
EOF
actual="$("$DOMAINS" "$multi")"
expected="$(printf 'registry.npmjs.org\ngithub.com\napi.github.com\napi.anthropic.com\nclaude.ai\napi.openai.com')"
assert_eq "multiple keyed entries: every host present, in manifest order" "$expected" "$actual"

# --- a keyed entry with an empty networkAllowlist array contributes nothing ---
empty_entry="$TMP_DIR/empty-entry.json"
cat > "$empty_entry" <<'EOF'
{
  "baseline": {
    "networkAllowlist": [
      {"host": "registry.npmjs.org", "purpose": "npm/npx", "source": "https://docs.npmjs.com/cli/v10/using-npm/registry"}
    ]
  },
  "antigravity": {
    "networkAllowlist": []
  }
}
EOF
actual="$("$DOMAINS" "$empty_entry")"
expected="registry.npmjs.org"
assert_eq "empty networkAllowlist array: contributes nothing, no crash" "$expected" "$actual"

# --- a keyed entry with the field missing entirely does not crash, contributes nothing ---
missing_field="$TMP_DIR/missing-field.json"
cat > "$missing_field" <<'EOF'
{
  "baseline": {
    "networkAllowlist": [
      {"host": "registry.npmjs.org", "purpose": "npm/npx", "source": "https://docs.npmjs.com/cli/v10/using-npm/registry"}
    ]
  },
  "copilot": {
    "binary": "copilot"
  }
}
EOF
actual="$("$DOMAINS" "$missing_field")"
expected="registry.npmjs.org"
assert_eq "missing networkAllowlist field entirely: contributes nothing, no crash" "$expected" "$actual"

# --- dedup: a host repeated across two entries appears once, first-occurrence order ---
dup="$TMP_DIR/dup.json"
cat > "$dup" <<'EOF'
{
  "baseline": {
    "networkAllowlist": [
      {"host": "github.com", "purpose": "git", "source": "https://docs.github.com/en/get-started/quickstart/set-up-git"}
    ]
  },
  "someCli": {
    "networkAllowlist": [
      {"host": "github.com", "purpose": "CLI release downloads", "source": "observed"},
      {"host": "example.com", "purpose": "something else", "source": "observed"}
    ]
  }
}
EOF
actual="$("$DOMAINS" "$dup")"
expected="$(printf 'github.com\nexample.com')"
assert_eq "duplicate host across entries: deduplicated, first occurrence kept" "$expected" "$actual"

# --- missing manifest file: fail loudly ---
assert_nonzero_exit "missing manifest file exits non-zero" "$DOMAINS" "$TMP_DIR/does-not-exist.json"

# --- empty derived result (no hosts anywhere): fail loudly rather than silently allowlist nothing ---
all_empty="$TMP_DIR/all-empty.json"
cat > "$all_empty" <<'EOF'
{
  "baseline": {
    "networkAllowlist": []
  },
  "someCli": {}
}
EOF
assert_nonzero_exit "empty derived result exits non-zero" "$DOMAINS" "$all_empty"

echo "$RUN_COUNT assertions, $FAIL_COUNT failed"
[ "$FAIL_COUNT" -eq 0 ]
