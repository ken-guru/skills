#!/bin/bash
# Self-bootstrapping devcontainer firewall init script, part of the
# devcontainer-firewall Feature. Invoked via start.sh at container
# postStartCommand time -- not meant to be run standalone.
#
# Builds a deny-by-default outbound firewall with an explicit allowlist.
# Ships with placeholder domains and a placeholder CIDR-provider fetch;
# adapt allowed-domains.manifest.json (copied from
# allowed-domains.manifest.example.json) and the provider fetch block below
# to your own project before relying on this.
#
# Companion script: refresh-allowlist.sh (periodic re-resolution for
# CDN-backed domains, atomic ipset swap) -- launched by start.sh only if
# enabled; see this Skill's SKILL.md.

set -euo pipefail
IFS=$'\n\t'

# --- Step 1: reset to permissive BEFORE touching anything else -------------
#
# `iptables -F` flushes rules but not the default chain *policies*. If a
# previous run of this script died after tightening OUTPUT to DROP (near the
# end of this script) but before the allowlist was fully built, every later
# run would inherit that DROP policy -- including this script's own
# bootstrap network calls below, which need network access to build the
# allowlist that would let them through. That is a permanent deadlock with
# no way to recover except editing the rules by hand.
#
# Starting every run from ACCEPT guarantees the script can always bootstrap
# itself, no matter how the previous run ended.
iptables -P INPUT ACCEPT
iptables -P OUTPUT ACCEPT
iptables -P FORWARD ACCEPT

# Flush existing rules and any leftover allowlist set from a prior run.
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
ipset destroy allowed-domains 2>/dev/null || true

# Allow DNS and loopback before any restrictions apply.
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# --- Step 2: build the allowlist set ----------------------------------------

ipset create allowed-domains hash:net

# Optional: pull in a provider's published CIDR ranges instead of hand-listing
# every IP for a host with well-known address blocks (a package registry, a
# git forge, a cloud provider). Example shape, using a placeholder provider
# that publishes ranges as JSON:
echo "Fetching example-provider IP ranges..."
provider_ranges=$(curl -s --connect-timeout 10 https://api.example-provider.com/meta)
if [ -z "$provider_ranges" ]; then
    echo "ERROR: failed to fetch example-provider IP ranges"
    exit 1
fi
if ! echo "$provider_ranges" | jq -e '.web and .api' >/dev/null; then
    echo "ERROR: example-provider meta response missing required fields"
    exit 1
fi
while read -r cidr; do
    # The ipset this populates is IPv4-only (hash:net, default family inet),
    # and this script installs no ip6tables rules, so an IPv6 CIDR is never
    # usable here regardless of how well-formed it is. Some providers mix
    # IPv6 ranges into the same array as IPv4 ranges without warning (GitHub's
    # `api.github.com/meta` started doing exactly this) -- skip those
    # silently rather than treating "not IPv4" as a fatal parse error, and
    # reserve the hard failure below for a genuinely malformed IPv4-shaped
    # entry. Getting this wrong the other way means the very first IPv6
    # entry a provider ever returns aborts firewall init entirely, on every
    # container start, with no allowlist ever getting built.
    if [[ "$cidr" == *:* ]]; then
        continue
    fi
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: invalid CIDR range from example-provider meta: $cidr"
        exit 1
    fi
    ipset add allowed-domains "$cidr" -exist
done < <(echo "$provider_ranges" | jq -r '(.web + .api)[]')

# Derive the per-tool domain list from a shared manifest instead of
# hand-listing them here, so this list and refresh-allowlist.sh's copy can
# never drift apart -- both scripts source the same helper. See
# allowed-domains.manifest.example.json and domains-from-manifest.sh.template
# for the manifest shape and helper. domains-from-manifest.sh fails loudly
# (non-zero exit) if the manifest is missing or empty, which this script lets
# propagate via `set -e` rather than silently continuing with no tool domains.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mapfile -t TOOL_DOMAINS < <("$SCRIPT_DIR/domains-from-manifest.sh")

# A single DNS query against most domains (a single-IP host, or a small,
# stable CDN anycast pool -- Cloudflare, Fastly) returns the complete
# answer, and resolving once here is correct. A domain backed by a large,
# rotating pool of IPs instead (an AWS-ELB-style name behind a CNAME chain,
# common for a vendor SaaS API reached via 8+ backend IPs) returns only a
# subset per query, not the full pool -- a single `dig` call at init time
# then permanently misses whichever IPs it didn't happen to get back,
# producing intermittent "No route to host" failures against that domain
# for the life of the container. Querying several times in quick succession
# and unioning the results catches more of the pool, though never
# guaranteed complete; it's a mitigation, not a fix. Prefer the provider's
# published CIDR range instead, if one exists (the pattern used for
# example-provider above), for any domain known to sit behind a large pool.
resolve_domain() {
    local domain=$1 attempts=${2:-1} i
    for ((i = 0; i < attempts; i++)); do
        dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}'
    done | sort -u
}

