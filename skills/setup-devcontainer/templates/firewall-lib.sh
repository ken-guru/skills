#!/bin/bash
# Shared by init-firewall.sh and refresh-allowlist.sh (sourced, never
# executed directly) — the single place that builds what both scripts
# enforce, from the same sources every time, so neither script keeps its
# own independent copy of this logic. That's what the-words-are-snake's own
# ADR-0028 documents drifting twice in production for its general
# allowlist (one script's list gaining a domain, or a CIDR-fetch step
# changing, that the other's copy didn't), before that project's fix was to
# derive both from one source instead of hand-duplicating. Sourcing this
# one file from both scripts here closes that gap by construction rather
# than by procedural reminder.
#
# Two independent collectors, each following the same convention: set an
# output array on success, return 1 (never `exit`) on failure so a caller
# running in a long-lived loop (refresh-allowlist.sh) can skip one refresh
# cycle instead of dying, while init-firewall.sh treats a non-zero return as
# fatal itself.

FIREWALL_DEVCONTAINER_DIR="${FIREWALL_DEVCONTAINER_DIR:-/workspace/.devcontainer}"

# GitHub's IP ranges, fetched live from api.github.com/meta — never
# hardcoded, so github.com/api.github.com stay reachable as GitHub's
# published ranges change, and GitHub's documented SSH range (the .git
# field) is covered with no separate rule needed. Sets FIREWALL_GITHUB_CIDRS
# (a bash array of aggregated CIDR strings, unvalidated per-entry — each
# caller applies its own CIDR-shape check and its own policy for what an
# invalid entry means, since init-firewall.sh and refresh-allowlist.sh
# deliberately differ there: the former aborts on a bad entry, the latter
# skips just that one entry and keeps going).
firewall_collect_github_ranges() {
  local gh_ranges
  gh_ranges=$(curl -s --connect-timeout 10 https://api.github.com/meta 2>/dev/null || true)
  if [ -z "$gh_ranges" ] || ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null 2>&1; then
    echo "firewall-lib: failed to fetch or parse GitHub IP ranges from api.github.com/meta" >&2
    return 1
  fi

  FIREWALL_GITHUB_CIDRS=()
  local cidr
  while IFS= read -r cidr; do
    [ -n "$cidr" ] && FIREWALL_GITHUB_CIDRS+=("$cidr")
  done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

  if [ "${#FIREWALL_GITHUB_CIDRS[@]}" -eq 0 ]; then
    echo "firewall-lib: no CIDR ranges derived from GitHub's meta response" >&2
    return 1
  fi
  return 0
}

# Sets FIREWALL_DOMAINS (a bash array) on success — the Network Manifest
# (network-manifest.json, via its own network-manifest-domains.sh
# derivation helper) plus this repo's own project-specific
# allowed-domains.local.txt.
firewall_collect_domains() {
  local manifest="$FIREWALL_DEVCONTAINER_DIR/network-manifest.json"
  local derive="$FIREWALL_DEVCONTAINER_DIR/network-manifest-domains.sh"
  local local_file="$FIREWALL_DEVCONTAINER_DIR/allowed-domains.local.txt"

  if [ ! -x "$derive" ]; then
    echo "firewall-lib: network-manifest-domains.sh not found or not executable at $derive" >&2
    return 1
  fi

  local manifest_domains
  if ! manifest_domains="$("$derive" "$manifest")"; then
    echo "firewall-lib: network-manifest-domains.sh failed against $manifest" >&2
    return 1
  fi

  FIREWALL_DOMAINS=()
  local host
  while IFS= read -r host; do
    [ -n "$host" ] && FIREWALL_DOMAINS+=("$host")
  done <<< "$manifest_domains"

  # allowed-domains.local.txt: one host per line, blank lines and #-comments
  # ignored — created empty by the base skill, never touched again by any
  # skill after that (see CONTEXT.md / ADR-0005), so a repo owner's own
  # project-specific hosts live here without editing any base- or
  # CLI-Skill-owned file.
  if [ -f "$local_file" ]; then
    local raw trimmed
    # `|| [ -n "$raw" ]` keeps the loop body running for a final line that
    # has no trailing newline — plain `while read; do ...; done < file`
    # silently drops that last line otherwise (`read` reports EOF-without-
    # newline as failure, which is also the loop's own termination
    # condition), which would silently drop a host from the allowlist
    # exactly the kind of failure network-manifest-domains.sh's own
    # "fail loudly, never silently drop a domain" rule exists to avoid.
    while IFS= read -r raw || [ -n "$raw" ]; do
      trimmed="${raw%%#*}"
      trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
      [ -n "$trimmed" ] && FIREWALL_DOMAINS+=("$trimmed")
    done < "$local_file"
  fi

  if [ "${#FIREWALL_DOMAINS[@]}" -eq 0 ]; then
    echo "firewall-lib: no domains derived from the Network Manifest + local file" >&2
    return 1
  fi
  return 0
}
