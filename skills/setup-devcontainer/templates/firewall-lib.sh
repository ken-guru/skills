#!/bin/bash
# Shared by init-firewall.sh and refresh-allowlist.sh (sourced, never
# executed directly) — the single place that builds the domain list both
# scripts enforce, from the same two sources every time: the Network
# Manifest (network-manifest.json, via its own network-manifest-domains.sh
# derivation helper) and this repo's own project-specific
# allowed-domains.local.txt. Neither firewall script keeps its own
# independent copy of this list — that's what the-words-are-snake's own
# ADR-0028 documents drifting twice in production for its general
# allowlist (one script's list gaining a domain the other's didn't), before
# that project's fix was to derive both from one source instead of hand-
# duplicating. Sourcing this one file from both scripts here closes that
# gap by construction rather than by procedural reminder.
#
# Sets FIREWALL_DOMAINS (a bash array) on success. Returns 1 (does not
# `exit`) when no domains could be derived, so a caller running in a
# long-lived loop (refresh-allowlist.sh) can skip one refresh cycle instead
# of dying; init-firewall.sh treats a non-zero return as fatal itself.

FIREWALL_DEVCONTAINER_DIR="${FIREWALL_DEVCONTAINER_DIR:-/workspace/.devcontainer}"

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
