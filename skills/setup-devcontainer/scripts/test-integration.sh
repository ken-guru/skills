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

# tool-dir marker — read via lookup_tool_value's nameref, not by name
# directly, so shellcheck can't see the use.
# shellcheck disable=SC2034
TOOLS=(
  "setup-claude-devcontainer:# --- Claude Code ---"
  "setup-codex-devcontainer:# --- Codex ---"
  "setup-antigravity-devcontainer:# --- Antigravity ---"
  "setup-copilot-devcontainer:# --- Copilot ---"
)

# tool-dir CLI name used as its own Network Manifest key — same nameref
# caveat as TOOLS above.
# shellcheck disable=SC2034
CLI_NAMES=(
  "setup-claude-devcontainer:claude"
  "setup-codex-devcontainer:codex"
  "setup-antigravity-devcontainer:antigravity"
  "setup-copilot-devcontainer:copilot"
)

# Looks up $2 (a tool-dir) in $1 (TOOLS or CLI_NAMES), each a "tool_dir:value"
# parallel array, and prints the matching value.
lookup_tool_value() {
  local -n table="$1"
  local tool_dir="$2"
  local entry
  for entry in "${table[@]}"; do
    if [ "${entry%%:*}" = "$tool_dir" ]; then
      echo "${entry#*:}"
      return
    fi
  done
}

# tool-dir README bullet marker — the exact whole-line marker each skill's
# own SKILL.md passes to patch-if-absent.sh when appending its bullet, so the
# harness tests the marker users actually get, not whatever a template's
# first line happens to be. Same nameref caveat as TOOLS above.
# shellcheck disable=SC2034
README_MARKERS=(
  "setup-claude-devcontainer:- Claude Code"
  "setup-codex-devcontainer:- Codex"
  "setup-antigravity-devcontainer:- Antigravity"
  "setup-copilot-devcontainer:- Copilot"
)

marker_for_tool() { lookup_tool_value TOOLS "$1"; }
cliname_for_tool() { lookup_tool_value CLI_NAMES "$1"; }
readme_marker_for_tool() { lookup_tool_value README_MARKERS "$1"; }

# Network Manifest must have exactly the baseline key plus one key per
# installed CLI Skill in $2.. — no more, no less. Fails (via the global
# fail()) and returns non-zero on mismatch, so a caller can still print its
# own success line on top.
assert_manifest_keys() {
  local label="$1" manifest_file="$2"
  shift 2
  local tool_order=("$@")
  local tool_dir expected_manifest_keys actual_manifest_keys
  expected_manifest_keys=$(
    {
      echo "baseline"
      for tool_dir in "${tool_order[@]}"; do
        cliname_for_tool "$tool_dir"
      done
    } | sort | jq -R . | jq -s -c .
  )
  actual_manifest_keys=$(jq -c '. | keys | sort' "$manifest_file")
  if [ "$actual_manifest_keys" != "$expected_manifest_keys" ]; then
    fail "[$label] expected network-manifest.json keys $expected_manifest_keys, got $actual_manifest_keys"
    return 1
  fi
}