# Domains known or suspected to sit behind a large, rotating IP pool rather
# than a small stable one: add them here instead of the plain list below so
# they get the repeated-query treatment. Leave empty if none of your
# domains fit this shape.
MULTI_QUERY_DOMAINS=()

# Resolve and add plain domains. Replace this list with your project's own.
for domain in \
    "registry.example-package-manager.org" \
    "api.example-provider.com" \
    "example.com" \
    "docs.example.com" \
    "${TOOL_DOMAINS[@]}"; do
    attempts=1
    for multi_domain in "${MULTI_QUERY_DOMAINS[@]}"; do
        [ "$domain" = "$multi_domain" ] && attempts=4 && break
    done
    echo "Resolving $domain (attempts=$attempts)..."
    ips=$(resolve_domain "$domain" "$attempts")
    if [ -z "$ips" ]; then
        echo "WARN: failed to resolve $domain, skipping"
        continue
    fi
    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: invalid IP from DNS for $domain: $ip"
            exit 1
        fi
        ipset add allowed-domains "$ip" -exist
    done < <(echo "$ips")
done

# --- Step 3: host and desktop-runtime bridge networks -----------------------

HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: failed to detect host IP"
    exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Some desktop container runtimes route port-forwarded traffic through a
# separate host bridge (commonly resolvable via a well-known internal
# hostname) rather than through the ordinary container bridge network used
# above. Without a rule for it, mapped ports can be unreachable from the
# host even though the runtime reports them as bound. This resolves that
# bridge hostname and only adds a rule if it differs from the network
# already detected above; on runtimes with no such bridge this is a no-op.
BRIDGE_HOST_IP=$(dig +short host.docker.internal 2>/dev/null | grep -E '^[0-9]+\.' | tail -1)
if [ -n "$BRIDGE_HOST_IP" ] && [ "$BRIDGE_HOST_IP" != "$HOST_IP" ]; then
    BRIDGE_HOST_NETWORK=$(echo "$BRIDGE_HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
    echo "Desktop runtime host bridge detected: $BRIDGE_HOST_NETWORK"
    iptables -A INPUT -s "$BRIDGE_HOST_NETWORK" -j ACCEPT
    iptables -A OUTPUT -d "$BRIDGE_HOST_NETWORK" -j ACCEPT
else
    echo "No desktop runtime host bridge detected"
fi

# --- Step 4: tighten to deny-by-default -------------------------------------

iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# --- Step 5: self-verify -----------------------------------------------------
#
# Every individual rule-install command above can exit 0 while the net
# effect of the rule set is still wrong (ordering mistakes, an ipset that
# failed to populate). Close the loop with two live checks: a domain that
# must be blocked, and a domain that must be reachable.
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://blocked.example.com >/dev/null 2>&1; then
    echo "ERROR: firewall verification failed, reached a domain that should be blocked"
    exit 1
else
    echo "OK: blocked domain correctly unreachable"
fi

if ! curl --connect-timeout 5 https://api.example-provider.com >/dev/null 2>&1; then
    echo "ERROR: firewall verification failed, could not reach an allowed domain"
    exit 1
else
    echo "OK: allowed domain correctly reachable"
fi

echo "Firewall configuration complete"
