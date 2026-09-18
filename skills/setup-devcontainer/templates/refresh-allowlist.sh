#!/bin/bash
set -euo pipefail

# Background loop, started by post-start.sh right after init-firewall.sh:
# every INTERVAL seconds, re-resolves the full firewall domain list into a
# scratch ipset and atomically `ipset swap`s it into the live
# 'allowed-domains' set, so CDN-backed hosts whose IPs rotate don't go stale
# mid-session and force a container restart to recover (ADR-0005; see the
# reference project's own docs/adr/0028-devcontainer-firewall-allowlist.md
# for the production incident this fixes).
#
# Uses the exact same firewall_collect_github_ranges()/firewall_collect_domains()
# steps init-firewall.sh uses (firewall-lib.sh), not independently
# hand-maintained copies — this is what prevents the "two scripts silently
# drift apart" bug that reference project's own ADR documents hitting twice
# in production, before its fix was to derive both from one source instead
# of duplicating a list by hand in each script.
#
# If any required fetch fails mid-cycle, the swap is skipped entirely: the
# live set keeps serving stale-but-working entries until the next
# successful cycle, rather than being replaced by an incomplete one.

INTERVAL="${FIREWALL_REFRESH_INTERVAL:-300}"

FIREWALL_DEVCONTAINER_DIR="/workspace/.devcontainer"
# shellcheck source=firewall-lib.sh
source "$FIREWALL_DEVCONTAINER_DIR/firewall-lib.sh"

while true; do
  sleep "$INTERVAL"

  ipset create allowed-domains-new hash:net 2>/dev/null || ipset flush allowed-domains-new

  if ! firewall_collect_github_ranges; then
    echo "WARN: refresh-allowlist: failed to fetch GitHub IP ranges — skipping swap" >&2
    ipset destroy allowed-domains-new 2>/dev/null || true
    continue
  fi
  for cidr in "${FIREWALL_GITHUB_CIDRS[@]}"; do
    [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]] || continue
    ipset add allowed-domains-new "$cidr" -exist 2>/dev/null || true
  done

  if ! firewall_collect_domains; then
    echo "WARN: refresh-allowlist: failed to collect Network Manifest + local domains — skipping swap" >&2
    ipset destroy allowed-domains-new 2>/dev/null || true
    continue
  fi
  for domain in "${FIREWALL_DOMAINS[@]}"; do
    ips=$(dig +noall +answer A "$domain" 2>/dev/null | awk '$4 == "A" {print $5}')
    while read -r ip; do
      [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || continue
      ipset add allowed-domains-new "$ip" -exist 2>/dev/null || true
    done < <(echo "$ips")
  done

  # Same Google-fronted-host detection as init-firewall.sh: a GFE-fronted
  # host resolved via dig above only ever captures one of many IPs it
  # round-robins across, so it needs Google's full published range too.
  needs_google_ranges=false
  for domain in "${FIREWALL_DOMAINS[@]}"; do
    if firewall_host_is_google_fronted "$domain"; then
      needs_google_ranges=true
      break
    fi
  done
  if [ "$needs_google_ranges" = true ]; then
    if ! firewall_collect_google_ranges; then
      echo "WARN: refresh-allowlist: failed to fetch Google IP ranges — skipping swap" >&2
      ipset destroy allowed-domains-new 2>/dev/null || true
      continue
    fi
    for cidr in "${FIREWALL_GOOGLE_CIDRS[@]}"; do
      [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]] || continue
      ipset add allowed-domains-new "$cidr" -exist 2>/dev/null || true
    done
  fi

  ipset swap allowed-domains-new allowed-domains
  ipset destroy allowed-domains-new
done
