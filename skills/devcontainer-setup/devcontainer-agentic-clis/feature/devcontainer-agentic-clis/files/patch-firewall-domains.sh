#!/bin/bash
# postCreateCommand for the devcontainer-agentic-clis Feature. Patches each
# installed CLI's own vendor API/auth domains (cli-vendor-domains.json, in
# this same directory) into devcontainer-firewall's allowed-domains
# manifest, if devcontainer-firewall is installed.
#
# Runs at postCreateCommand time -- an earlier lifecycle phase than
# devcontainer-firewall's own postStartCommand, which reads the
# now-patched manifest. The devcontainer spec guarantees every Feature's
# postCreateCommand completes, across the whole container, before any
# Feature's postStartCommand runs, so this ordering is correct regardless
# of which order the two Features were installed in -- see
# feature-conventions.md's "dependsOn vs. installsAfter" section for why
# this doesn't need installsAfter at all.
#
# Retrofit Contract: if devcontainer-firewall isn't installed, there's
# nothing to patch into. Detect that and skip cleanly -- this is not an
# error, it's a container that simply doesn't have this suite's firewall.
#
# Usage: patch-firewall-domains.sh <container-workspace-folder>

set -euo pipefail

WORKSPACE_FOLDER=${1:?"container workspace folder required (pass \${containerWorkspaceFolder})"}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

FIREWALL_MANIFEST="$WORKSPACE_FOLDER/.devcontainer/devcontainer-firewall/feature/devcontainer-firewall/files/allowed-domains.manifest.json"
CLI_DOMAINS="$SCRIPT_DIR/cli-vendor-domains.json"

if [ ! -f "$FIREWALL_MANIFEST" ]; then
    echo "devcontainer-firewall not installed (no manifest at $FIREWALL_MANIFEST) -- skipping vendor-API domain patch."
    exit 0
fi

if [ ! -f "$CLI_DOMAINS" ]; then
    echo "WARN: no cli-vendor-domains.json found next to this script -- copy cli-vendor-domains.example.json and fill in your installed CLIs' vendor domains, or every installed CLI will fail to reach its own backend once the firewall is active." >&2
    exit 0
fi

tmp=$(mktemp)
jq --slurpfile clis "$CLI_DOMAINS" '
  .tools += (
    $clis[0]
    | with_entries(select(.key != "_comment"))
    | to_entries
    | map({key: (.key + "-vendor-api"), value: .value})
    | from_entries
  )
' "$FIREWALL_MANIFEST" > "$tmp" && mv "$tmp" "$FIREWALL_MANIFEST"

patched_count=$(jq '[with_entries(select(.key != "_comment")) | keys[]] | length' "$CLI_DOMAINS")
echo "Patched $patched_count CLI vendor-domain entries into $FIREWALL_MANIFEST"
