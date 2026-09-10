#!/bin/bash
set -euo pipefail

# Idempotent append into a JSON array field — the Capability Seam's
# primitive. Unlike patch-if-absent.sh (line-oriented text), this operates
# on a JSON file via jq, checking array membership rather than a literal
# line match. Every entry in <entries-file>'s JSON array is appended to
# <json-path> in <file> unless it's already present there; safe to re-run.

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
jq --slurpfile entries "$ENTRIES_FILE" \
   "($JSON_PATH) |= (. + (\$entries[0] - .))" \
   "$FILE" > "$TMP"
mv "$TMP" "$FILE"
