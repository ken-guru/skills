#!/bin/bash
set -euo pipefail

# One idempotent "check-then-mutate" primitive for the append/insert/delete
# textual surgery that SKILL.md and docs/adding-ssh-later.md used to spell
# out in prose at each call site (append the SSH block to .env.example and
# README.md, delete README's superseded "Not set up here" section, backfill
# missing README sections at their template position). All three
# subcommands are safe to re-run: a second run against an already-patched
# file is a no-op.

usage() {
  cat >&2 <<'EOF'
Usage:
  patch-if-absent.sh append <file> <marker> <block-file>
  patch-if-absent.sh insert-before <file> <marker> <before-heading> <block-file>
  patch-if-absent.sh delete-section <file> <heading>

append:         Appends <block-file>'s content to the end of <file>, unless
                <marker> (a literal string) already appears as a complete
                line somewhere in <file> — a whole-line match, not a
                substring, so a marker doesn't false-positive against a
                longer heading that happens to start the same way (e.g.
                "## SSH deploy key and signing key" vs "## SSH deploy key
                and signing key automation").

insert-before:  Same idempotency check as append (via <marker>), but inserts
                <block-file>'s content immediately before the first line
                that exactly matches <before-heading>, instead of at EOF —
                for backfilling a section at the position it holds in the
                current template. Falls back to appending at EOF if
                <before-heading> isn't found in <file>.

delete-section: Removes the line exactly matching <heading> through (but
                not including) the next line starting with "## ", or EOF if
                no such line follows. No-op if <heading> isn't found in
                <file>.
EOF
}

cmd_append() {
  local file="$1" marker="$2" block_file="$3"
  if grep -qxF -- "$marker" "$file"; then
    return 0
  fi
  cat "$block_file" >> "$file"
}

cmd_insert_before() {
  local file="$1" marker="$2" before_heading="$3" block_file="$4"
  if grep -qxF -- "$marker" "$file"; then
    return 0
  fi
  if ! grep -qxF -- "$before_heading" "$file"; then
    cat "$block_file" >> "$file"
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  awk -v heading="$before_heading" -v blockfile="$block_file" '
    $0 == heading {
      while ((getline line < blockfile) > 0) print line
      close(blockfile)
    }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

cmd_delete_section() {
  local file="$1" heading="$2"
  if ! grep -qxF -- "$heading" "$file"; then
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  awk -v heading="$heading" '
    BEGIN { deleting = 0 }
    $0 == heading { deleting = 1; next }
    deleting && /^## / { deleting = 0 }
    !deleting { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

if [ "$#" -lt 1 ]; then
  usage
  exit 1
fi

SUBCOMMAND="$1"
shift

case "$SUBCOMMAND" in
  append)
    if [ "$#" -ne 3 ]; then usage; exit 1; fi
    [ -f "$1" ] || { echo "patch-if-absent.sh: no such file: $1" >&2; exit 1; }
    [ -f "$3" ] || { echo "patch-if-absent.sh: no such block-file: $3" >&2; exit 1; }
    cmd_append "$1" "$2" "$3"
    ;;
  insert-before)
    if [ "$#" -ne 4 ]; then usage; exit 1; fi
    [ -f "$1" ] || { echo "patch-if-absent.sh: no such file: $1" >&2; exit 1; }
    [ -f "$4" ] || { echo "patch-if-absent.sh: no such block-file: $4" >&2; exit 1; }
    cmd_insert_before "$1" "$2" "$3" "$4"
    ;;
  delete-section)
    if [ "$#" -ne 2 ]; then usage; exit 1; fi
    [ -f "$1" ] || { echo "patch-if-absent.sh: no such file: $1" >&2; exit 1; }
    cmd_delete_section "$1" "$2"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 1
    ;;
esac
