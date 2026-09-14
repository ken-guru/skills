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

# tool-dir CLI name used as its own Network Manifest key
CLI_NAMES=(
  "setup-claude-devcontainer:claude"
  "setup-codex-devcontainer:codex"
  "setup-antigravity-devcontainer:antigravity"
  "setup-copilot-devcontainer:copilot"
)

marker_for_tool() {
  local tool_dir="$1"
  local entry
  for entry in "${TOOLS[@]}"; do
    if [ "${entry%%:*}" = "$tool_dir" ]; then
      echo "${entry#*:}"
      return
    fi
  done
}

cliname_for_tool() {
  local tool_dir="$1"
  local entry
  for entry in "${CLI_NAMES[@]}"; do
    if [ "${entry%%:*}" = "$tool_dir" ]; then
      echo "${entry#*:}"
      return
    fi
  done
}

# Applies every tool's own install-block/readme-bullet/capability-seam/
# network-manifest patches, in the given order, to the fixture files in $1.
apply_all_patches() {
  local fixture_dir="$1"
  shift
  local tool_order=("$@")

  local tool_dir marker tool_templates cliname
  for tool_dir in "${tool_order[@]}"; do
    marker="$(marker_for_tool "$tool_dir")"
    tool_templates="$SKILLS_ROOT/$tool_dir/templates"
    "$PATCH" append "$fixture_dir/post-create.sh" "$marker" "$tool_templates/install-block.sh"
    "$PATCH" append "$fixture_dir/README.md" "$(head -1 "$tool_templates/readme-bullet.md")" "$tool_templates/readme-bullet.md"
    if [ -f "$tool_templates/capability-seam-entries.json" ]; then
      "$PATCH_JSON" "$fixture_dir/devcontainer.json" .runArgs "$tool_templates/capability-seam-entries.json"
    fi
    if [ -f "$tool_templates/network-manifest-entries.json" ]; then
      cliname="$(cliname_for_tool "$tool_dir")"
      "$PATCH_JSON" "$fixture_dir/network-manifest.json" ".${cliname}.networkAllowlist" "$tool_templates/network-manifest-entries.json"
    fi
  done
}

run_scenario() {
  local order_desc="$1"
  shift
  local tool_order=("$@")

  local TMP_DIR
  TMP_DIR="$(mktemp -d)"

  cp "$SKILLS_ROOT/setup-devcontainer/templates/devcontainer.json" "$TMP_DIR/devcontainer.json"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/README.baseline.md" "$TMP_DIR/README.md"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/network-manifest.json" "$TMP_DIR/network-manifest.json"
  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$TMP_DIR/post-create.sh"

  apply_all_patches "$TMP_DIR" "${tool_order[@]}"

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
  # Must contain both the unconditional baseline cap-drop entries (present
  # from a fresh copy of the base template, before any CLI skill touches the
  # file) and Codex's own capability-seam entries, composed cleanly on top —
  # no duplicates, order-independent (Docker unions --cap-add entries).
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=SYS_ADMIN","--cap-drop=ALL","--security-opt=seccomp=unconfined","--security-opt=systempaths=unconfined"]'
  if [ "$runargs" != "$expected" ]; then
    fail "[$order_desc] expected runArgs to contain baseline cap-drop entries plus Codex's capability entries, got $runargs"
  fi

  if ! jq empty "$TMP_DIR/devcontainer.json" 2>/dev/null; then
    fail "[$order_desc] devcontainer.json is not valid JSON after all patches"
  fi

  if ! jq empty "$TMP_DIR/network-manifest.json" 2>/dev/null; then
    fail "[$order_desc] network-manifest.json is not valid JSON after all patches"
  fi

  # Network Manifest must have exactly the baseline key plus one key per
  # installed CLI Skill in this scenario — no more, no less — and each
  # CLI's networkAllowlist must exactly match that skill's own template.
  local expected_manifest_keys actual_manifest_keys
  local tool_dir cliname tool_templates expected_entries actual_entries
  expected_manifest_keys=$(
    {
      echo "baseline"
      for tool_dir in "${tool_order[@]}"; do
        cliname_for_tool "$tool_dir"
      done
    } | sort | jq -R . | jq -s -c .
  )
  actual_manifest_keys=$(jq -c '. | keys | sort' "$TMP_DIR/network-manifest.json")
  if [ "$actual_manifest_keys" != "$expected_manifest_keys" ]; then
    fail "[$order_desc] expected network-manifest.json keys $expected_manifest_keys, got $actual_manifest_keys"
  fi

  for tool_dir in "${tool_order[@]}"; do
    cliname="$(cliname_for_tool "$tool_dir")"
    tool_templates="$SKILLS_ROOT/$tool_dir/templates"
    expected_entries=$(jq -c '.' "$tool_templates/network-manifest-entries.json")
    actual_entries=$(jq -c ".${cliname}.networkAllowlist" "$TMP_DIR/network-manifest.json")
    if [ "$actual_entries" != "$expected_entries" ]; then
      fail "[$order_desc] .$cliname.networkAllowlist in network-manifest.json does not match $tool_dir's template"
    fi
  done

  # Second full pass — every patch re-applied — must be a complete no-op.
  cp "$TMP_DIR/post-create.sh" "$TMP_DIR/post-create.sh.before-pass2"
  cp "$TMP_DIR/README.md" "$TMP_DIR/README.md.before-pass2"
  cp "$TMP_DIR/devcontainer.json" "$TMP_DIR/devcontainer.json.before-pass2"
  cp "$TMP_DIR/network-manifest.json" "$TMP_DIR/network-manifest.json.before-pass2"

  apply_all_patches "$TMP_DIR" "${tool_order[@]}"

  if ! diff -q "$TMP_DIR/post-create.sh.before-pass2" "$TMP_DIR/post-create.sh" >/dev/null; then
    fail "[$order_desc] second pass changed post-create.sh — not idempotent"
  fi
  if ! diff -q "$TMP_DIR/README.md.before-pass2" "$TMP_DIR/README.md" >/dev/null; then
    fail "[$order_desc] second pass changed README.md — not idempotent"
  fi
  if ! diff -q "$TMP_DIR/devcontainer.json.before-pass2" "$TMP_DIR/devcontainer.json" >/dev/null; then
    fail "[$order_desc] second pass changed devcontainer.json — not idempotent"
  fi
  if ! diff -q "$TMP_DIR/network-manifest.json.before-pass2" "$TMP_DIR/network-manifest.json" >/dev/null; then
    fail "[$order_desc] second pass changed network-manifest.json — not idempotent"
  fi

  rm -rf "$TMP_DIR"
  echo "OK: $order_desc"
}