# Applies every tool's own install-block/readme-bullet/capability-seam/
# network-manifest patches, in the given order, to the fixture files in $1.
# A tool that ships a skills-link-block.sh (Antigravity) also has it appended
# to post-start.sh under its own marker (the block's first line) — only in
# fixtures that have a post-start.sh. A tool that ships an env-block.example
# has it appended to .env.example the same way, under its own marker (the
# block's first line).
apply_all_patches() {
  local fixture_dir="$1"
  shift
  local tool_order=("$@")

  local tool_dir marker tool_templates cliname
  for tool_dir in "${tool_order[@]}"; do
    marker="$(marker_for_tool "$tool_dir")"
    tool_templates="$SKILLS_ROOT/$tool_dir/templates"
    "$PATCH" append "$fixture_dir/post-create.sh" "$marker" "$tool_templates/install-block.sh"
    "$PATCH" append "$fixture_dir/README.md" "$(readme_marker_for_tool "$tool_dir")" "$tool_templates/readme-bullet.md"
    if [ -f "$tool_templates/env-block.example" ]; then
      "$PATCH" append "$fixture_dir/.env.example" "$(head -1 "$tool_templates/env-block.example")" "$tool_templates/env-block.example"
    fi
    if [ -f "$tool_templates/capability-seam-entries.json" ]; then
      "$PATCH_JSON" "$fixture_dir/devcontainer.json" .runArgs "$tool_templates/capability-seam-entries.json"
    fi
    if [ -f "$tool_templates/network-manifest-entries.json" ]; then
      cliname="$(cliname_for_tool "$tool_dir")"
      "$PATCH_JSON" "$fixture_dir/network-manifest.json" ".${cliname}.networkAllowlist" "$tool_templates/network-manifest-entries.json"
    fi
    if [ -f "$tool_templates/skills-link-block.sh" ] && [ -f "$fixture_dir/post-start.sh" ]; then
      "$PATCH" append "$fixture_dir/post-start.sh" "$(head -1 "$tool_templates/skills-link-block.sh")" "$tool_templates/skills-link-block.sh"
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
  cp "$SKILLS_ROOT/setup-devcontainer/templates/env.baseline.example" "$TMP_DIR/.env.example"
  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$TMP_DIR/post-create.sh" --post-start-out "$TMP_DIR/post-start.sh"

  apply_all_patches "$TMP_DIR" "${tool_order[@]}"

  # Assertions, pass 1
  local marker_count
  marker_count=$(grep -c '^# --- .* ---$' "$TMP_DIR/post-create.sh" || true)
  if [ "$marker_count" -ne 4 ]; then
    fail "[$order_desc] expected 4 install-block markers in post-create.sh, found $marker_count"
  fi

  # Antigravity's skills-link block lands in post-start.sh exactly once, under
  # its own marker, whatever the install order — and doesn't disturb the
  # other CLI Skills' post-create.sh install blocks counted above.
  local link_marker_count
  link_marker_count=$(grep -c '^# --- Antigravity skills-link ---$' "$TMP_DIR/post-start.sh" || true)
  if [ "$link_marker_count" -ne 1 ]; then
    fail "[$order_desc] expected exactly 1 skills-link marker in post-start.sh, found $link_marker_count"
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
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=SETGID","--cap-add=SETUID","--cap-add=SYS_ADMIN","--cap-drop=ALL","--security-opt=seccomp=unconfined","--security-opt=systempaths=unconfined"]'
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
  local tool_dir cliname tool_templates expected_entries actual_entries
  assert_manifest_keys "$order_desc" "$TMP_DIR/network-manifest.json" "${tool_order[@]}" || true

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
  cp "$TMP_DIR/post-start.sh" "$TMP_DIR/post-start.sh.before-pass2"
  cp "$TMP_DIR/README.md" "$TMP_DIR/README.md.before-pass2"
  cp "$TMP_DIR/devcontainer.json" "$TMP_DIR/devcontainer.json.before-pass2"
  cp "$TMP_DIR/network-manifest.json" "$TMP_DIR/network-manifest.json.before-pass2"
  cp "$TMP_DIR/.env.example" "$TMP_DIR/.env.example.before-pass2"

  apply_all_patches "$TMP_DIR" "${tool_order[@]}"

  if ! diff -q "$TMP_DIR/post-create.sh.before-pass2" "$TMP_DIR/post-create.sh" >/dev/null; then
    fail "[$order_desc] second pass changed post-create.sh — not idempotent"
  fi
  if ! diff -q "$TMP_DIR/post-start.sh.before-pass2" "$TMP_DIR/post-start.sh" >/dev/null; then
    fail "[$order_desc] second pass changed post-start.sh — not idempotent"
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
  if ! diff -q "$TMP_DIR/.env.example.before-pass2" "$TMP_DIR/.env.example" >/dev/null; then
    fail "[$order_desc] second pass changed .env.example — not idempotent"
  fi

  assert_copilot_env_block "$order_desc" "$TMP_DIR/.env.example" "${tool_order[@]}"

  rm -rf "$TMP_DIR"
  echo "OK: $order_desc"
}

