#!/bin/bash
set -euo pipefail

# Assembles one Tool Container's post-create.sh from the fixed 6-block
# template order described in SKILL.md step 6, replacing per-run
# hand-concatenation by the invoking agent with one deterministic script.

usage() {
  cat >&2 <<'EOF'
Usage: render-tool-container.sh --tool <name> --repo-name <name> --repo-slug <slug> \
         --tool-display-name <name> --tool-name <name> --out <path> \
         [--ssh] [--yolo] [--git-email-default <email>] [--git-name-default <name>]

Writes .devcontainer/<tool>/post-create.sh-equivalent content to --out
(chmod +x'd), assembled from skills/setup-devcontainer/templates/ in the
fixed 6-block order:
  1. post-create-base.sh          (always)
  2. identity-banner-block.sh     (always)
  3. <tool>/post-create-block.sh  (always)
  4. <tool>/yolo-alias-block.sh   (only with --yolo)
  5. post-create-ssh-block.sh     (only with --ssh)
  6. post-create-warnings-block.sh (only with --ssh)

--git-email-default/--git-name-default are optional: when omitted, the
corresponding git identity line hard-requires the matching .env variable
instead of falling back to a default.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/render-lib.sh
source "$SCRIPT_DIR/lib/render-lib.sh"

TOOL=""
REPO_NAME=""
REPO_SLUG=""
TOOL_DISPLAY_NAME=""
TOOL_NAME=""
OUT=""
SSH=false
YOLO=false
GIT_EMAIL_DEFAULT=""
GIT_NAME_DEFAULT=""
HAVE_GIT_EMAIL_DEFAULT=false
HAVE_GIT_NAME_DEFAULT=false

while [ $# -gt 0 ]; do
  case "$1" in
    --tool) TOOL="$2"; shift 2 ;;
    --repo-name) REPO_NAME="$2"; shift 2 ;;
    --repo-slug) REPO_SLUG="$2"; shift 2 ;;
    --tool-display-name) TOOL_DISPLAY_NAME="$2"; shift 2 ;;
    --tool-name) TOOL_NAME="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --ssh) SSH=true; shift ;;
    --yolo) YOLO=true; shift ;;
    --git-email-default) GIT_EMAIL_DEFAULT="$2"; HAVE_GIT_EMAIL_DEFAULT=true; shift 2 ;;
    --git-name-default) GIT_NAME_DEFAULT="$2"; HAVE_GIT_NAME_DEFAULT=true; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

missing=""
if [ -z "$TOOL" ]; then missing="$missing --tool"; fi
if [ -z "$REPO_NAME" ]; then missing="$missing --repo-name"; fi
if [ -z "$REPO_SLUG" ]; then missing="$missing --repo-slug"; fi
if [ -z "$TOOL_DISPLAY_NAME" ]; then missing="$missing --tool-display-name"; fi
if [ -z "$TOOL_NAME" ]; then missing="$missing --tool-name"; fi
if [ -z "$OUT" ]; then missing="$missing --out"; fi
if [ -n "$missing" ]; then
  echo "Missing required flag(s):$missing" >&2
  usage
  exit 1
fi

{
  render_base_block "$GIT_EMAIL_DEFAULT" "$HAVE_GIT_EMAIL_DEFAULT" "$GIT_NAME_DEFAULT" "$HAVE_GIT_NAME_DEFAULT"
  echo
  render_identity_banner_block "$TOOL_DISPLAY_NAME"
  echo
  tool_install_block "$TOOL"
  echo

  if [ "$YOLO" = true ]; then
    yolo_alias_block "$TOOL"
    echo
  fi

  if [ "$SSH" = true ]; then
    render_ssh_block "$REPO_NAME" "$REPO_SLUG" "$TOOL_NAME"
    echo
    ssh_warnings_block
    echo
  fi
} > "$OUT"

chmod +x "$OUT"
