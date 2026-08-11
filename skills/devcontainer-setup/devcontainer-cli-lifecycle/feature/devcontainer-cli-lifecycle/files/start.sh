#!/bin/bash
# Entry point this Feature's postStartCommand invokes. Wraps run-age-gate.sh
# in a timeout read from tool-manifest.json's startupUpdate.timeoutSeconds
# (120s if the manifest is missing or that field isn't set) -- a container
# start should never hang indefinitely on a slow or unreachable registry.
#
# Usage: start.sh <container-workspace-folder>

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WORKSPACE_FOLDER=${1:?"container workspace folder required (pass \${containerWorkspaceFolder})"}
MANIFEST="$SCRIPT_DIR/tool-manifest.json"

TIMEOUT_SECONDS=120
if [ -f "$MANIFEST" ]; then
    configured=$(node -e "const m = require(process.argv[1]); const v = m.startupUpdate?.timeoutSeconds; if (v !== undefined) console.log(v)" "$MANIFEST" 2>/dev/null)
    [ -n "$configured" ] && TIMEOUT_SECONDS=$configured
fi

timeout "$TIMEOUT_SECONDS" bash "$SCRIPT_DIR/run-age-gate.sh" "$WORKSPACE_FOLDER"
status=$?
if [ "$status" -eq 124 ]; then
    echo "WARN devcontainer-cli-lifecycle: age-gate check timed out after ${TIMEOUT_SECONDS}s -- tools remain at their previous versions this cycle." >&2
fi
exit 0