# Copilot's own token block (issue #370): present exactly once when
# setup-copilot-devcontainer is among $3.., absent otherwise (Own-Block
# Contract). Its variable must stay commented out — sourcing the file the way
# bash-env.sh sources .env must leave COPILOT_GITHUB_TOKEN unset, so an
# unfilled placeholder never overrides Copilot's GH_TOKEN fallback.
assert_copilot_env_block() {
  local label="$1" env_file="$2"
  shift 2
  local tool_dir expected=0 block_count
  for tool_dir in "$@"; do
    [ "$tool_dir" = "setup-copilot-devcontainer" ] && expected=1
  done
  block_count=$(grep -cxF "# --- Copilot token ---" "$env_file" || true)
  if [ "$block_count" -ne "$expected" ]; then
    fail "[$label] expected $expected Copilot token block(s) in .env.example, found $block_count"
  fi
  if [ "$expected" -eq 1 ] && ! grep -q '^# COPILOT_GITHUB_TOKEN=github_pat_' "$env_file"; then
    fail "[$label] Copilot token block has no commented-out COPILOT_GITHUB_TOKEN=github_pat_... line"
  fi
  # shellcheck disable=SC1090 # the fixture's own .env.example, sourced as bash-env.sh sources .env
  if (set -a; unset COPILOT_GITHUB_TOKEN; source "$env_file"; [ -n "${COPILOT_GITHUB_TOKEN+set}" ]); then
    fail "[$label] sourcing .env.example sets COPILOT_GITHUB_TOKEN — the placeholder must stay commented out"
  fi
}

