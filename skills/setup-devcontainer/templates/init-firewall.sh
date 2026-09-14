#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Opt-in network egress firewall (ADR-0005:
# skills/setup-devcontainer/docs/adr/0005-network-egress-firewall-and-network-manifest.md).
# Default-DROP iptables + ipset, mechanism ported from a production-proven
# sibling implementation (the-words-are-snake's
# .devcontainer/init-firewall.sh, see that repo's own
# docs/adr/0028-devcontainer-firewall-allowlist.md for the incident history
# behind the choices below) rather than copied verbatim — this file reads
# its domain list entirely from the Network Manifest (network-manifest.json,
# via network-manifest-domains.sh) plus this repo's own
# allowed-domains.local.txt, never a hardcoded list.
#
# Runs as root via a NOPASSWD sudoers rule scoped to exactly this script's
# path (and refresh-allowlist.sh's), baked into the image at build time —
# see templates/Dockerfile.with-firewall. Invoked by post-start.sh on every
# container start, not just create.

FIREWALL_DEVCONTAINER_DIR="/workspace/.devcontainer"
# shellcheck source=firewall-lib.sh
source "$FIREWALL_DEVCONTAINER_DIR/firewall-lib.sh"

# Docker's embedded DNS resolver (127.0.0.11), if present, must survive the
# flush below — captured before any flushing or policy changes, restored
# right after so name resolution (this script's own `dig` calls included)
# keeps working throughout.
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Reset default chain policies to ACCEPT before touching anything else.
# `iptables -F` only flushes rules, not policies — if a previous run of this
# script died after setting a policy to DROP (below) but before the
# allowlist rules were in place, every later run would inherit that DROP
# policy, including this run's own bootstrap `curl` to api.github.com/meta,
# which needs network access to build the very allowlist that would let it
# through. That is a permanent deadlock. Starting from ACCEPT guarantees
# this script can always bootstrap itself regardless of how the previous run
# ended (the incident this closes is documented in the reference project's
# own ADR-0028).
iptables -P INPUT ACCEPT
iptables -P OUTPUT ACCEPT
iptables -P FORWARD ACCEPT

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

if [ -n "$DOCKER_DNS_RULES" ]; then
  echo "Restoring Docker embedded DNS rules..."
  iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
  iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
  echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
  echo "No Docker embedded DNS rules to restore"
fi

# DNS and loopback, before any restriction.
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

if ! firewall_collect_domains; then
  echo "ERROR: could not build the firewall domain list — aborting" >&2
  exit 1
fi

# GitHub's IP ranges, fetched live at every run (never hardcoded) — this is
# what makes github.com/api.github.com genuinely reachable rather than
# depending on a single `dig` snapshot, and covers GitHub's documented SSH
# range too (the .git field) with no separate TCP 22 rule needed.
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s --connect-timeout 10 https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
  echo "ERROR: Failed to fetch GitHub IP ranges" >&2
  exit 1
fi
if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
  echo "ERROR: GitHub API response missing required fields" >&2
  exit 1
fi
echo "Processing GitHub IP ranges..."
while read -r cidr; do
  if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
    echo "ERROR: Invalid CIDR range from GitHub meta: $cidr" >&2
    exit 1
  fi
  ipset add allowed-domains "$cidr" -exist
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

echo "Resolving Network Manifest + project-local domains..."
for domain in "${FIREWALL_DOMAINS[@]}"; do
  echo "Resolving $domain..."
  ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
  if [ -z "$ips" ]; then
    echo "WARN: Failed to resolve $domain — skipping" >&2
    continue
  fi
  while read -r ip; do
    if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
      echo "ERROR: Invalid IP from DNS for $domain: $ip" >&2
      exit 1
    fi
    ipset add allowed-domains "$ip" -exist
  done < <(echo "$ips")
done

# Host network — lets the container reach the Docker host itself (e.g. a
# database or dev server bound on the host).
HOST_IP=$(ip route | awk '/default/ {print $3; exit}')
if [ -z "$HOST_IP" ]; then
  echo "ERROR: Failed to detect host IP" >&2
  exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Docker Desktop on macOS routes port-forwarded traffic through its VM-to-host
# bridge (host.docker.internal, typically 192.168.65.0/24) rather than
# through the Docker bridge network. Without this rule, mapped ports are
# unreachable from the macOS host even though Docker reports them as bound.
DOCKER_HOST_IP=$(dig +short host.docker.internal 2>/dev/null | grep -E '^[0-9]+\.' | tail -1)
if [ -n "$DOCKER_HOST_IP" ] && [ "$DOCKER_HOST_IP" != "$HOST_IP" ]; then
  DOCKER_HOST_NETWORK=$(echo "$DOCKER_HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
  echo "Docker Desktop bridge detected: $DOCKER_HOST_NETWORK"
  iptables -A INPUT -s "$DOCKER_HOST_NETWORK" -j ACCEPT
  iptables -A OUTPUT -d "$DOCKER_HOST_NETWORK" -j ACCEPT
else
  echo "No Docker Desktop bridge detected (Linux host or resolution failed)"
fi

# Default-DROP, with an explicit REJECT for outbound traffic so a blocked
# connection fails fast and visibly instead of hanging until a client-side
# timeout.
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Firewall configuration complete. Verifying..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
  echo "ERROR: Firewall verification failed — reached https://example.com (should be blocked)" >&2
  exit 1
else
  echo "Firewall verification passed — https://example.com unreachable, as expected"
fi
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
  echo "ERROR: Firewall verification failed — could not reach https://api.github.com" >&2
  exit 1
else
  echo "Firewall verification passed — https://api.github.com reachable, as expected"
fi