# Unconditional capability-drop baseline (issue #293 / ADR-0006): both base
# templates must already carry the four baseline entries in runArgs on a
# fresh copy, before any CLI skill's own patch touches the file — not gated
# behind any setup question, and not something only appears after a CLI
# skill's patch runs.
check_fresh_generation_baseline() {
  local template="$1" label="$2"
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-drop=ALL"]'
  local runargs
  runargs=$(jq -c '.runArgs | sort' "$SKILLS_ROOT/setup-devcontainer/templates/$template")
  if [ "$runargs" != "$expected" ]; then
    fail "[$label] expected fresh-generation runArgs to be exactly the baseline cap-drop entries, got $runargs"
  else
    echo "OK: [$label] fresh-generation runArgs carries exactly the baseline cap-drop entries"
  fi
}
check_fresh_generation_baseline "devcontainer.json" "non-SSH template"
check_fresh_generation_baseline "devcontainer.with-ssh.json" "SSH template"

run_scenario "claude,codex,antigravity,copilot" \
  setup-claude-devcontainer setup-codex-devcontainer setup-antigravity-devcontainer setup-copilot-devcontainer

run_scenario "copilot,antigravity,codex,claude" \
  setup-copilot-devcontainer setup-antigravity-devcontainer setup-codex-devcontainer setup-claude-devcontainer

# Partial install (issue #296): a container with only some of the four CLI
# Skills installed must end up with a Network Manifest containing only
# those CLIs' entries (plus baseline) — never all four just because the
# base skill's manifest primitive is generic.
run_partial_manifest_scenario() {
  local label="$1"
  shift
  local tool_order=("$@")

  local TMP_DIR
  TMP_DIR="$(mktemp -d)"

  cp "$SKILLS_ROOT/setup-devcontainer/templates/devcontainer.json" "$TMP_DIR/devcontainer.json"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/README.baseline.md" "$TMP_DIR/README.md"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/network-manifest.json" "$TMP_DIR/network-manifest.json"
  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$TMP_DIR/post-create.sh"

  apply_all_patches "$TMP_DIR" "${tool_order[@]}"

  local expected_manifest_keys actual_manifest_keys
  local tool_dir
  expected_manifest_keys=$(
    {
      echo "baseline"
      for tool_dir in "${tool_order[@]}"; do
        cliname_for_tool "$tool_dir"
      done
    } | sort | jq -R . | jq -s -c .
  )
  actual_manifest_keys=$(jq -c '. | keys | sort' "$TMP_DIR/network-manifest.json")
  if [ "$actual_manifest_keys" != "$expected_manifest_keys" ]; then
    fail "[$label] expected partial-install network-manifest.json keys $expected_manifest_keys, got $actual_manifest_keys"
  else
    echo "OK: [$label] network-manifest.json carries only the installed CLIs' keys plus baseline"
  fi

  rm -rf "$TMP_DIR"
}

run_partial_manifest_scenario "claude+copilot only" \
  setup-claude-devcontainer setup-copilot-devcontainer

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All integration checks passed."
