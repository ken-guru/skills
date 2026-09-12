# --- Claude Code skill-sync ---
# Claude Code skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
/workspace/.devcontainer/skills-refresh.sh --agent claude-code --target "$HOME/.claude/skills" {{SKILLS_SOURCES_COMMANDS}}
