#!/usr/bin/env bash
# Suite-level verification entrypoint.
#
# --static is deterministic and runs without Docker. It validates the
# source-level contracts that must be true before an image is built.
# --runtime is deliberately strict: it requires the devcontainer CLI and a
# prepared workspace, and reports BLOCKED when either external prerequisite
# is unavailable.

set -uo pipefail

SUITE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPO_ROOT=$(cd "$SUITE_ROOT/../.." && pwd)
MODE=static
EVIDENCE_DIR=${DEVCONTAINER_VERIFICATION_EVIDENCE_DIR:-"$(mktemp -d "${TMPDIR:-/tmp}/devcontainer-setup-verification.XXXXXX")"}
RESULTS_FILE="$EVIDENCE_DIR/results.jsonl"
SUMMARY_FILE="$EVIDENCE_DIR/summary.txt"
FAILURES=0
BLOCKED=0

usage() {
    cat <<'USAGE'
Usage: verification/verify.sh [--static|--runtime] [--evidence-dir DIR]

  --static             Validate source contracts, shell/JSON syntax, and
                       the ownership/security invariants without Docker.
  --runtime            Require the devcontainer CLI and report the external
                       prerequisite status before running container lanes.
  --evidence-dir DIR  Write results.jsonl, summary.txt, and metadata.json
                       to DIR. Defaults to a disposable temporary directory.
USAGE
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --static) MODE=static ;;
        --runtime) MODE=runtime ;;
        --evidence-dir)
            shift
            EVIDENCE_DIR=${1:?--evidence-dir requires a directory}
            ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
    shift
done

mkdir -p "$EVIDENCE_DIR"
: > "$RESULTS_FILE"
: > "$SUMMARY_FILE"

json_result() {
    local name=$1 status=$2 detail=$3
    jq -cn --arg name "$name" --arg status "$status" --arg detail "$detail" \
        '{name: $name, status: $status, detail: $detail}' >> "$RESULTS_FILE"
    printf '%-7s %s — %s\n' "$status" "$name" "$detail" >> "$SUMMARY_FILE"
}

pass() { json_result "$1" PASS "$2"; }
fail() { json_result "$1" FAIL "$2"; FAILURES=$((FAILURES + 1)); }
blocked() { json_result "$1" BLOCKED "$2"; BLOCKED=$((BLOCKED + 1)); }

check_file() {
    local name=$1 path=$2
    if [ -f "$path" ]; then pass "$name" "$path exists"; else fail "$name" "$path is missing"; fi
}

check_contains() {
    local name=$1 needle=$2 path=$3
    if grep -qF -- "$needle" "$path"; then pass "$name" "found required contract"; else fail "$name" "missing '$needle' in $path"; fi
}

check_absent() {
    local name=$1 needle=$2 path=$3
    if ! grep -qF -- "$needle" "$path"; then pass "$name" "forbidden contract absent"; else fail "$name" "found forbidden '$needle' in $path"; fi
}

write_metadata() {
    jq -n \
        --arg mode "$MODE" \
        --arg suite_root "$SUITE_ROOT" \
        --arg repo_root "$REPO_ROOT" \
        --arg host "$(hostname)" \
        --arg os "$(uname -srm)" \
        --arg shell "${BASH_VERSION:-unknown}" \
        '{mode: $mode, suiteRoot: $suite_root, repoRoot: $repo_root, host: $host, os: $os, bash: $shell}' \
        > "$EVIDENCE_DIR/metadata.json"
}

