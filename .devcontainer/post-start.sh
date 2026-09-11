#!/bin/bash
set -euo pipefail

# BASH_ENV (see post-create-base.sh) already sources this before this
# script's first line runs, but source it again directly, defensively, in
# case this script is ever run by hand outside that containerEnv. A
# skill-sync block appended below may need GH_TOKEN (private skill sources).
ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Runs on every container start (not just create/rebuild). Empty by design —
# each CLI skill appends its own skill-sync block here, under its own
# marker, when the user opts into automatic skill sync for that tool.
# --- Claude Code skill-sync ---
# Claude Code skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
rm -rf /home/vscode/.claude/skills/* 2>/dev/null || true
npx -y skills add mattpocock/skills --skill '*' -a claude-code -y --copy -g
