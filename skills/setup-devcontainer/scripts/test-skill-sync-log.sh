#!/bin/bash
set -euo pipefail

# Each CLI Skill's skill-sync block ends with a version log: one line per
# synced Skill, "<name> <metadata.version>" or "<name> (unversioned)". Runs
# only that log section of each post-start-block.sh template against a
# scratch $HOME, so no sync, wipe or network call happens.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_START='# Log what this sync installed'

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAIL_COUNT=0

fail() {
  echo "FAIL: $1" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# check_log <tool-dir> <label> <skills dir relative to $HOME>
check_log() {
  local tool_dir="$1" label="$2" skills_rel="$3"
  local block="$SKILLS_ROOT/$tool_dir/templates/post-start-block.sh"
  local section="$TMP_DIR/$tool_dir-log.sh"
  local home="$TMP_DIR/$tool_dir-home"
  local before=$FAIL_COUNT output status

  sed -n "/^$LOG_START/,\$p" "$block" > "$section"
  if [ ! -s "$section" ]; then
    fail "[$tool_dir] post-start-block.sh has no '$LOG_START' section"
    return
  fi

  # No skills directory at all: silent, never fails the post-start hook.
  mkdir -p "$home"
  status=0; output="$(HOME="$home" bash -euo pipefail "$section" 2>&1)" || status=$?
  if [ "$status" -ne 0 ] || [ -n "$output" ]; then
    fail "[$tool_dir] with no skills directory: expected silent exit 0, got exit $status: $output"
  fi

  mkdir -p "$home/$skills_rel/alpha" "$home/$skills_rel/beta" "$home/$skills_rel/empty"
  printf -- '---\nname: alpha\ndescription: "a"\nmetadata:\n  version: "1.2.0" # x-release-please-version\n---\n' > "$home/$skills_rel/alpha/SKILL.md"
  printf -- '---\nname: beta\ndescription: "b"\n---\n' > "$home/$skills_rel/beta/SKILL.md"

  status=0; output="$(HOME="$home" bash -euo pipefail "$section" 2>&1)" || status=$?
  if [ "$status" -ne 0 ]; then fail "[$tool_dir] log section exited $status: $output"; fi
  if ! grep -qxF "skill-sync ($label): alpha 1.2.0" <<<"$output"; then fail "[$tool_dir] expected 'skill-sync ($label): alpha 1.2.0', got: $output"; fi
  if ! grep -qxF "skill-sync ($label): beta (unversioned)" <<<"$output"; then fail "[$tool_dir] expected 'skill-sync ($label): beta (unversioned)', got: $output"; fi
  if grep -q "empty" <<<"$output"; then fail "[$tool_dir] logged a directory with no SKILL.md: $output"; fi

  if [ "$FAIL_COUNT" -eq "$before" ]; then echo "OK: [$tool_dir] logs versioned and unversioned Skills, skips non-Skills, never fails"; fi
}

check_log setup-claude-devcontainer "Claude Code" ".claude/skills"
check_log setup-codex-devcontainer "Codex" ".agents/skills"
check_log setup-copilot-devcontainer "Copilot" ".agents/skills"
check_log setup-antigravity-devcontainer "Antigravity" ".agents/skills"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All checks passed."