run_static() {
    local scaffold="$SUITE_ROOT/devcontainer-scaffold/templates/Dockerfile.skeleton"
    local firewall_install="$SUITE_ROOT/devcontainer-firewall/feature/devcontainer-firewall/install.sh"
    local firewall_init="$SUITE_ROOT/devcontainer-firewall/feature/devcontainer-firewall/files/init-firewall.sh"
    local agentic_install="$SUITE_ROOT/devcontainer-agentic-clis/feature/devcontainer-agentic-clis/install.sh"
    local agentic_feature="$SUITE_ROOT/devcontainer-agentic-clis/feature/devcontainer-agentic-clis/devcontainer-feature.json"
    local dx_install="$SUITE_ROOT/devcontainer-dx-niceties/feature/devcontainer-dx-niceties/install.sh"
    local dx_feature="$SUITE_ROOT/devcontainer-dx-niceties/feature/devcontainer-dx-niceties/devcontainer-feature.json"
    local git_feature="$SUITE_ROOT/devcontainer-git-auth/feature/devcontainer-git-auth/devcontainer-feature.json"

    check_file scaffold-ownership-template "$scaffold"
    check_file firewall-install-script "$firewall_install"
    check_file firewall-init-script "$firewall_init"
    check_file agentic-install-script "$agentic_install"
    check_file dx-install-script "$dx_install"

    check_contains scaffold-npm-global-path "/home/\$USERNAME/.npm-global" "$scaffold"
    check_contains scaffold-ssh-path "/home/\$USERNAME/.ssh" "$scaffold"
    check_contains scaffold-commandhistory-path '/commandhistory' "$scaffold"

    check_contains firewall-installs-iproute2 'iproute2' "$firewall_install"
    check_absent firewall-preserves-docker-nat 'iptables -t nat -F' "$firewall_init"
    check_absent firewall-preserves-docker-nat-chain-delete 'iptables -t nat -X' "$firewall_init"

    check_contains agentic-installs-as-runtime-user "su - \"\$USER_NAME\"" "$agentic_install"
    check_contains agentic-global-prefix-owned-by-runtime-user "chown -R \"\$USER_NAME:\$USER_NAME\"" "$agentic_install"
    check_contains mcp-install-root-is-explicit 'MCP_INSTALL_ROOT=' "$agentic_install"
    check_contains dx-statusline-is-persistent '/usr/local/bin/statusline.sh' "$dx_install"
    check_contains git-auth-volume-follows-runtime-user 'target=${_REMOTE_USER_HOME}/.ssh' "$git_feature"

    if jq -e . "$agentic_feature" >/dev/null 2>&1 && jq -e . "$dx_feature" >/dev/null 2>&1 && jq -e . "$git_feature" >/dev/null 2>&1; then
        pass feature-manifests-are-valid-json 'modified Feature manifests parse as JSON'
    else
        fail feature-manifests-are-valid-json 'a modified Feature manifest is invalid JSON'
    fi

    local script
    while IFS= read -r script; do
        if bash -n "$script"; then pass "bash-syntax-$(basename "$script")" "$script parses"; else fail "bash-syntax-$(basename "$script")" "$script does not parse"; fi
    done < <(find "$SUITE_ROOT" -path '*/feature/*/files/*.sh' -o -path '*/feature/*/install.sh' | sort)

    local module
    while IFS= read -r module; do
        if node --check "$module" >/dev/null 2>&1; then pass "node-syntax-$(basename "$module")" "$module parses"; else fail "node-syntax-$(basename "$module")" "$module does not parse"; fi
    done < <(find "$SUITE_ROOT" -name '*.mjs' -type f | sort)
}

run_runtime() {
    if ! command -v devcontainer >/dev/null 2>&1; then
        blocked runtime-devcontainer-cli 'devcontainer CLI is unavailable; install it before running container lanes'
        return 2
    fi
    if ! command -v docker >/dev/null 2>&1; then
        blocked runtime-docker 'Docker is unavailable; start a supported container runtime before running container lanes'
        return 2
    fi
    pass runtime-prerequisites 'devcontainer CLI and Docker are available'
    if [ -z "${DEVCONTAINER_VERIFICATION_WORKSPACE:-}" ]; then
        blocked runtime-workspace 'set DEVCONTAINER_VERIFICATION_WORKSPACE to a prepared Target Devcontainer project'
        return 2
    fi
    if [ ! -d "$DEVCONTAINER_VERIFICATION_WORKSPACE" ]; then
        blocked runtime-workspace 'DEVCONTAINER_VERIFICATION_WORKSPACE is not a directory'
        return 2
    fi
    local lane=${DEVCONTAINER_VERIFICATION_LANE:-combined}
    if bash "$SUITE_ROOT/verification/run-container-lane.sh" \
        --workspace-folder "$DEVCONTAINER_VERIFICATION_WORKSPACE" \
        --lane "$lane" --evidence-dir "$EVIDENCE_DIR"; then
        pass runtime-container-lane "container lane passed: $lane"
        return 0
    fi
    fail runtime-container-lane "container lane failed or was unavailable; inspect $EVIDENCE_DIR"
    return 1
}

write_metadata
if [ "$MODE" = runtime ]; then run_runtime || true; else run_static; fi

if [ "$FAILURES" -gt 0 ]; then
    printf '\nVerification failed: %d check(s) failed. Evidence: %s\n' "$FAILURES" "$EVIDENCE_DIR" >&2
    exit 1
fi
if [ "$BLOCKED" -gt 0 ]; then
    printf '\nVerification blocked: %d check(s) require external prerequisites or a live lane. Evidence: %s\n' "$BLOCKED" "$EVIDENCE_DIR" >&2
    exit 2
fi
printf '\nVerification passed. Evidence: %s\n' "$EVIDENCE_DIR"
