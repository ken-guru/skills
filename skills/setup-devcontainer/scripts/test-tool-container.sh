#!/bin/bash
set -euo pipefail

# Drives render-tool-container.sh + verify-tool-container.sh through every
# tool x ssh x yolo combination, plus the git-default-omitted structural
# variant, asserting verify's exit code each time. Writes only into a
# scratch mktemp directory — never .devcontainer/ — so it's safe to run in
# CI with no repo-checkout side effects.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER="$SCRIPT_DIR/render-tool-container.sh"
VERIFY="$SCRIPT_DIR/verify-tool-container.sh"

TOOLS="claude-code codex antigravity copilot"
BOOLS="true false"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RUN_COUNT=0
FAIL_COUNT=0

run_case() {
  local tool="$1" ssh="$2" yolo="$3" have_git_defaults="$4"
  RUN_COUNT=$((RUN_COUNT + 1))

  local label="tool=$tool ssh=$ssh yolo=$yolo git-defaults=$have_git_defaults"
  local out="$TMP_DIR/$RUN_COUNT-post-create.sh"

  local render_args=(--tool "$tool" --repo-name "acme-widgets" --repo-slug "acme/widgets" \
    --tool-display-name "Test Tool" --tool-name "$tool" --out "$out")
  local verify_args=(--file "$out" --tool "$tool" --repo-name "acme-widgets" --repo-slug "acme/widgets" \
    --tool-display-name "Test Tool" --tool-name "$tool")

  if [ "$ssh" = true ]; then
    render_args+=(--ssh)
    verify_args+=(--ssh)
  fi
  if [ "$yolo" = true ]; then
    render_args+=(--yolo)
    verify_args+=(--yolo)
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

# Core matrix: every tool x ssh x yolo combination, with git defaults
# supplied (the everyday case where the host has a git identity configured).
for tool in $TOOLS; do
  for ssh in $BOOLS; do
    for yolo in $BOOLS; do
      run_case "$tool" "$ssh" "$yolo" true
    done
  done
done

# Spot-check the git-default-omitted structural variant (the `:?required`
# line shape) once with ssh and once without, rather than doubling the full
# matrix for a dimension that only affects two lines in one block.
run_case "claude-code" false false false
run_case "claude-code" true false false

echo "Ran $RUN_COUNT combinations, $FAIL_COUNT failed."
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
