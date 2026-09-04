#!/bin/bash
set -euo pipefail
# Runs on every container start (not just create/rebuild).

# Copilot skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the existing
# per-repo Copilot config volume, so no separate volume is needed.
rm -rf /home/vscode/.copilot/skills/* 2>/dev/null || true
{{SKILLS_SOURCES_COMMANDS}}
