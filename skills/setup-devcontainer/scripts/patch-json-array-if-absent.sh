#!/bin/bash
set -euo pipefail

# Idempotent append into a JSON array field — the Capability Seam's
# primitive, also reused by the Network Manifest (see CONTEXT.md) for a CLI
# Skill's own .{cliName}.networkAllowlist entry. Unlike patch-if-absent.sh
# (line-oriented text), this operates on a JSON file via jq, checking array
# membership rather than a literal line match. Every entry in
# <entries-file>'s JSON array is appended to <json-path> in <file> unless
# it's already present there; safe to re-run.
#
# <json-path> need not already exist in <file> — any missing intermediate
# object along the path (e.g. .codex in .codex.networkAllowlist, when no
# "codex" key exists yet) is created as an empty object, and a missing leaf
# array is created as an empty array, both before the entries are merged
# in. This is what lets a CLI Skill create its own keyed manifest entry on
# first install rather than requiring the base skill to pre-seed every
# possible CLI's key. Existing sibling keys/fields are left untouched.

usage() {
  cat >&2 <<'EOF'
Usage: patch-json-array-if-absent.sh <file> <json-path> <entries-file>

<file>:         a JSON file to mutate in place.
<json-path>:    a jq path expression naming the target array, e.g. ".runArgs".
<entries-file>: a JSON file containing an array of values to ensure are
                present in <file>'s array at <json-path>. Each value already
                present (by deep equality) is left untouched; each absent
                value is appended, in the order given.
EOF
}

if [ "$#" -ne 3 ]; then
  usage
  exit 1
fi

FILE="$1"
JSON_PATH="$2"
ENTRIES_FILE="$3"

[ -f "$FILE" ] || { echo "patch-json-array-if-absent.sh: no such file: $FILE" >&2; exit 1; }
[ -f "$ENTRIES_FILE" ] || { echo "patch-json-array-if-absent.sh: no such entries-file: $ENTRIES_FILE" >&2; exit 1; }

TMP="$(mktemp)"
# `. // []` defaults a missing/null target array to empty before the diff
# and merge — this is what lets $JSON_PATH's parent key(s) be absent
# entirely (jq's `|=` assignment still creates every missing intermediate
# object along the path).
jq --slurpfile entries "$ENTRIES_FILE" \
   "($JSON_PATH) |= ((. // []) + (\$entries[0] - (. // [])))" \
   "$FILE" > "$TMP"
mv "$TMP" "$FILE"
