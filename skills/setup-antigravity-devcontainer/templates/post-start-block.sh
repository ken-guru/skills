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
