#!/bin/bash
set -euo pipefail

# Assembles the shared devcontainer's post-create.sh skeleton — the base
# git-identity/Local-Checkout setup, the shared install_cli/chown_config_volume
# function definitions, and (optionally) the SSH block pair. Every CLI skill
# appends its own install block after this skeleton exists.

usage() {
  cat >&2 <<'EOF'
Usage: render-devcontainer.sh --repo-name <name> --repo-slug <slug> \
         --out <path> [--ssh] \
         [--git-email-default <email>] [--git-name-default <name>] \
         [--local-checkout-git-init <true|false>] [--git-default-branch <branch>] \
         [--post-start-out <path>] [--firewall]

Writes post-create.sh's base skeleton to --out (chmod +x'd), in the fixed
order:
  1. post-create-base.sh   (always — git identity, Local Checkout git-init)
  2. install-cli-block.sh  (always — shared chown_config_volume/install_cli)
  3. post-create-ssh-block.sh + post-create-warnings-block.sh (only with --ssh)

--git-email-default/--git-name-default are optional: when omitted, the
corresponding git identity line hard-requires the matching .env variable
instead of falling back to a default.

--post-start-out, if given, also writes post-start.sh's content to that path
(chmod +x'd): post-start-base.sh's skeleton, plus the firewall invocation
block appended when --firewall is set. The firewall layer never touches
post-create.sh (its capability grant is a devcontainer.json Capability Seam
patch, applied separately — see SKILL.md step 5), only post-start.sh, so
this is a second, independent output rather than another post-create.sh
block.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/render-lib.sh
source "$SCRIPT_DIR/lib/render-lib.sh"

REPO_NAME=""
REPO_SLUG=""
OUT=""
SSH=false
GIT_EMAIL_DEFAULT=""
GIT_NAME_DEFAULT=""
HAVE_GIT_EMAIL_DEFAULT=false
HAVE_GIT_NAME_DEFAULT=false
LOCAL_CHECKOUT_GIT_INIT="false"
GIT_DEFAULT_BRANCH=""
POST_START_OUT=""
FIREWALL=false

while [ $# -gt 0 ]; do
  case "$1" in
    --repo-name) REPO_NAME="$2"; shift 2 ;;
    --repo-slug) REPO_SLUG="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --ssh) SSH=true; shift ;;
    --git-email-default) GIT_EMAIL_DEFAULT="$2"; HAVE_GIT_EMAIL_DEFAULT=true; shift 2 ;;
    --git-name-default) GIT_NAME_DEFAULT="$2"; HAVE_GIT_NAME_DEFAULT=true; shift 2 ;;
    --local-checkout-git-init) LOCAL_CHECKOUT_GIT_INIT="$2"; shift 2 ;;
    --git-default-branch) GIT_DEFAULT_BRANCH="$2"; shift 2 ;;
    --post-start-out) POST_START_OUT="$2"; shift 2 ;;
    --firewall) FIREWALL=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

missing=""
if [ -z "$REPO_NAME" ]; then missing="$missing --repo-name"; fi
if [ -z "$OUT" ]; then missing="$missing --out"; fi
# --repo-slug is legitimately empty for Local Checkout (no GitHub origin yet).
if [ -n "$missing" ]; then
  echo "Missing required flag(s):$missing" >&2
  usage
  exit 1
fi

{
  render_base_block "$GIT_EMAIL_DEFAULT" "$HAVE_GIT_EMAIL_DEFAULT" "$GIT_NAME_DEFAULT" "$HAVE_GIT_NAME_DEFAULT" \
    "$LOCAL_CHECKOUT_GIT_INIT" "$GIT_DEFAULT_BRANCH"
  echo
  install_cli_block
  echo

  if [ "$SSH" = true ]; then
    render_ssh_block "$REPO_SLUG" "$REPO_NAME"
    echo
    ssh_warnings_block
    echo
  fi
} > "$OUT"

chmod +x "$OUT"

if [ -n "$POST_START_OUT" ]; then
  {
    post_start_base_block
    if [ "$FIREWALL" = true ]; then
      firewall_post_start_block
    fi
  } > "$POST_START_OUT"

  chmod +x "$POST_START_OUT"
fi