# Unconditional capability-drop baseline (issue #293 / ADR-0006): both base
# templates must already carry the six baseline entries in runArgs on a
# fresh copy, before any CLI skill's own patch touches the file — not gated
# behind any setup question, and not something only appears after a CLI
# skill's patch runs. SETUID/SETGID are in here because `sudo` itself needs
# them (setresuid()/setresgid() internally, regardless of its setuid-root
# bit) — without them every `sudo` call fails outright, including the
# firewall's own invocation of init-firewall.sh/refresh-allowlist.sh.
check_fresh_generation_baseline() {
  local template="$1" label="$2"
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=SETGID","--cap-add=SETUID","--cap-drop=ALL"]'
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
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=NET_ADMIN","--cap-add=NET_RAW","--cap-add=SETGID","--cap-add=SETUID","--cap-drop=ALL"]'
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
  local expected='["--cap-add=CHOWN","--cap-add=DAC_OVERRIDE","--cap-add=FOWNER","--cap-add=NET_ADMIN","--cap-add=NET_RAW","--cap-add=SETGID","--cap-add=SETUID","--cap-add=SYS_ADMIN","--cap-drop=ALL","--security-opt=seccomp=unconfined","--security-opt=systempaths=unconfined"]'
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

# Project Mounts (issue #300/#304): patch-json-array-if-absent.sh must
# compose cleanly against .mounts the same way it already does against
# .runArgs (Capability Seam) and .{cliName}.networkAllowlist (Network
# Manifest) — a project's own project-mounts.local.json entries land
# alongside the base template's own {{REPO_NAME}}-config volume entry
# without disturbing it, and a second application is a no-op.
check_project_mounts_entries() {
  local tmp entries_file
  tmp="$(mktemp)"
  entries_file="$(mktemp)"
  cp "$SKILLS_ROOT/setup-devcontainer/templates/devcontainer.json" "$tmp"
  echo '["source=acme-widgets-postgres-data,target=/var/lib/postgresql/data,type=volume"]' > "$entries_file"

  "$PATCH_JSON" "$tmp" .mounts "$entries_file"
  local mounts
  mounts=$(jq -c '.mounts | sort' "$tmp")
  # devcontainer.json is copied raw here (no {{REPO_NAME}} substitution —
  # that's render-devcontainer.sh's job for post-create.sh, not exercised by
  # this scenario), so the base config-volume entry keeps its placeholder.
  local expected='["source=acme-widgets-postgres-data,target=/var/lib/postgresql/data,type=volume","source={{REPO_NAME}}-config,target=/home/vscode,type=volume"]'
  if [ "$mounts" != "$expected" ]; then
    fail "[project-mounts] expected .mounts to contain the base config volume plus the project's own entry, got $mounts"
  else
    echo "OK: [project-mounts] patch-json-array-if-absent.sh composes a project entry onto the base .mounts array"
  fi

  # Second application must be a no-op (idempotent, safe to rerun after
  # editing project-mounts.local.json and re-applying).
  "$PATCH_JSON" "$tmp" .mounts "$entries_file"
  local mounts2
  mounts2=$(jq -c '.mounts | sort' "$tmp")
  if [ "$mounts2" != "$expected" ]; then
    fail "[project-mounts] second application changed .mounts — not idempotent, got $mounts2"
  fi

  rm -f "$tmp" "$entries_file"
}
check_project_mounts_entries

# initializeCommand chaining (issue #301/#305): a second full render (a
# rebuild re-running render-devcontainer.sh) must reproduce byte-identical
# initialize.sh content — no {{...}} placeholders, no drift between runs.
# A project's own patch-if-absent.sh-appended block onto initialize.sh must
# also survive a second full pass unchanged, matching the same
# no-op-on-rerun guarantee already enforced for post-create.sh/post-start.sh
# above.
check_initialize_idempotency() {
  local tmp_dir out
  tmp_dir="$(mktemp -d)"
  out="$tmp_dir/initialize.sh"

  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$tmp_dir/post-create.sh" --initialize-out "$out"

  if [[ "$(cat "$out")" == *'{{'* ]]; then
    fail "[initialize.sh] leftover {{...}} placeholder found"
  fi

  local marker="# --- Project: keep-awake ---"
  local block_file="$tmp_dir/keep-awake-block.sh"
  {
    echo "$marker"
    echo 'echo "keep the host awake here"'
  } > "$block_file"

  "$PATCH" append "$out" "$marker" "$block_file"
  cp "$out" "$out.before-pass2"

  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$tmp_dir/post-create.sh" --initialize-out "$tmp_dir/initialize.sh.regenerated"
  "$PATCH" append "$out" "$marker" "$block_file"

  if ! diff -q "$out.before-pass2" "$out" >/dev/null; then
    fail "[initialize.sh] second pass changed initialize.sh after a project block was appended — not idempotent"
  else
    echo "OK: [initialize.sh] project-appended block survives a second full pass unchanged"
  fi

  if ! diff -q "$tmp_dir/initialize.sh.regenerated" "$SKILLS_ROOT/setup-devcontainer/templates/initialize-base.sh" >/dev/null; then
    fail "[initialize.sh] regenerated base content drifted from templates/initialize-base.sh"
  fi

  rm -rf "$tmp_dir"
}
check_initialize_idempotency

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
  if ! echo "$firewall_stage" | grep -q 'env_keep += "FIREWALL_REFRESH_INTERVAL"'; then
    fail "[Dockerfile firewall stage] missing env_keep for FIREWALL_REFRESH_INTERVAL — sudo's env_reset would silently strip it, making the interval override dead"
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

# The harness's README and .env.example markers must be the ones each
# skill's own SKILL.md actually passes to patch-if-absent.sh — otherwise the
# scenarios below would prove idempotency for a marker users never get
# (patch-if-absent.sh matches markers as whole lines, so a drifted marker
# means a duplicate append on every re-run).
check_skill_markers_match_harness() {
  local entry tool_dir skill_md marker env_block env_marker ok=1
  for entry in "${README_MARKERS[@]}"; do
    tool_dir="${entry%%:*}"
    skill_md="$SKILLS_ROOT/$tool_dir/SKILL.md"
    marker="$(readme_marker_for_tool "$tool_dir")"
    if ! grep -qF -- "append .devcontainer/README.md \"$marker\" templates/readme-bullet.md" "$skill_md"; then
      fail "[$tool_dir] SKILL.md does not append its README bullet under the harness's marker \"$marker\""
      ok=0
    fi
    if [ "$(head -1 "$SKILLS_ROOT/$tool_dir/templates/readme-bullet.md")" != "$marker" ]; then
      fail "[$tool_dir] readme-bullet.md's first line is not exactly its marker \"$marker\" — a fresh append would not be found by the next run's whole-line check"
      ok=0
    fi
    env_block="$SKILLS_ROOT/$tool_dir/templates/env-block.example"
    if [ -f "$env_block" ]; then
      env_marker="$(head -1 "$env_block")"
      if ! grep -qF -- "append .devcontainer/.env.example \"$env_marker\" templates/env-block.example" "$skill_md"; then
        fail "[$tool_dir] SKILL.md does not append env-block.example under its first line \"$env_marker\""
        ok=0
      fi
    fi
  done
  if [ "$ok" -eq 1 ]; then
    echo "OK: every CLI Skill's README/.env.example markers match the harness"
  fi
}
check_skill_markers_match_harness

# Base GH_TOKEN guidance (issue #369): the base .env.example and README must
# steer users to a fine-grained PAT owned by the repo's owner — never the
# classic ghp_ format or the classic token list — and, being CLI-agnostic
# (Own-Block Contract), must not mention any one CLI's own token.
check_base_token_guidance() {
  local env_tpl="$SKILLS_ROOT/setup-devcontainer/templates/env.baseline.example"
  local readme_tpl="$SKILLS_ROOT/setup-devcontainer/templates/README.baseline.md"
  local ok=1
  if ! grep -qxF "GH_TOKEN=github_pat_your_token_here" "$env_tpl"; then
    fail "[base .env.example] GH_TOKEN placeholder is not the fine-grained github_pat_ format"
    ok=0
  fi
  if ! grep -qF "https://github.com/settings/personal-access-tokens/new" "$env_tpl"; then
    fail "[base .env.example] does not link the fine-grained token creation page"
    ok=0
  fi
  if ! grep -qi "resource owner" "$env_tpl"; then
    fail "[base .env.example] does not say who the token's resource owner must be"
    ok=0
  fi
  if ! grep -qi "resource owner" "$readme_tpl"; then
    fail "[base README] opening steps do not say who the token's resource owner must be"
    ok=0
  fi
  if grep -qi "copilot" "$env_tpl"; then
    fail "[base .env.example] mentions Copilot — CLI-specific token guidance belongs to that CLI Skill's own block"
    ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    echo "OK: base .env.example/README point to a fine-grained PAT owned by the repo's owner"
  fi
}
check_base_token_guidance

# Stale token guidance must never come back into any skill's templates: the
# classic ghp_ placeholder and the classic token list both steer users to
# tokens some CLIs (Copilot) reject outright.
check_no_stale_token_guidance() {
  local pattern hits ok=1
  for pattern in "ghp_your" "github.com/settings/tokens"; do
    hits=$(grep -rlF -- "$pattern" "$SKILLS_ROOT"/setup-*/templates || true)
    if [ -n "$hits" ]; then
      fail "stale token guidance \"$pattern\" found in: $(echo "$hits" | tr '\n' ' ')"
      ok=0
    fi
  done
  if [ "$ok" -eq 1 ]; then
    echo "OK: no stale token guidance in any skill template"
  fi
}
check_no_stale_token_guidance

# Copilot auth claims (issue #370): Copilot CLI can't authorize from an
# org-owned GH_TOKEN, so no Copilot template or SKILL.md may promise
# automatic auth via GH_TOKEN, and nothing may pre-accept plain-text token
# storage on the user's behalf (that stays Copilot's own prompt).
check_copilot_auth_claims() {
  local copilot_dir="$SKILLS_ROOT/setup-copilot-devcontainer" pattern hits ok=1
  for pattern in "automatic via" "picks up this container's GH_TOKEN" "storeTokenPlaintext"; do
    hits=$(grep -rliF -- "$pattern" "$copilot_dir" || true)
    if [ -n "$hits" ]; then
      fail "[copilot] stale or disallowed auth text \"$pattern\" found in: $(echo "$hits" | tr '\n' ' ')"
      ok=0
    fi
  done
  if grep -rqF -- ".copilot/settings.json" "$copilot_dir/templates"; then
    fail "[copilot] a template touches ~/.copilot/settings.json — Copilot's own user file is not a CLI Skill block"
    ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    echo "OK: Copilot templates/SKILL.md make no GH_TOKEN auto-auth claim and don't pre-accept plain-text storage"
  fi
}
check_copilot_auth_claims

# Copilot README bullet (issue #371): explains, in order, the token, the
# expected "System vault not available" prompt on interactive sign-in, and
# how to diagnose a rejected token — as nested lines under an exact
# "- Copilot" marker line, so the top-level bullet count stays one per CLI.
# A README from an older version (bare "- Copilot" line) must gain nothing
# on a re-run: this skill never rewrites a block it already wrote.
check_copilot_readme_bullet() {
  local bullet="$SKILLS_ROOT/setup-copilot-devcontainer/templates/readme-bullet.md"
  local tmp ok=1 pos_token pos_vault pos_diag
  pos_token=$(grep -n "COPILOT_GITHUB_TOKEN" "$bullet" | head -1 | cut -d: -f1 || true)
  pos_vault=$(grep -n "System vault not available" "$bullet" | head -1 | cut -d: -f1 || true)
  pos_diag=$(grep -n "copilot -p hi" "$bullet" | head -1 | cut -d: -f1 || true)
  if [ -z "$pos_token" ] || [ -z "$pos_vault" ] || [ -z "$pos_diag" ] \
    || [ "$pos_token" -ge "$pos_vault" ] || [ "$pos_vault" -ge "$pos_diag" ]; then
    fail "[copilot README bullet] expected the token, then the vault prompt, then the \`copilot -p hi\` diagnosis (lines: ${pos_token:-none}, ${pos_vault:-none}, ${pos_diag:-none})"
    ok=0
  fi
  if grep -v '^- Copilot$' "$bullet" | grep -q '^- '; then
    fail "[copilot README bullet] has a second top-level bullet — details must be nested under \"- Copilot\""
    ok=0
  fi

  tmp="$(mktemp)"
  printf '## Installed CLI Tools\n\n- Copilot\n' > "$tmp"
  cp "$tmp" "$tmp.before"
  "$PATCH" append "$tmp" "$(readme_marker_for_tool setup-copilot-devcontainer)" "$bullet"
  if ! diff -q "$tmp.before" "$tmp" >/dev/null; then
    fail "[copilot README bullet] re-running against an older README's bare \"- Copilot\" bullet changed it"
    ok=0
  fi
  rm -f "$tmp" "$tmp.before"
  if [ "$ok" -eq 1 ]; then
    echo "OK: Copilot README bullet explains token, vault prompt and diagnosis; older READMEs are left alone"
  fi
}
check_copilot_readme_bullet

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
  cp "$SKILLS_ROOT/setup-devcontainer/templates/env.baseline.example" "$TMP_DIR/.env.example"
  "$RENDER" --repo-name "acme-widgets" --repo-slug "acme/widgets" --out "$TMP_DIR/post-create.sh"

  apply_all_patches "$TMP_DIR" "${tool_order[@]}"

  if assert_manifest_keys "$label" "$TMP_DIR/network-manifest.json" "${tool_order[@]}"; then
    echo "OK: [$label] network-manifest.json carries only the installed CLIs' keys plus baseline"
  fi
  assert_copilot_env_block "$label" "$TMP_DIR/.env.example" "${tool_order[@]}"

  rm -rf "$TMP_DIR"
}

