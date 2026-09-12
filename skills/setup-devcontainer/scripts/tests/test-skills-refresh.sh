#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFRESH="$SCRIPT_DIR/../../templates/skills-refresh.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAKE_BIN="$TMP_DIR/bin"
mkdir -p "$FAKE_BIN"
FAKE_NPX="$FAKE_BIN/npx"
printf '%s\n' \
  '#!/bin/bash' \
  'set -euo pipefail' \
  'if [ "${3:-}" = "--version" ]; then echo "skills-test-1"; exit 0; fi' \
  '[ "${FAKE_REFRESH_FAIL:-0}" != 1 ] || exit 17' \
  'agent=""; source="${4:-unknown}"' \
  'while [ "$#" -gt 0 ]; do case "$1" in -a) agent="$2"; shift 2;; --source) source="$2"; shift 2;; *) shift;; esac; done' \
  'case "$agent" in claude-code) relative=.claude/skills/demo;; codex) relative=.codex/skills/demo;; *) relative=.agent/skills/demo;; esac' \
  'mkdir -p "$HOME/$relative"' \
  'printf "%s\\n" "${FAKE_REFRESH_CONTENT:-old from $source}" > "$HOME/$relative/SKILL.md"' \
  > "$FAKE_NPX"
chmod +x "$FAKE_NPX"

HOME="$TMP_DIR/home" PATH="$FAKE_BIN:$PATH" "$REFRESH" \
  --agent claude-code --target "$TMP_DIR/home/.claude/skills" --source first/source --skill '*'
grep -q 'old from first/source' "$TMP_DIR/home/.claude/skills/demo/SKILL.md"
[ -f "$TMP_DIR/home/.claude/.skills-manifest" ]

FAKE_REFRESH_CONTENT="new content" HOME="$TMP_DIR/home" PATH="$FAKE_BIN:$PATH" "$REFRESH" \
  --agent claude-code --target "$TMP_DIR/home/.claude/skills" --source second/source --skill '*'
grep -q 'new content' "$TMP_DIR/home/.claude/skills/demo/SKILL.md"
[ -f "$TMP_DIR/home/.claude/.skills-manifest.previous" ]
[ ! -d "$TMP_DIR/home/.claude/skills.previous" ]

if FAKE_REFRESH_FAIL=1 HOME="$TMP_DIR/home" PATH="$FAKE_BIN:$PATH" "$REFRESH" \
  --agent claude-code --target "$TMP_DIR/home/.claude/skills" --source failed/source --skill '*'; then
  echo "FAIL: failed refresh unexpectedly succeeded" >&2
  exit 1
fi
grep -q 'new content' "$TMP_DIR/home/.claude/skills/demo/SKILL.md"

echo "Curated Skill Set refresh checks passed."
