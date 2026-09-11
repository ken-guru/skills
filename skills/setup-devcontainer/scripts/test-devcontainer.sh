#!/bin/bash
set -euo pipefail

# Drives render-devcontainer.sh + verify-devcontainer.sh through every ssh x
# git-defaults combination, asserting verify's exit code each time. Writes
# only into a scratch mktemp directory — never .devcontainer/ — so it's safe
# to run in CI with no repo-checkout side effects.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER="$SCRIPT_DIR/render-devcontainer.sh"
VERIFY="$SCRIPT_DIR/verify-devcontainer.sh"
# shellcheck source=lib/render-lib.sh
source "$SCRIPT_DIR/lib/render-lib.sh"

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

# post-attach.sh isn't part of render-devcontainer.sh's own output (it's a
# single always-substituted file, not one of the conditional post-create.sh
# blocks), so it gets its own spot-check here rather than going through
# verify-devcontainer.sh's --file model. Deploy-key liveness must be judged
# via SSH transport, not a GitHub API call — the API call needs
# Administration scope this script must never require.
check_post_attach() {
  RUN_COUNT=$((RUN_COUNT + 1))
  local label="post-attach.sh content"
  local content
  content="$(render_post_attach_block "acme/widgets")"

  if [[ "$content" == *'{{'* ]]; then
    echo "FAIL: $label — leftover {{...}} placeholder" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if [[ "$content" != *'ssh -T'* ]]; then
    echo "FAIL: $label — expected an SSH-transport liveness probe (ssh -T ...)" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if [[ "$content" != *'successfully authenticated'* ]]; then
    echo "FAIL: $label — expected the probe to classify success via GitHub's greeting text" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if [[ "$content" == *'gh api'* ]]; then
    echo "FAIL: $label — must not call the GitHub API (needs zero GH_TOKEN scope)" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if [[ "$content" != *'.deploy-key-registered'* ]]; then
    echo "FAIL: $label — expected a .deploy-key-registered marker, parallel to .signing-key-registered" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
}
check_post_attach

echo "Ran $RUN_COUNT combinations, $FAIL_COUNT failed."
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
