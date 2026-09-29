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

SHARED="shared ~/.agents/skills"
check_log setup-claude-devcontainer "Claude Code" ".claude/skills"
check_log setup-codex-devcontainer "$SHARED" ".agents/skills"
check_log setup-copilot-devcontainer "$SHARED" ".agents/skills"
check_log setup-antigravity-devcontainer "$SHARED" ".agents/skills"

# Codex, Copilot and Antigravity all sync into the shared ~/.agents/skills.
# Composed into one post-start.sh in any order, they log that directory once,
# at the end, so a Skill a later block syncs is still listed.
check_shared_log_once() {
  local order="$1"; shift
  local home="$TMP_DIR/shared-$order-home" script="$TMP_DIR/shared-$order.sh" before=$FAIL_COUNT tool_dir output status count
  mkdir -p "$home/.agents/skills/alpha"
  printf -- '---\nname: alpha\nmetadata:\n  version: "1.2.0" # x-release-please-version\n---\n' > "$home/.agents/skills/alpha/SKILL.md"
  : > "$script"
  for tool_dir in "$@"; do
    sed -n "/^$LOG_START/,\$p" "$SKILLS_ROOT/$tool_dir/templates/post-start-block.sh" >> "$script"
    # Stands in for this block's sync installing a Skill of its own. $HOME is
    # expanded by the composed script, not here.
    # shellcheck disable=SC2016
    printf 'mkdir -p "$HOME/.agents/skills/from-%s" && printf -- "---\\nname: x\\n---\\n" > "$HOME/.agents/skills/from-%s/SKILL.md"\n' "$tool_dir" "$tool_dir" >> "$script"
  done
  status=0; output="$(HOME="$home" bash -euo pipefail "$script" 2>&1)" || status=$?
  if [ "$status" -ne 0 ]; then fail "[shared $order] composed blocks exited $status: $output"; fi
  count="$(grep -c "^skill-sync ($SHARED): alpha 1.2.0$" <<<"$output" || true)"
  if [ "$count" -ne 1 ]; then fail "[shared $order] expected alpha logged once, got $count: $output"; fi
  for tool_dir in "$@"; do
    if ! grep -qxF "skill-sync ($SHARED): from-$tool_dir (unversioned)" <<<"$output"; then fail "[shared $order] missing the Skill synced by $tool_dir: $output"; fi
  done
  if [ "$FAIL_COUNT" -eq "$before" ]; then echo "OK: [shared $order] one complete shared-directory log at the end"; fi
}
check_shared_log_once codex-first setup-codex-devcontainer setup-copilot-devcontainer setup-antigravity-devcontainer
check_shared_log_once antigravity-first setup-antigravity-devcontainer setup-codex-devcontainer

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All checks passed."
