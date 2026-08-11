#!/bin/bash
# Template: shared helper that flattens allowed-domains.manifest.json into a
# plain domain list. Source this from BOTH init-firewall.sh and
# refresh-allowlist.sh instead of hand-listing domains inline in either --
# two independently maintained domain lists drift the first time someone
# updates only one of them, and because refresh-allowlist.sh does a full
# rebuild each cycle, that drift silently drops entries within one refresh
# interval of the edit, not gradually.
#
# Fails loudly (non-zero exit, nothing printed) if the manifest is missing
# or resolves to zero domains, rather than letting the caller silently
# proceed with an empty allowlist for every tool. A manifest helper that
# fails open defeats the point of having one.

set -euo pipefail

MANIFEST=${DOMAINS_MANIFEST_PATH:-"$(dirname "${BASH_SOURCE[0]}")/allowed-domains.manifest.json"}

if [ ! -f "$MANIFEST" ]; then
    echo "ERROR: domains-from-manifest: manifest not found at $MANIFEST" >&2
    exit 1
fi

domains=$(jq -r '.tools[].domains[]' "$MANIFEST" 2>/dev/null | sort -u)

if [ -z "$domains" ]; then
    echo "ERROR: domains-from-manifest: manifest at $MANIFEST parsed to zero domains" >&2
    exit 1
fi

echo "$domains"
