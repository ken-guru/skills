#!/bin/bash
set -euo pipefail

usage() { echo "Usage: skills-refresh.sh --agent <agent> --target <dir> --source <source> [--skill <name>]..." >&2; }
AGENT=""; TARGET=""; SOURCES=(); SKILLS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2;;
    --target) TARGET="$2"; shift 2;;
    --source) SOURCES+=("$2"); shift 2;;
    --skill) SKILLS+=("$2"); shift 2;;
    -h|--help) usage; exit 0;;
    *) usage; exit 64;;
  esac
done
[ -n "$AGENT" ] && [ -n "$TARGET" ] && [ "${#SOURCES[@]}" -gt 0 ] || { usage; exit 64; }

CONFIG_DIR="$(dirname "$TARGET")"
CURRENT_MANIFEST="$CONFIG_DIR/.skills-manifest"
PREVIOUS_MANIFEST="$CONFIG_DIR/.skills-manifest.previous"
mkdir -p "$CONFIG_DIR"
STAGE="$(mktemp -d "$CONFIG_DIR/.skills-refresh.XXXXXX")"
STAGE_HOME="$STAGE/home"
STAGE_TARGET="$STAGE_HOME/${TARGET#"$HOME"/}"
mkdir -p "$STAGE_TARGET"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

for source in "${SOURCES[@]}"; do
  selected=(--skill '*')
  if [ "${#SKILLS[@]}" -gt 0 ]; then
    selected=()
    for skill in "${SKILLS[@]}"; do selected+=(--skill "$skill"); done
  fi
  HOME="$STAGE_HOME" npx -y skills add "$source" "${selected[@]}" -a "$AGENT" -y --copy -g
done

[ -d "$STAGE_TARGET" ] || { echo "Skill refresh produced no target directory" >&2; exit 1; }
find "$STAGE_TARGET" -name SKILL.md -type f -print -quit | grep -q . || {
  echo "Skill refresh produced no valid skills" >&2
  exit 1
}

installer_version="$(HOME="$STAGE_HOME" npx -y skills --version 2>/dev/null || echo unknown)"
manifest_tmp="$STAGE/manifest"
{
  printf 'installer\t%s\n' "$installer_version"
  printf 'source\t%s\n' "${SOURCES[*]}"
  find "$STAGE_TARGET" -name SKILL.md -type f -print0 | sort -z | while IFS= read -r -d '' file; do
    name="${file#"$STAGE_TARGET"/}"
    printf 'skill\t%s\t%s\n' "$name" "$(sha256sum "$file" | awk '{print $1}')"
  done
} > "$manifest_tmp"

previous_target="$STAGE/previous-target"
previous_manifest="$STAGE/previous-manifest"
had_target=0
had_manifest=0
new_target_installed=0
swap_started=0

rollback() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$swap_started" -eq 1 ]; then
    if [ "$new_target_installed" -eq 1 ]; then rm -rf "$TARGET"; fi
    if [ "$had_target" -eq 1 ]; then mv "$previous_target" "$TARGET" || true; fi
    if [ "$had_manifest" -eq 1 ]; then
      cp "$previous_manifest" "$CURRENT_MANIFEST" || true
    else
      rm -f "$CURRENT_MANIFEST"
    fi
  fi
  trap - EXIT
  cleanup
  exit "$status"
}
trap rollback EXIT

if [ -f "$CURRENT_MANIFEST" ]; then
  had_manifest=1
  cp "$CURRENT_MANIFEST" "$previous_manifest"
fi
swap_started=1
if [ -d "$TARGET" ]; then
  had_target=1
  mv "$TARGET" "$previous_target"
fi
mv "$STAGE_TARGET" "$TARGET"
new_target_installed=1
mv "$manifest_tmp" "$CURRENT_MANIFEST"
if [ "$had_manifest" -eq 1 ]; then cp "$previous_manifest" "$PREVIOUS_MANIFEST"; fi
rm -rf "$previous_target"
trap cleanup EXIT

echo "Curated Skill Set refreshed for $AGENT"
if [ -f "$PREVIOUS_MANIFEST" ]; then
  old_skills="$(awk -F '\t' '$1 == "skill" {print $2}' "$PREVIOUS_MANIFEST" | sort)"
  new_skills="$(awk -F '\t' '$1 == "skill" {print $2}' "$CURRENT_MANIFEST" | sort)"
  added="$(comm -13 <(printf '%s\n' "$old_skills") <(printf '%s\n' "$new_skills"))"
  removed="$(comm -23 <(printf '%s\n' "$old_skills") <(printf '%s\n' "$new_skills"))"
  changed="$(comm -12 <(printf '%s\n' "$old_skills") <(printf '%s\n' "$new_skills") | while read -r name; do
    old_hash="$(awk -F '\t' -v n="$name" '$1 == "skill" && $2 == n {print $3}' "$PREVIOUS_MANIFEST")"
    new_hash="$(awk -F '\t' -v n="$name" '$1 == "skill" && $2 == n {print $3}' "$CURRENT_MANIFEST")"
    [ "$old_hash" != "$new_hash" ] && echo "$name"
  done)"
  [ -z "$added" ] || printf '  added: %s\n' "$added"
  [ -z "$removed" ] || printf '  removed: %s\n' "$removed"
  [ -z "$changed" ] || printf '  changed: %s\n' "$changed"
fi
