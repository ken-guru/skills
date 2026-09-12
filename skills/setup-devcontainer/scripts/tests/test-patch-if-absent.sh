#!/bin/bash
set -euo pipefail

# Exercises patch-if-absent.sh's three subcommands against scratch files —
# never any real .devcontainer/ or template — asserting both the initial
# mutation and idempotency (a second run is a no-op).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH="$SCRIPT_DIR/../patch-if-absent.sh"

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

assert_file_eq() {
  local label="$1" expected_file="$2" actual_file="$3"
  RUN_COUNT=$((RUN_COUNT + 1))
  if ! diff -u "$expected_file" "$actual_file" >/tmp/patch-if-absent-diff.$$ 2>&1; then
    echo "FAIL: $label" >&2
    cat /tmp/patch-if-absent-diff.$$ >&2
    rm -f /tmp/patch-if-absent-diff.$$
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    rm -f /tmp/patch-if-absent-diff.$$
  fi
}

# --- append: first run mutates, second run is a no-op ---
append_file="$TMP_DIR/append.env"
printf 'EXISTING=1\n' > "$append_file"
block="$TMP_DIR/block.env"
printf '\nDEVCONTAINER_HOST=your-hostname-here\n' > "$block"

"$PATCH" append "$append_file" "DEVCONTAINER_HOST=your-hostname-here" "$block"
assert_eq "append: marker present after first run" \
  "1" "$(grep -cF 'DEVCONTAINER_HOST=' "$append_file")"
assert_eq "append: existing content preserved" \
  "EXISTING=1" "$(head -n1 "$append_file")"

cp "$append_file" "$TMP_DIR/append.env.after-first"
"$PATCH" append "$append_file" "DEVCONTAINER_HOST=your-hostname-here" "$block"
assert_file_eq "append: second run is a no-op" \
  "$TMP_DIR/append.env.after-first" "$append_file"

# --- append: marker must match a whole line, not just a substring of a
# longer line already present (regression: a short heading marker used to
# false-positive against a longer heading sharing its prefix) ---
prefix_collision_file="$TMP_DIR/prefix-collision.md"
printf '## SSH deploy key and signing key automation\n\nNot set up here.\n' > "$prefix_collision_file"
ssh_block="$TMP_DIR/ssh-block.md"
printf '\n## SSH deploy key and signing key\n\nReal section.\n' > "$ssh_block"
"$PATCH" append "$prefix_collision_file" "## SSH deploy key and signing key" "$ssh_block"
assert_eq "append: whole-line marker not fooled by a longer heading with the same prefix" \
  "1" "$(grep -cxF '## SSH deploy key and signing key' "$prefix_collision_file")"

# --- insert-before: content lands at the anchor, not EOF ---
readme="$TMP_DIR/README.md"
cat > "$readme" <<'EOF'
## Running tools concurrently

Some text.

## YOLO aliases

Alias text.

## Gotchas fixed here (and why)

Gotcha text.
EOF
skill_sync_block="$TMP_DIR/skill-sync-block.md"
cat > "$skill_sync_block" <<'EOF'
## Automatic skill sync

Sync text.

EOF

"$PATCH" insert-before "$readme" "## Automatic skill sync" "## YOLO aliases" "$skill_sync_block"
order="$(grep -n '^## ' "$readme" | cut -d: -f2)"
assert_eq "insert-before: section order after backfill" \
  "$(printf '## Running tools concurrently\n## Automatic skill sync\n## YOLO aliases\n## Gotchas fixed here (and why)')" \
  "$order"

cp "$readme" "$TMP_DIR/README.md.after-first"
"$PATCH" insert-before "$readme" "## Automatic skill sync" "## YOLO aliases" "$skill_sync_block"
assert_file_eq "insert-before: second run is a no-op" \
  "$TMP_DIR/README.md.after-first" "$readme"

# --- insert-before: missing anchor falls back to append at EOF ---
no_anchor_file="$TMP_DIR/no-anchor.md"
printf '## Only heading\n\nBody.\n' > "$no_anchor_file"
"$PATCH" insert-before "$no_anchor_file" "## Missing block" "## Nonexistent Anchor" "$skill_sync_block"
assert_eq "insert-before: falls back to append when anchor absent" \
  "1" "$(grep -cF '## Automatic skill sync' "$no_anchor_file")"

# --- delete-section: removes through next heading, exclusive ---
section_file="$TMP_DIR/section.md"
cat > "$section_file" <<'EOF'
## Troubleshooting

Troubleshooting text.

## SSH deploy key and signing key automation

Not set up for any tool here.

## Trailing section

Kept.
EOF
"$PATCH" delete-section "$section_file" "## SSH deploy key and signing key automation"
assert_eq "delete-section: target heading removed" \
  "0" "$(grep -cF 'SSH deploy key and signing key automation' "$section_file")"
assert_eq "delete-section: following section kept" \
  "1" "$(grep -cF '## Trailing section' "$section_file")"
assert_eq "delete-section: preceding section kept" \
  "1" "$(grep -cF '## Troubleshooting' "$section_file")"

cp "$section_file" "$TMP_DIR/section.md.after-first"
"$PATCH" delete-section "$section_file" "## SSH deploy key and signing key automation"
assert_file_eq "delete-section: second run is a no-op" \
  "$TMP_DIR/section.md.after-first" "$section_file"

# --- delete-section: heading absent is a no-op, not an error ---
absent_file="$TMP_DIR/absent.md"
printf '## Some heading\n\nBody.\n' > "$absent_file"
cp "$absent_file" "$TMP_DIR/absent.md.before"
"$PATCH" delete-section "$absent_file" "## Nonexistent"
assert_file_eq "delete-section: no-op when heading absent" \
  "$TMP_DIR/absent.md.before" "$absent_file"

echo "$RUN_COUNT assertions, $FAIL_COUNT failed"
[ "$FAIL_COUNT" -eq 0 ]
