#!/bin/bash
# Runtime age-gate check, part of the devcontainer-cli-lifecycle Feature.
# Invoked by this Feature's postStartCommand every container start (wrapped
# in `timeout`, per startupUpdate.timeoutSeconds in tool-manifest.json).
#
# Two tool kinds, two manifests, two update mechanisms -- narrowest-owner
# principle applied to age-gating itself:
#   - CLI binaries: this Feature's OWN tool-manifest.json. An age-eligible
#     update is applied with a plain `npm install -g <package>@<target>`,
#     verified by `<binary> --version` afterward. No staging: a CLI binary
#     has no MCP handshake to verify, and npm's own per-package install
#     already has reasonable internal atomicity -- a failed update is a
#     rare, visible failure, not a routine risk worth a second staging
#     mechanism for.
#   - MCP servers: devcontainer-agentic-clis' own mcp-servers.manifest.json,
#     read directly (its minimumReleaseAgeDays field is exactly what this
#     script needs -- no separate copy kept here to drift out of sync with
#     it). An age-eligible update is applied by calling THAT Skill's own
#     staged-install-handshake-atomic-swap.sh, reusing its MCP-protocol
#     handshake verification rather than reimplementing it here.
#
# Retrofit Contract: if devcontainer-agentic-clis isn't installed, there's
# no MCP-server manifest to read -- detect that and skip MCP-server
# age-gating entirely, not as an error. CLI-binary age-gating still runs
# regardless, since this Feature owns that manifest itself.
#
# Fail-safe on uncertainty throughout: a release whose age can't be
# determined is treated identically to "too young" -- hold, never install.
# Absence of proof of age must be treated as insufficient age, never as a
# pass, or the whole mitigation degrades to decoration.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TOOL_MANIFEST=${TOOL_MANIFEST_PATH:-"$SCRIPT_DIR/tool-manifest.json"}
WORKSPACE_FOLDER=${1:-}
MCP_MANIFEST="$WORKSPACE_FOLDER/.devcontainer/devcontainer-agentic-clis/feature/devcontainer-agentic-clis/files/mcp-servers.manifest.json"
MCP_UPDATE_SCRIPT="$WORKSPACE_FOLDER/.devcontainer/devcontainer-agentic-clis/feature/devcontainer-agentic-clis/files/staged-install-handshake-atomic-swap.sh"
NOW_EPOCH=$(date +%s)

manifest_value() {
    local manifest=$1 expr=$2
    node -e "const m = require(process.argv[1]); const v = ($expr); if (v === undefined) process.exitCode = 1; else console.log(v)" \
        "$manifest" 2>/dev/null
}

# Newline-separated keys, one per line, never a stringified JS array --
# avoids parsing "[a, b]" text output with shell string tools.
manifest_keys() {
    local manifest=$1 expr=$2
    node -e "const m = require(process.argv[1]); ($expr).forEach(k => console.log(k))" \
        "$manifest" 2>/dev/null
}

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
# this tool's distribution channel can report a timestamp for. A failure
# here (non-zero exit or empty output) means age cannot be confirmed this
# cycle at all, which the caller must treat as "hold," not "assume fine."
#
# registry-package tools (CLI binaries installed from npm, or MCP servers
# from devcontainer-agentic-clis' manifest): query the registry's full
# version/time history. A real, actively-released package's full history
# can exceed the OS's ARG_MAX limit on execve() argument size -- route the
# response through a pipe or temp file into whatever parses it, NEVER
# through argv (`jq --argjson`, `jq --arg`, or an inline script's own
# arguments all count). Get this wrong and the failure is "Argument list
# too long," which reads like a shell bug, not a size problem, and it only
# starts happening once the TARGET package's own release cadence picks up,
# with zero code changes on this side.
fetch_releases_registry_package() {
    local package=$1
    # Replace with a real registry query piped into whatever parses it,
    # e.g.: npm view "$package" time --json | node -e '...' , emitting
    # "<version> <epoch>\n" lines sorted newest first. Keep the response on
    # a pipe or in a temp file end to end.
    return 1
}

# pinned-release tools: some vendor distribution channels expose only the
# current latest release (a signed manifest with no historical, per-version
# download endpoint). There is nothing to walk backward through: the only
# question answerable is whether that single known release is old enough.
fetch_current_release_pinned() {
    local release_manifest_url=$1
    # Replace with a real fetch against the URL, emitting
    # "<version> <epoch>" for the current release only.
    return 1
}

