# --- Codex skill-sync ---
# Codex skills are synced from the configured sources on every start, so
# the skill set stays current with upstream. The `skills` CLI writes them to
# the Shared Skills Directory (~/.agents/skills) for every "universal" agent,
# `codex` included — the same directory Copilot's and Antigravity's
# skill-sync also write into, so nothing here wipes it (a wipe from one
# CLI's block would delete skills another CLI's block just synced). A skill
# removed upstream stays until it is deleted by hand. This lives inside the
# shared config volume, so no separate volume is needed.
#
# Trust boundary: the source(s) below were named and accepted during this
# devcontainer's setup. Every start re-fetches and re-runs their skills
# unattended, with no per-skill review step — only as trustworthy as the
# source(s) chosen.
{{SKILLS_SOURCES_COMMANDS}}

# Log what this sync installed: one line per Skill in ~/.agents/skills, with
# its metadata.version, or "(unversioned)" for a Skill that declares none. This
# is the only record of what an unattended sync changed since the last start.
# Codex, Copilot and Antigravity all sync into that shared directory, so
# whichever of their blocks runs first registers a single log for the end of
# post-start.sh, after every block has synced; the others skip it.
if [ -z "${SHARED_SKILLS_LOG_REGISTERED:-}" ]; then
  SHARED_SKILLS_LOG_REGISTERED=1
  log_shared_skills() {
    local skill_md skill_version
    for skill_md in "$HOME/.agents/skills"/*/SKILL.md; do
      [ -f "$skill_md" ] || continue
      skill_version="$(sed -n 's/^  version: "\([^"]*\)".*$/\1/p' "$skill_md" 2>/dev/null | head -n 1)" || true
      echo "skill-sync (shared ~/.agents/skills): $(basename "$(dirname "$skill_md")") ${skill_version:-(unversioned)}"
    done
  }
  trap log_shared_skills EXIT
fi
