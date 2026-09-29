# --- Claude Code skill-sync ---
# Claude Code skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
#
# Trust boundary: the source(s) below were named and accepted during this
# devcontainer's setup. Every start re-fetches and re-runs their skills
# unattended, with no per-skill review step — only as trustworthy as the
# source(s) chosen. The wipe itself is scoped to this one directory inside
# the container; nothing outside it is touched.
rm -rf /home/vscode/.claude/skills/* 2>/dev/null || true
{{SKILLS_SOURCES_COMMANDS}}

# Log what this sync installed: one line per Skill in ~/.claude/skills, with its
# metadata.version, or "(unversioned)" for a Skill that declares none. This is
# the only record of what an unattended sync changed since the last start.
for skill_md in "$HOME/.claude/skills"/*/SKILL.md; do
  [ -f "$skill_md" ] || continue
  skill_version="$(sed -n 's/^  version: "\([^"]*\)".*$/\1/p' "$skill_md" 2>/dev/null | head -n 1)" || true
  echo "skill-sync (Claude Code): $(basename "$(dirname "$skill_md")") ${skill_version:-(unversioned)}"
done
