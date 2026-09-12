#!/bin/bash
set -euo pipefail

# BASH_ENV loads only non-secret settings. Skill sources may use the
# host-provided GH_TOKEN, never a token from the Shared Checkout.

# Runs on every container start (not just create/rebuild). Empty by design —
# each CLI skill appends its own skill-sync block here, under its own
# marker, when the user opts into automatic skill sync for that tool.
# --- Claude Code skill-sync ---
# Claude Code skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
/workspace/.devcontainer/skills-refresh.sh --agent claude-code --target "$HOME/.claude/skills" --source mattpocock/skills --skill '*'
# --- Codex skill-sync ---
# Codex skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
/workspace/.devcontainer/skills-refresh.sh --agent codex --target "$HOME/.codex/skills" --source mattpocock/skills --skill '*'
