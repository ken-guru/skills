#!/bin/bash
set -euo pipefail

# See post-create-base.sh for why this is needed — devcontainer.json never
# loads .devcontainer/.env into the container environment on its own. A
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
