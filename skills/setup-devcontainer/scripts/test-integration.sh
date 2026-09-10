#!/bin/bash
set -euo pipefail

# End-to-end integration check across all four CLI skills: renders a base
# devcontainer, then applies every CLI skill's patches (in two different
# orderings), asserting the result is coherent and a second full pass is a
# complete no-op. Writes only into a scratch mktemp directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RENDER="$SCRIPT_DIR/render-devcontainer.sh"
PATCH="$SCRIPT_DIR/patch-if-absent.sh"
PATCH_JSON="$SCRIPT_DIR/patch-json-array-if-absent.sh"

FAIL_COUNT=0

fail() {
  echo "FAIL: $1" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# tool-dir marker
TOOLS=(
  "setup-claude-devcontainer:# --- Claude Code ---"
  "setup-codex-devcontainer:# --- Codex ---"
  "setup-antigravity-devcontainer:# --- Antigravity ---"
  "setup-copilot-devcontainer:# --- Copilot ---"
)

run_scenario() {
  local order_desc="$1"
  shift
  local tool_order=("$@")

  local TMP_DIR
  TMP_DIR="$(mktemp -d)"

  cp "$SKILLS_ROOT/setup-devcontainer/templates/devcontainer.json" "$TMP_DIR/devcontainer.json"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/README.baseline.md" "$TMP_DIR/README.md"
  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$TMP_DIR/post-create.sh"

  for tool_dir in "${tool_order[@]}"; do
    local marker=""
    for entry in "${TOOLS[@]}"; do
      if [ "${entry%%:*}" = "$tool_dir" ]; then
        marker="${entry#*:}"
      fi
    done
    local tool_templates="$SKILLS_ROOT/$tool_dir/templates"
    "$PATCH" append "$TMP_DIR/post-create.sh" "$marker" "$tool_templates/install-block.sh"
    "$PATCH" append "$TMP_DIR/README.md" "$(head -1 "$tool_templates/readme-bullet.md")" "$tool_templates/readme-bullet.md"
    if [ -f "$tool_templates/capability-seam-entries.json" ]; then
      "$PATCH_JSON" "$TMP_DIR/devcontainer.json" .runArgs "$tool_templates/capability-seam-entries.json"
    fi
  done

  # Assertions, pass 1
  local marker_count
  marker_count=$(grep -c '^# --- .* ---$' "$TMP_DIR/post-create.sh" || true)
  if [ "$marker_count" -ne 4 ]; then
    fail "[$order_desc] expected 4 install-block markers in post-create.sh, found $marker_count"
  fi

  local bullet_count
  bullet_count=$(awk '/^## Installed CLI Tools$/{found=1; next} found && /^- /{c++} END{print c+0}' "$TMP_DIR/README.md")
  if [ "$bullet_count" -ne 4 ]; then
    fail "[$order_desc] expected 4 bullets under '## Installed CLI Tools', found $bullet_count"
  fi

  local runargs
  runargs=$(jq -c '.runArgs | sort' "$TMP_DIR/devcontainer.json")
  local expected='["--cap-add=SYS_ADMIN","--security-opt=seccomp=unconfined","--security-opt=systempaths=unconfined"]'
  if [ "$runargs" != "$expected" ]; then
    fail "[$order_desc] expected runArgs to contain exactly Codex's capability entries, got $runargs"
  fi

  if ! jq empty "$TMP_DIR/devcontainer.json" 2>/dev/null; then
    fail "[$order_desc] devcontainer.json is not valid JSON after all patches"
  fi

  # Second full pass — every patch re-applied — must be a complete no-op.
  cp "$TMP_DIR/post-create.sh" "$TMP_DIR/post-create.sh.before-pass2"
  cp "$TMP_DIR/README.md" "$TMP_DIR/README.md.before-pass2"
  cp "$TMP_DIR/devcontainer.json" "$TMP_DIR/devcontainer.json.before-pass2"

  for tool_dir in "${tool_order[@]}"; do
    local marker=""
    for entry in "${TOOLS[@]}"; do
      if [ "${entry%%:*}" = "$tool_dir" ]; then
        marker="${entry#*:}"
      fi
    done
    local tool_templates="$SKILLS_ROOT/$tool_dir/templates"
    "$PATCH" append "$TMP_DIR/post-create.sh" "$marker" "$tool_templates/install-block.sh"
    "$PATCH" append "$TMP_DIR/README.md" "$(head -1 "$tool_templates/readme-bullet.md")" "$tool_templates/readme-bullet.md"
    if [ -f "$tool_templates/capability-seam-entries.json" ]; then
      "$PATCH_JSON" "$TMP_DIR/devcontainer.json" .runArgs "$tool_templates/capability-seam-entries.json"
    fi
  done

  if ! diff -q "$TMP_DIR/post-create.sh.before-pass2" "$TMP_DIR/post-create.sh" >/dev/null; then
    fail "[$order_desc] second pass changed post-create.sh — not idempotent"
  fi
  if ! diff -q "$TMP_DIR/README.md.before-pass2" "$TMP_DIR/README.md" >/dev/null; then
    fail "[$order_desc] second pass changed README.md — not idempotent"
  fi
  if ! diff -q "$TMP_DIR/devcontainer.json.before-pass2" "$TMP_DIR/devcontainer.json" >/dev/null; then
    fail "[$order_desc] second pass changed devcontainer.json — not idempotent"
  fi

  rm -rf "$TMP_DIR"
  echo "OK: $order_desc"
}

run_scenario "claude,codex,antigravity,copilot" \
  setup-claude-devcontainer setup-codex-devcontainer setup-antigravity-devcontainer setup-copilot-devcontainer

run_scenario "copilot,antigravity,codex,claude" \
  setup-copilot-devcontainer setup-antigravity-devcontainer setup-codex-devcontainer setup-claude-devcontainer

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All integration checks passed."