run_partial_manifest_scenario "claude+copilot only" \
  setup-claude-devcontainer setup-copilot-devcontainer

run_partial_manifest_scenario "claude+codex only" \
  setup-claude-devcontainer setup-codex-devcontainer

# Antigravity's skills-link block (issue #346): run against a scratch HOME,
# under the same `set -euo pipefail` post-start.sh runs it in, for every
# starting state of ~/.gemini/skills. Behavior only — the link's target, what
# is left untouched, what is reported on stderr, and that a second run changes
# nothing — not the block's comments or structure.
check_skills_link_block() {
  local block="$SKILLS_ROOT/setup-antigravity-devcontainer/templates/skills-link-block.sh"
  local tmp_root tmp_home err link target rc
  tmp_root="$(mktemp -d)"

  # Runs the block against $tmp_home (fresh per case), stderr to $err.
  run_link_block() {
    rc=0
    HOME="$tmp_home" bash -euo pipefail "$block" 2>"$err" || rc=$?
  }

  new_case() {
    tmp_home="$(mktemp -d "$tmp_root/home.XXXXXX")"
    err="$tmp_home/stderr.txt"
    link="$tmp_home/.gemini/skills"
    target="$tmp_home/.agents/skills"
  }

  # 1. Nothing there: link created, shared directory created too, silent.
  new_case
  run_link_block
  if [ "$rc" -ne 0 ] || [ ! -L "$link" ] || [ "$(readlink "$link")" != "$target" ] || [ ! -d "$target" ] || [ -s "$err" ]; then
    fail "[skills-link] absent: expected a silent link to $target, rc=$rc, link=$(readlink "$link" 2>/dev/null || echo none), stderr=$(cat "$err")"
  fi
  # ...and a second run on the now-correct link changes nothing.
  run_link_block
  if [ "$rc" -ne 0 ] || [ "$(readlink "$link")" != "$target" ] || [ -s "$err" ]; then
    fail "[skills-link] correct link: second run should be a silent no-op, rc=$rc, stderr=$(cat "$err")"
  fi

  # 2. A skill written after the link is visible through it (the point of a link).
  mkdir -p "$target/late-skill"
  echo "x" > "$target/late-skill/SKILL.md"
  if [ ! -f "$link/late-skill/SKILL.md" ]; then
    fail "[skills-link] a skill added to the shared directory after linking is not visible through the link"
  fi

  # 3. Empty real directory: replaced by the link.
  new_case
  mkdir -p "$link"
  run_link_block
  if [ "$rc" -ne 0 ] || [ ! -L "$link" ] || [ "$(readlink "$link")" != "$target" ] || [ -s "$err" ]; then
    fail "[skills-link] empty real directory: expected it replaced by a silent link, rc=$rc, stderr=$(cat "$err")"
  fi

  # 4. Non-empty real directory: never destroyed, warned about, exit 0; and
  # a second run behaves the same.
  new_case
  mkdir -p "$link"
  echo "mine" > "$link/keep.txt"
  local pass
  for pass in 1 2; do
    run_link_block
    if [ "$rc" -ne 0 ] || [ -L "$link" ] || [ ! -f "$link/keep.txt" ] || ! grep -q '^WARN:' "$err"; then
      fail "[skills-link] non-empty directory (run $pass): expected it left untouched with a WARN and exit 0, rc=$rc, stderr=$(cat "$err")"
    fi
  done

  # 5. Link to somewhere else: left alone, warned about, exit 0.
  new_case
  mkdir -p "$tmp_home/.gemini" "$tmp_home/elsewhere"
  ln -s "$tmp_home/elsewhere" "$link"
  run_link_block
  if [ "$rc" -ne 0 ] || [ "$(readlink "$link")" != "$tmp_home/elsewhere" ] || ! grep -q '^WARN:' "$err"; then
    fail "[skills-link] link elsewhere: expected it left alone with a WARN and exit 0, rc=$rc, link=$(readlink "$link" 2>/dev/null || echo none), stderr=$(cat "$err")"
  fi

  # 6. A relative link that resolves to the shared directory is accepted as-is.
  new_case
  mkdir -p "$tmp_home/.gemini" "$target"
  ln -s ../.agents/skills "$link"
  run_link_block
  if [ "$rc" -ne 0 ] || [ "$(readlink "$link")" != "../.agents/skills" ] || [ -s "$err" ]; then
    fail "[skills-link] equivalent relative link: expected it accepted silently, rc=$rc, link=$(readlink "$link" 2>/dev/null || echo none), stderr=$(cat "$err")"
  fi

  # 7. A regular file where the link belongs: left alone, warned about, exit 0.
  new_case
  mkdir -p "$tmp_home/.gemini"
  echo "not a dir" > "$link"
  run_link_block
  if [ "$rc" -ne 0 ] || [ -L "$link" ] || [ ! -f "$link" ] || ! grep -q '^WARN:' "$err"; then
    fail "[skills-link] regular file: expected it left alone with a WARN and exit 0, rc=$rc, stderr=$(cat "$err")"
  fi

  rm -rf "$tmp_root"
  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "OK: [skills-link] link block handles absent, correct, empty-dir, non-empty-dir, other-link, relative-link and file states"
  fi
}
check_skills_link_block

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All integration checks passed."
