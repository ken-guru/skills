#!/bin/bash
set -euo pipefail

# Checks a post-create.sh rendered by render-tool-container.sh against the
# tool/ssh/yolo combination it should have been rendered with. Independent
# of render's own control flow: it recomputes each expected block from the
# current templates (via the same shared render-lib.sh primitives render
# uses) and checks the expected content actually landed in the file, rather
# than re-invoking render and diffing — so a file that's drifted from what
# the current templates/flags would produce (a stale hand-edit, or a flag
# mismatch between how it was rendered and how it's being checked) fails
# here instead of only being caught by re-render idempotency.

usage() {
  cat >&2 <<'EOF'
Usage: verify-tool-container.sh --file <path> --tool <name> --repo-name <name> \
         --repo-slug <slug> --tool-display-name <name> --tool-name <name> \
         [--ssh] [--yolo] [--git-email-default <email>] [--git-name-default <name>]

Exits 0 if <path> contains exactly the blocks and substitutions expected for
the given tool/ssh/yolo combination, non-zero otherwise (printing every
failed check to stderr).
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/render-lib.sh
source "$SCRIPT_DIR/lib/render-lib.sh"

FILE=""
TOOL=""
REPO_NAME=""
REPO_SLUG=""
TOOL_DISPLAY_NAME=""
TOOL_NAME=""
SSH=false
YOLO=false
GIT_EMAIL_DEFAULT=""
GIT_NAME_DEFAULT=""
HAVE_GIT_EMAIL_DEFAULT=false
HAVE_GIT_NAME_DEFAULT=false

while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --tool) TOOL="$2"; shift 2 ;;
    --repo-name) REPO_NAME="$2"; shift 2 ;;
    --repo-slug) REPO_SLUG="$2"; shift 2 ;;
    --tool-display-name) TOOL_DISPLAY_NAME="$2"; shift 2 ;;
    --tool-name) TOOL_NAME="$2"; shift 2 ;;
    --ssh) SSH=true; shift ;;
    --yolo) YOLO=true; shift ;;
    --git-email-default) GIT_EMAIL_DEFAULT="$2"; HAVE_GIT_EMAIL_DEFAULT=true; shift 2 ;;
    --git-name-default) GIT_NAME_DEFAULT="$2"; HAVE_GIT_NAME_DEFAULT=true; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

missing=""
if [ -z "$FILE" ]; then missing="$missing --file"; fi
if [ -z "$TOOL" ]; then missing="$missing --tool"; fi
if [ -z "$REPO_NAME" ]; then missing="$missing --repo-name"; fi
if [ -z "$REPO_SLUG" ]; then missing="$missing --repo-slug"; fi
if [ -z "$TOOL_DISPLAY_NAME" ]; then missing="$missing --tool-display-name"; fi
if [ -z "$TOOL_NAME" ]; then missing="$missing --tool-name"; fi
if [ -n "$missing" ]; then
  echo "Missing required flag(s):$missing" >&2
  usage
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "No such file: $FILE" >&2
  exit 1
fi

FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

# Literal, contiguous substring test — safe for multi-line needles since the
# needle is a quoted parameter expansion, never interpreted as a glob.
contains() {
  local haystack="$1" needle="$2"
  [[ "$haystack" == *"$needle"* ]]
}

CONTENT="$(cat "$FILE")"

if contains "$CONTENT" '{{'; then
  fail "leftover {{...}} placeholder token found in $FILE"
fi

expected_base="$(render_base_block "$GIT_EMAIL_DEFAULT" "$HAVE_GIT_EMAIL_DEFAULT" "$GIT_NAME_DEFAULT" "$HAVE_GIT_NAME_DEFAULT")"
if ! contains "$CONTENT" "$expected_base"; then
  fail "base block missing or doesn't match expected git-identity line shape (have-email-default=$HAVE_GIT_EMAIL_DEFAULT, have-name-default=$HAVE_GIT_NAME_DEFAULT)"
fi

expected_banner="$(render_identity_banner_block "$TOOL_DISPLAY_NAME")"
if ! contains "$CONTENT" "$expected_banner"; then
  fail "identity-banner block missing or not substituted for --tool-display-name '$TOOL_DISPLAY_NAME'"
fi

expected_tool_install="$(tool_install_block "$TOOL")"
if ! contains "$CONTENT" "$expected_tool_install"; then
  fail "$TOOL's post-create-block.sh content missing (always required)"
fi

expected_yolo="$(yolo_alias_block "$TOOL")"
if [ "$YOLO" = true ]; then
  if ! contains "$CONTENT" "$expected_yolo"; then
    fail "yolo-alias block missing (--yolo was set)"
  fi
else
  if contains "$CONTENT" "$expected_yolo"; then
    fail "yolo-alias block present but --yolo was not set"
  fi
fi

expected_ssh="$(render_ssh_block "$REPO_NAME" "$REPO_SLUG" "$TOOL_NAME")"
expected_warnings="$(ssh_warnings_block)"
if [ "$SSH" = true ]; then
  if ! contains "$CONTENT" "$expected_ssh"; then
    fail "ssh block missing or not substituted correctly (--ssh was set)"
  fi
  if ! contains "$CONTENT" "$expected_warnings"; then
    fail "ssh-warnings block missing (--ssh was set)"
  fi
else
  if contains "$CONTENT" "$expected_ssh"; then
    fail "ssh block present but --ssh was not set"
  fi
  if contains "$CONTENT" "$expected_warnings"; then
    fail "ssh-warnings block present but --ssh was not set"
  fi
fi

if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES check(s) failed for $FILE" >&2
  exit 1
fi

echo "OK: $FILE"
