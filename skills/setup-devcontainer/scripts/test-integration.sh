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

# Firewall opt-in (issue #295 / ADR-0005): patching
# templates/firewall-capability-entries.json onto either base devcontainer.json
# variant must add exactly NET_ADMIN/NET_RAW on top of the unconditional
# baseline entries — this is the same Capability Seam primitive
# setup-codex-devcontainer already uses for its own entries, applied at base-
# skill generation time (gated on the firewall setup question) rather than by
# a CLI skill.
check_firewall_capability_entries() {
  local template="$1" label="$2"
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=NET_ADMIN","--cap-add=NET_RAW","--cap-drop=ALL"]'
  local tmp
  tmp="$(mktemp)"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/$template" "$tmp"
  "$PATCH_JSON" "$tmp" .runArgs "$SKILLS_ROOT/setup-devcontainer/templates/firewall-capability-entries.json"
  local runargs
  runargs=$(jq -c '.runArgs | sort' "$tmp")
  rm -f "$tmp"
  if [ "$runargs" != "$expected" ]; then
    fail "[$label] expected runArgs to be baseline cap-drop entries plus NET_ADMIN/NET_RAW, got $runargs"
  else
    echo "OK: [$label] firewall opt-in composes baseline runArgs with NET_ADMIN/NET_RAW"
  fi

  # Re-applying the same patch must be a no-op (idempotent, safe to rerun —
  # matches docs/adding-firewall-later.md's contract).
  local tmp2
  tmp2="$(mktemp)"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/$template" "$tmp2"
  "$PATCH_JSON" "$tmp2" .runArgs "$SKILLS_ROOT/setup-devcontainer/templates/firewall-capability-entries.json"
  "$PATCH_JSON" "$tmp2" .runArgs "$SKILLS_ROOT/setup-devcontainer/templates/firewall-capability-entries.json"
  local runargs2
  runargs2=$(jq -c '.runArgs | sort' "$tmp2")
  rm -f "$tmp2"
  if [ "$runargs2" != "$expected" ]; then
    fail "[$label] second firewall capability patch changed runArgs — not idempotent, got $runargs2"
  fi
}
check_firewall_capability_entries "devcontainer.json" "non-SSH template + firewall"
check_firewall_capability_entries "devcontainer.with-ssh.json" "SSH template + firewall"

# Firewall entries must also compose cleanly alongside Codex's own
# capability-seam entries, regardless of patch order — Docker unions every
# --cap-add entry in runArgs, order-independent (ADR-0006's addendum).
check_firewall_plus_codex_capability_entries() {
  local order_desc="$1" first_entries="$2" second_entries="$3"
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=NET_ADMIN","--cap-add=NET_RAW","--cap-add=SYS_ADMIN","--cap-drop=ALL","--security-opt=seccomp=unconfined","--security-opt=systempaths=unconfined"]'
  local tmp
  tmp="$(mktemp)"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/devcontainer.json" "$tmp"
  "$PATCH_JSON" "$tmp" .runArgs "$first_entries"
  "$PATCH_JSON" "$tmp" .runArgs "$second_entries"
  local runargs
  runargs=$(jq -c '.runArgs | sort' "$tmp")
  rm -f "$tmp"
  if [ "$runargs" != "$expected" ]; then
    fail "[$order_desc] expected runArgs to union firewall + Codex capability entries, got $runargs"
  else
    echo "OK: [$order_desc] firewall + Codex capability entries compose cleanly"
  fi
}
check_firewall_plus_codex_capability_entries "firewall,codex" \
  "$SKILLS_ROOT/setup-devcontainer/templates/firewall-capability-entries.json" \
  "$SKILLS_ROOT/setup-codex-devcontainer/templates/capability-seam-entries.json"
check_firewall_plus_codex_capability_entries "codex,firewall" \
  "$SKILLS_ROOT/setup-codex-devcontainer/templates/capability-seam-entries.json" \
  "$SKILLS_ROOT/setup-devcontainer/templates/firewall-capability-entries.json"

# One multi-stage Dockerfile (ADR-0005's fix for the base/firewall
# duplication a two-file variant would otherwise reintroduce): the "base"
# stage must carry none of the firewall's build-time surface, the
# "firewall" stage (which extends "base") must carry all of it, and each
# stage independently ends with USER vscode — which stage actually gets
# built is devcontainer.json's build.target, not which file was copied.
check_dockerfile_stages() {
  local dockerfile="$SKILLS_ROOT/setup-devcontainer/templates/Dockerfile"
  local base_stage firewall_stage

  if ! grep -q '^FROM .* AS base$' "$dockerfile"; then
    fail "[Dockerfile] missing \"AS base\" stage marker"
    return
  fi
  if ! grep -q '^FROM base AS firewall$' "$dockerfile"; then
    fail "[Dockerfile] missing \"FROM base AS firewall\" stage marker"
    return
  fi

  # Everything from the base FROM line up to (not including) the firewall
  # FROM line is the base stage; everything from the firewall FROM line to
  # end-of-file is the firewall stage.
  base_stage="$(sed -n '/^FROM .* AS base$/,/^FROM base AS firewall$/p' "$dockerfile" | sed '$d')"
  firewall_stage="$(sed -n '/^FROM base AS firewall$/,$p' "$dockerfile")"

  if echo "$base_stage" | grep -q 'iptables\|ipset\|vscode-firewall'; then
    fail "[Dockerfile base stage] must carry no firewall content"
  else
    echo "OK: [Dockerfile base stage] carries no firewall content"
  fi
  if ! echo "$base_stage" | grep -q '^USER vscode$'; then
    fail "[Dockerfile base stage] must end with USER vscode"
  fi

  if ! echo "$firewall_stage" | grep -q 'iptables ipset iproute2 dnsutils aggregate'; then
    fail "[Dockerfile firewall stage] missing firewall package install"
  fi
  if ! echo "$firewall_stage" | grep -q '/etc/sudoers.d/vscode-firewall'; then
    fail "[Dockerfile firewall stage] missing scoped firewall sudoers rule"
  fi
  if ! echo "$firewall_stage" | grep -q 'NOPASSWD: /workspace/.devcontainer/init-firewall.sh, /workspace/.devcontainer/refresh-allowlist.sh'; then
    fail "[Dockerfile firewall stage] sudoers rule must be scoped to exactly init-firewall.sh and refresh-allowlist.sh, nothing broader"
  fi
  if [ "$(echo "$firewall_stage" | tail -1)" != "USER vscode" ]; then
    fail "[Dockerfile firewall stage] must end with USER vscode"
  fi
  echo "OK: [Dockerfile firewall stage] carries the firewall build-time surface, ends USER vscode"

  if [ ! -f "$SKILLS_ROOT/setup-devcontainer/templates/Dockerfile.with-firewall" ]; then
    echo "OK: [Dockerfile.with-firewall] removed — superseded by the multi-stage Dockerfile above"
  else
    fail "[Dockerfile.with-firewall] should have been removed once the Dockerfile became multi-stage"
  fi
}
check_dockerfile_stages

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
