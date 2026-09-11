#!/bin/bash
set -euo pipefail

# Drives render-devcontainer.sh + verify-devcontainer.sh through every ssh x
# git-defaults combination, asserting verify's exit code each time. Writes
# only into a scratch mktemp directory — never .devcontainer/ — so it's safe
# to run in CI with no repo-checkout side effects.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER="$SCRIPT_DIR/render-devcontainer.sh"
VERIFY="$SCRIPT_DIR/verify-devcontainer.sh"

BOOLS="true false"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RUN_COUNT=0
FAIL_COUNT=0

run_case() {
  local ssh="$1" have_git_defaults="$2"
  RUN_COUNT=$((RUN_COUNT + 1))

  local label="ssh=$ssh git-defaults=$have_git_defaults"
  local out="$TMP_DIR/$RUN_COUNT-post-create.sh"

  local render_args=(--repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$out")
  local verify_args=(--file "$out" --repo-name "acme-widgets" --repo-slug "acme/widgets")

  if [ "$ssh" = true ]; then
    render_args+=(--ssh)
    verify_args+=(--ssh)
  fi
  if [ "$have_git_defaults" = true ]; then
    render_args+=(--git-email-default "dev@example.com" --git-name-default "Dev Example")
    verify_args+=(--git-email-default "dev@example.com" --git-name-default "Dev Example")
  fi

  if ! "$RENDER" "${render_args[@]}"; then
    echo "FAIL (render): $label" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  if ! "$VERIFY" "${verify_args[@]}" >/dev/null; then
    echo "FAIL (verify): $label" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

for ssh in $BOOLS; do
  for git_defaults in $BOOLS; do
    run_case "$ssh" "$git_defaults"
  done
done

# Spot-check the Local-Checkout git-init structural variant once.
run_case_local_checkout() {
  RUN_COUNT=$((RUN_COUNT + 1))
  local out="$TMP_DIR/$RUN_COUNT-post-create.sh"
  if ! "$RENDER" --repo-name "acme-widgets" --repo-slug "" --out "$out" \
       --local-checkout-git-init true --git-default-branch main; then
    echo "FAIL (render): local-checkout git-init" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if ! grep -q 'git init --initial-branch="main" /workspace' "$out"; then
    echo "FAIL: local-checkout git-init substitution not found in $out" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}
run_case_local_checkout

echo "Ran $RUN_COUNT combinations, $FAIL_COUNT failed."
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
