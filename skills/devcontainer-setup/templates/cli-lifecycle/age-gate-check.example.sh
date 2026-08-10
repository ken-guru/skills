#!/bin/bash
# Skeleton age-gate check for auto-updated developer tooling.
#
# Illustrates the pattern only: fail-safe on uncertainty (an unconfirmed
# release age is treated as an insufficient one), three distinct HELD
# outcomes, and a fallback walk available only to tools whose distribution
# channel supports installing something other than "whatever is currently
# latest." Replace the registry/vendor-specific lookups with real calls
# before use; the fetch_releases_* functions below are stubs.
set -uo pipefail

MANIFEST=${MANIFEST_PATH:-"./tool-manifest.json"}
NOW_EPOCH=$(date +%s)

manifest_value() {
    node -e "const m = require(process.argv[1]); console.log($1)" "$MANIFEST"
}

minimum_age_days() { manifest_value "m.$1.minimumReleaseAgeDays"; }

version_compare() {
    node -e '
      const [a, b] = process.argv.slice(1);
      const pa = a.split(/[.-]/).map((p, i) => i < 3 ? Number(p) : p);
      const pb = b.split(/[.-]/).map((p, i) => i < 3 ? Number(p) : p);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const av = pa[i] ?? 0, bv = pb[i] ?? 0;
        if (av === bv) continue;
        console.log(av > bv ? 1 : -1);
        process.exit();
      }
      console.log(0);
    ' "$1" "$2"
}

# Prints "<version> <epoch-seconds>" lines, newest first, for every release
# this tool's distribution channel can report a timestamp for. A failure here
# (non-zero exit or empty output) means age cannot be confirmed this cycle at
# all, which the caller must treat as "hold," not "assume it's fine."
#
# registry-package tools: query the package registry's full version/time
# history (most registries expose this in a single request alongside "what's
# latest").
fetch_releases_registry_package() {
    local key=$1
    # Replace with a real registry query, e.g.:
    #   registry_view "$(manifest_value "m.$key.package")" versions-and-timestamps
    # emitting "<version> <epoch>\n" lines sorted newest first.
    return 1
}

# pinned-release tools: some vendor distribution channels expose only the
# current latest release (a signed manifest with no historical, per-version
# download endpoint). There is nothing to walk backward through: the only
# question answerable is whether that single known release is old enough.
fetch_current_release_pinned() {
    local key=$1
    # Replace with a real fetch against manifest.<key>.releaseManifest,
    # emitting "<version> <epoch>" for the current release only.
    return 1
}

# Decide what this cycle should do. Prints one of:
#   TARGET <version> <epoch>          an age-eligible install target exists
#   HELD_TOO_YOUNG <version> <epoch>  newest known candidate isn't old enough
#   HELD_NO_WINDOW                    release data exists, nothing qualifies
#   (nothing, exit 1)                 release age could not be determined
determine_age_gated_target() {
    local key=$1 installer=$2 true_latest=$3 installed=$4 min_age
    min_age=$(minimum_age_days "$key")

    if [ "$installer" = pinned-release ]; then
        local line epoch age
        line=$(fetch_current_release_pinned "$key") || return 1
        [ -n "$line" ] || return 1
        epoch=$(awk -v v="$true_latest" '$1 == v { print $2; exit }' <<<"$line")
        [ -n "$epoch" ] || { echo "HELD_NO_WINDOW"; return 0; }
        age=$(( (NOW_EPOCH - epoch) / 86400 ))
        if [ "$age" -ge "$min_age" ]; then
            echo "TARGET $true_latest $epoch"
        else
            echo "HELD_TOO_YOUNG $true_latest $epoch"
        fi
        return 0
    fi

    # registry-package tools can walk backward past the true latest to an
    # older-but-still-newer release, bounded above by the independently
    # confirmed true latest so a stale secondary source can never win.
    local releases newest="" newest_epoch="" version epoch age
    releases=$(fetch_releases_registry_package "$key") || return 1
    [ -n "$releases" ] || return 1
    while read -r version epoch; do
        [ -n "$version" ] || continue
        [ "$(version_compare "$version" "$installed")" -gt 0 ] || continue
        [ "$(version_compare "$version" "$true_latest")" -le 0 ] || continue
        if [ -z "$newest" ]; then
            newest=$version
            newest_epoch=$epoch
        fi
        age=$(( (NOW_EPOCH - epoch) / 86400 ))
        [ "$age" -ge "$min_age" ] || continue
        echo "TARGET $version $epoch"
        return 0
    done <<<"$releases"

    if [ -n "$newest" ]; then
        echo "HELD_TOO_YOUNG $newest $newest_epoch"
    else
        echo "HELD_NO_WINDOW"
    fi
}

# Example driver for one tool. In a real script this loops over every
# manifest entry, but the fail-safe branch is the part to preserve exactly:
# a lookup failure (non-zero from determine_age_gated_target) HELDs, it never
# falls through to installing anyway.
check_one_tool() {
    local key=$1 installer=$2 true_latest=$3 installed=$4 decision

    if ! decision=$(determine_age_gated_target "$key" "$installer" "$true_latest" "$installed"); then
        echo "HELD $key $installed (age-gated; release age unconfirmed)"
        return
    fi

    case "$decision" in
        TARGET\ *)
            local target
            target=$(awk '{print $2}' <<<"$decision")
            echo "TARGET $key $target"
            ;;
        HELD_TOO_YOUNG\ *)
            local candidate epoch age
            candidate=$(awk '{print $2}' <<<"$decision")
            epoch=$(awk '{print $3}' <<<"$decision")
            age=$(( (NOW_EPOCH - epoch) / 86400 ))
            echo "HELD $key $installed < $candidate (age-gated; released ${age}d ago, needs $(minimum_age_days "$key")d)"
            ;;
        HELD_NO_WINDOW)
            echo "HELD $key $installed (age-gated; no eligible release in window)"
            ;;
    esac
}

# check_one_tool "<tool-a-key>" registry-package "<discovered-true-latest>" "<currently-installed-version>"
