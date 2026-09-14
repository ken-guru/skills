#!/bin/bash
set -euo pipefail

# Derives a flat, deduplicated list of every host declared across the
# Network Manifest's keyed entries (network-manifest.json — see
# CONTEXT.md's "Network Manifest" glossary entry and ADR-0005). Prints one
# host per line, in manifest order, so a caller can capture it (e.g.
# `DOMAINS="$(network-manifest-domains.sh <file>)"`, or split into a bash
# array with `while read -r`) the same way the ported reference
# implementation's own derivation helper is consumed.
#
# The manifest is an object keyed by CLI name, plus one "baseline" key
# (chosen because the universal npm/GitHub hosts aren't owned by any single
# CLI — see network-manifest.json's own seed data) holding the same shape:
# a `networkAllowlist` array of {host, purpose, source} objects. A keyed
# entry with an empty or entirely-missing `networkAllowlist` contributes no
# hosts; that's expected, not an error, since not every CLI Skill installed
# in a given container declares one.
#
# firewall-lib.sh's firewall_collect_domains() (copied into .devcontainer/
# alongside network-manifest.json — see setup-devcontainer/SKILL.md step 5)
# is the consumer: both init-firewall.sh and refresh-allowlist.sh source it
# to build their domain list.

usage() {
  cat >&2 <<'EOF'
Usage: network-manifest-domains.sh <manifest-file>

Reads <manifest-file> (the Network Manifest) and prints one deduplicated
host per line, in manifest order, across every keyed entry's
`networkAllowlist`.

Exits non-zero if <manifest-file> doesn't exist, isn't valid JSON, or the
derived list is empty — fail loudly rather than let a consumer (e.g. a
firewall) silently end up with an empty allowlist.
EOF
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

MANIFEST="$1"

[ -f "$MANIFEST" ] || { echo "network-manifest-domains.sh: no such file: $MANIFEST" >&2; exit 1; }

# No `mapfile` (bash 4+ only) — this repo's other scripts target bash 3.2
# (macOS's system /bin/bash), so a plain variable capture is used instead.
DOMAINS="$(jq -r 'to_entries[] | .value.networkAllowlist[]?.host' "$MANIFEST" | awk '!seen[$0]++')"

# A parse failure or empty manifest would otherwise silently drop every
# host from the derived list — fail loudly instead.
if [ -z "$DOMAINS" ]; then
  echo "network-manifest-domains.sh: no hosts found in $MANIFEST" >&2
  exit 1
fi

printf '%s\n' "$DOMAINS"
