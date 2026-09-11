#!/bin/bash
set -euo pipefail

# Checks a post-create.sh rendered by render-devcontainer.sh against the ssh
# flag it should have been rendered with. Independent of render's own
# control flow: it recomputes each expected block from the current templates
# (via the same shared render-lib.sh primitives render uses) and checks the
# expected content actually landed in the file.

usage() {
  cat >&2 <<'EOF'
Usage: verify-devcontainer.sh --file <path> --repo-name <name> --repo-slug <slug> \
         [--ssh] [--git-email-default <email>] [--git-name-default <name>] \
         [--local-checkout-git-init <true|false>] [--git-default-branch <branch>]

Exits 0 if <path> contains exactly the blocks and substitutions expected for
the given flag combination, non-zero otherwise (printing every failed check
to stderr).
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/render-lib.sh
source "$SCRIPT_DIR/lib/render-lib.sh"

FILE=""
REPO_NAME=""
REPO_SLUG=""
SSH=false
GIT_EMAIL_DEFAULT=""
GIT_NAME_DEFAULT=""
HAVE_GIT_EMAIL_DEFAULT=false
HAVE_GIT_NAME_DEFAULT=false
LOCAL_CHECKOUT_GIT_INIT="false"
GIT_DEFAULT_BRANCH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --repo-name) REPO_NAME="$2"; shift 2 ;;
    --repo-slug) REPO_SLUG="$2"; shift 2 ;;
    --ssh) SSH=true; shift ;;
    --git-email-default) GIT_EMAIL_DEFAULT="$2"; HAVE_GIT_EMAIL_DEFAULT=true; shift 2 ;;
    --git-name-default) GIT_NAME_DEFAULT="$2"; HAVE_GIT_NAME_DEFAULT=true; shift 2 ;;
    --local-checkout-git-init) LOCAL_CHECKOUT_GIT_INIT="$2"; shift 2 ;;
    --git-default-branch) GIT_DEFAULT_BRANCH="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

missing=""
if [ -z "$FILE" ]; then missing="$missing --file"; fi
if [ -z "$REPO_NAME" ]; then missing="$missing --repo-name"; fi
# --repo-slug is legitimately empty for Local Checkout (no GitHub origin yet).
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

expected_base="$(render_base_block "$GIT_EMAIL_DEFAULT" "$HAVE_GIT_EMAIL_DEFAULT" "$GIT_NAME_DEFAULT" "$HAVE_GIT_NAME_DEFAULT" \
  "$LOCAL_CHECKOUT_GIT_INIT" "$GIT_DEFAULT_BRANCH")"
if ! contains "$CONTENT" "$expected_base"; then
  fail "base block missing or doesn't match expected shape (have-email-default=$HAVE_GIT_EMAIL_DEFAULT, have-name-default=$HAVE_GIT_NAME_DEFAULT)"
fi

expected_install_cli_block="$(install_cli_block)"
if ! contains "$CONTENT" "$expected_install_cli_block"; then
  fail "install-cli-block.sh content missing (always required)"
fi

expected_ssh="$(render_ssh_block "$REPO_SLUG" "$REPO_NAME")"
expected_warnings="$(ssh_warnings_block)"
if [ "$SSH" = true ]; then
  if ! contains "$CONTENT" "$expected_ssh"; then
    fail "ssh block missing or not substituted correctly (--ssh was set)"
  fi
  if ! contains "$CONTENT" "$expected_warnings"; then
    fail "ssh-warnings block missing (--ssh was set)"
  fi

  # Key generation and SSH client config must run unconditionally — only the
  # optional deploy-key auto-registration convenience may be gated on
  # GH_TOKEN. SSH_SETUP_OK was the old whole-block gate; its reappearance
  # would mean key generation silently depends on GH_TOKEN again.
  if contains "$CONTENT" 'SSH_SETUP_OK'; then
    fail "SSH_SETUP_OK (whole-block GH_TOKEN gate) found — key generation must not depend on GH_TOKEN"
  fi
  if ! contains "$CONTENT" 'if [ -z "${DEVCONTAINER_HOST:-}" ]'; then
    fail "DEVCONTAINER_HOST gate missing — it's the only precondition key generation may still skip on"
  fi
  if ! contains "$CONTENT" '.deploy-key-registered'; then
    fail "deploy-key-registered marker missing — auto-registration must record success for post-attach.sh to read"
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
