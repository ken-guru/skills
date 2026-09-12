# --- Antigravity skill-sync ---
# Antigravity skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
/workspace/.devcontainer/skills-refresh.sh --agent antigravity --target "$HOME/.gemini/antigravity/skills" {{SKILLS_SOURCES_COMMANDS}}
