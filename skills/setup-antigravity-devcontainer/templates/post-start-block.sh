# --- Antigravity skill-sync ---
# Antigravity skills are synced from the configured sources on every start, so
# the skill set stays current with upstream. The `skills` CLI writes them to
# the Shared Skills Directory (~/.agents/skills) for every "universal" agent,
# `antigravity-cli` included; agy sees that directory through the skills-link
# block (a link from ~/.gemini/skills). Nothing is wiped, so a skill removed
# upstream stays until it is deleted by hand. This lives inside the shared
# config volume, so no separate volume is needed.
#
# Trust boundary: the source(s) below were named and accepted during this
# devcontainer's setup. Every start re-fetches and re-runs their skills
# unattended, with no per-skill review step — only as trustworthy as the
# source(s) chosen.
{{SKILLS_SOURCES_COMMANDS}}

# Log what this sync installed: one line per Skill in ~/.agents/skills, with its
# metadata.version, or "(unversioned)" for a Skill that declares none. This is
# the only record of what an unattended sync changed since the last start.
for skill_md in "$HOME/.agents/skills"/*/SKILL.md; do
  [ -f "$skill_md" ] || continue
  skill_version="$(sed -n 's/^  version: "\([^"]*\)".*$/\1/p' "$skill_md" 2>/dev/null | head -n 1)" || true
  echo "skill-sync (Antigravity): $(basename "$(dirname "$skill_md")") ${skill_version:-(unversioned)}"
done