# Decide what this cycle should do for one entry. Prints one of:
#   TARGET <version> <epoch>          an age-eligible install target exists
#   HELD_TOO_YOUNG <version> <epoch>  newest known candidate isn't old enough
#   HELD_NO_WINDOW                    release data exists, nothing qualifies
#   (nothing, exit 1)                 release age could not be determined
determine_age_gated_target() {
    local installer=$1 min_age=$2 true_latest=$3 installed=$4 package_or_url=$5

    if [ "$installer" = pinned-release ]; then
        local line epoch age
        line=$(fetch_current_release_pinned "$package_or_url") || return 1
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

    # registry-package: walk backward past the true latest to an
    # older-but-still-newer release, bounded above by the independently
    # confirmed true latest so a stale secondary source can never win.
    local releases newest="" newest_epoch="" version epoch age
    releases=$(fetch_releases_registry_package "$package_or_url") || return 1
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

# self-updating tools: there is no update decision to gate, so this is NOT
# another branch of determine_age_gated_target. The job changes from
# "decide when to update" to "detect that the tool already updated itself
# outside this container's control, and say so."
check_self_updating() {
    local key=$1 binary=$2 baseline installed_version
    baseline=$(manifest_value "$TOOL_MANIFEST" "m['$key'].baselineVersion")
    installed_version=$("$binary" --version 2>/dev/null) || {
        echo "WARN $key: could not read installed version from '$binary --version'"
        return
    }
    if [ "$installed_version" != "$baseline" ]; then
        echo "DRIFT $key: baseline $baseline, now $installed_version (self-updated outside this container's control)"
    else
        echo "OK $key: matches recorded baseline $baseline"
    fi
}

# --- CLI binaries: this Feature's own tool-manifest.json -------------------

check_cli_binaries() {
    [ -f "$TOOL_MANIFEST" ] || {
        echo "No tool-manifest.json found -- copy tool-manifest.example.json to enable CLI-binary age-gating." >&2
        return
    }

    local key installer binary min_age package version installed decision
    while read -r key; do
        installer=$(manifest_value "$TOOL_MANIFEST" "m['$key'].installer")
        binary=$(manifest_value "$TOOL_MANIFEST" "m['$key'].binary")

        if [ "$installer" = self-updating ]; then
            check_self_updating "$key" "$binary"
            continue
        fi

        min_age=$(manifest_value "$TOOL_MANIFEST" "m['$key'].minimumReleaseAgeDays")
        package=$(manifest_value "$TOOL_MANIFEST" "m['$key'].package")
        installed=$("$binary" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        installed=${installed:-0.0.0}
        # TODO: replace with a real "true latest" lookup against the
        # registry/vendor for this tool -- determine_age_gated_target bounds
        # its walk-back above this value so a stale secondary source can
        # never report something newer than what's actually current.
        true_latest=$installed

        if ! decision=$(determine_age_gated_target "$installer" "$min_age" "$true_latest" "$installed" "$package"); then
            echo "HELD $key $installed (age-gated; release age unconfirmed)"
            continue
        fi

        case "$decision" in
            TARGET\ *)
                local target
                target=$(awk '{print $2}' <<<"$decision")
                echo "Updating $key: $installed -> $target"
                if npm install -g "$package@$target" && [ "$("$binary" --version 2>/dev/null)" != "" ]; then
                    echo "TARGET $key $target (updated)"
                else
                    echo "WARN $key: update to $target failed or did not verify; previous install may be in an inconsistent state -- rebuild to restore the reviewed baseline"
                fi
                ;;
            HELD_TOO_YOUNG\ *)
                local candidate epoch age
                candidate=$(awk '{print $2}' <<<"$decision")
                epoch=$(awk '{print $3}' <<<"$decision")
                age=$(( (NOW_EPOCH - epoch) / 86400 ))
                echo "HELD $key $installed < $candidate (age-gated; released ${age}d ago, needs ${min_age}d)"
                ;;
            HELD_NO_WINDOW)
                echo "HELD $key $installed (age-gated; no eligible release in window)"
                ;;
        esac
    done < <(manifest_keys "$TOOL_MANIFEST" 'Object.keys(m).filter(k => k !== "_comment" && k !== "startupUpdate")')
}

# --- MCP servers: devcontainer-agentic-clis' own manifest, read directly ---

check_mcp_servers() {
    [ -f "$MCP_MANIFEST" ] || {
        echo "devcontainer-agentic-clis not installed (no manifest at $MCP_MANIFEST) -- skipping MCP-server age-gating."
        return
    }

    local key min_age package version installed decision
    while read -r key; do
        min_age=$(manifest_value "$MCP_MANIFEST" "m.servers['$key'].minimumReleaseAgeDays")
        package=$(manifest_value "$MCP_MANIFEST" "m.servers['$key'].package")
        installed=$(manifest_value "$MCP_MANIFEST" "m.servers['$key'].version")
        true_latest=$installed  # TODO: real "true latest" lookup, as above.

        if ! decision=$(determine_age_gated_target "registry-package" "$min_age" "$true_latest" "$installed" "$package"); then
            echo "HELD $key $installed (age-gated; release age unconfirmed)"
            continue
        fi

        case "$decision" in
            TARGET\ *)
                local target
                target=$(awk '{print $2}' <<<"$decision")
                echo "Updating MCP server $key: $installed -> $target"
                bash "$MCP_UPDATE_SCRIPT" update "$key" "$target"
                ;;
            HELD_TOO_YOUNG\ *)
                echo "HELD $key (age-gated; too young)"
                ;;
            HELD_NO_WINDOW)
                echo "HELD $key (age-gated; no eligible release in window)"
                ;;
        esac
    done < <(manifest_keys "$MCP_MANIFEST" 'Object.keys(m.servers)')
}

check_cli_binaries
check_mcp_servers
