#!/usr/bin/env bash
# Execute one container-side verification lane against a prepared Target
# Devcontainer project. Fixture creation stays outside this runner so the
# same checks can exercise scaffolded and separately authored targets.

set -uo pipefail

LANE=combined
WORKSPACE_FOLDER=
EVIDENCE_DIR=${DEVCONTAINER_VERIFICATION_EVIDENCE_DIR:-"$(mktemp -d "${TMPDIR:-/tmp}/devcontainer-setup-lane.XXXXXX")"}
KEEP=false
FAILURES=0
RESULTS_FILE="$EVIDENCE_DIR/results.jsonl"
SUMMARY_FILE="$EVIDENCE_DIR/summary.txt"

usage() {
    cat <<'USAGE'
Usage: verification/run-container-lane.sh --workspace-folder DIR
       [--lane clean|focused|combined|reattach]
       [--evidence-dir DIR] [--keep]

The target project must already contain the desired Feature composition.
The runner owns lifecycle commands, container-side assertions, evidence,
and cleanup; it never creates credentials or mutates a remote repository.
USAGE
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --workspace-folder) shift; WORKSPACE_FOLDER=${1:?--workspace-folder requires a directory} ;;
        --lane) shift; LANE=${1:?--lane requires a value} ;;
        --evidence-dir) shift; EVIDENCE_DIR=${1:?--evidence-dir requires a directory} ;;
        --keep) KEEP=true ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
    shift
done

if [ -z "$WORKSPACE_FOLDER" ] || [ ! -d "$WORKSPACE_FOLDER" ]; then
    echo "A prepared Target Devcontainer workspace is required." >&2
    exit 2
fi
case "$LANE" in clean|focused|combined|reattach) ;; *) echo "Unknown lane: $LANE" >&2; exit 2 ;; esac
if ! command -v devcontainer >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1; then
    echo "The container lane requires both devcontainer and docker on PATH." >&2
    exit 2
fi

mkdir -p "$EVIDENCE_DIR"
: > "$RESULTS_FILE"
: > "$SUMMARY_FILE"

record() {
    local name=$1 status=$2 detail=$3
    jq -cn --arg name "$name" --arg status "$status" --arg detail "$detail" \
        '{name: $name, status: $status, detail: $detail}' >> "$RESULTS_FILE"
    printf '%-7s %s — %s\n' "$status" "$name" "$detail" >> "$SUMMARY_FILE"
    [ "$status" = PASS ] || FAILURES=$((FAILURES + 1))
}

run_logged() {
    local name=$1; shift
    local log="$EVIDENCE_DIR/$name.log"
    if "$@" >"$log" 2>&1; then
        record "$name" PASS "$(tail -1 "$log" 2>/dev/null || true)"
        return 0
    fi
    record "$name" FAIL "command failed; see $log"
    return 1
}

exec_check() {
    local name=$1 command=$2
    run_logged "$name" devcontainer exec --workspace-folder "$WORKSPACE_FOLDER" bash -lc "$command"
}

cleanup() {
    if [ "$KEEP" = false ]; then
        devcontainer down --workspace-folder "$WORKSPACE_FOLDER" >"$EVIDENCE_DIR/cleanup.log" 2>&1 || true
    fi
}
trap cleanup EXIT

run_logged container-up devcontainer up --workspace-folder "$WORKSPACE_FOLDER" --remove-existing-container || exit 1
exec_check runtime-is-non-root '[ "$(id -u)" -ne 0 ]'
exec_check home-volume-paths 'for path in "$HOME/.your-tool" "$HOME/.ssh" "$HOME/.npm-global" /commandhistory; do test -d "$path" || exit 1; done'
exec_check home-volume-ownership 'for path in "$HOME/.your-tool" "$HOME/.ssh" "$HOME/.npm-global" /commandhistory; do test "$(stat -c %U "$path")" = "$(id -un)" || exit 1; done'
exec_check login-shell-ownership 'bash -lc '\''for path in "$HOME/.ssh" "$HOME/.npm-global" /commandhistory; do test "$(stat -c %U "$path")" = "$(id -un)" || exit 1; done'\'''
exec_check non-login-shell-ownership 'bash -c '\''for path in "$HOME/.ssh" "$HOME/.npm-global" /commandhistory; do test "$(stat -c %U "$path")" = "$(id -un)" || exit 1; done'\'''
exec_check persistent-statusline 'test -x /usr/local/bin/statusline.sh'
exec_check no-duplicate-background-workers 'test "$(pgrep -fc refresh-allowlist.sh || true)" -le 1'
exec_check capabilities-snapshot 'grep -E "^(Cap(Inh|Prm|Eff|Bnd|Amb)|NoNewPrivs):" /proc/self/status'
exec_check process-snapshot 'ps -eo pid,user,comm,args'

if [ -n "${DEVCONTAINER_VERIFICATION_ALLOWED_URL:-}" ] && [ -n "${DEVCONTAINER_VERIFICATION_BLOCKED_URL:-}" ]; then
    exec_check allowed-network "curl --fail --silent --show-error --connect-timeout 5 '$DEVCONTAINER_VERIFICATION_ALLOWED_URL' >/dev/null"
    if exec_check blocked-network "! curl --silent --show-error --connect-timeout 5 '$DEVCONTAINER_VERIFICATION_BLOCKED_URL' >/dev/null"; then
        :
    fi
fi

if [ "$LANE" = reattach ]; then
    run_logged container-reattach devcontainer up --workspace-folder "$WORKSPACE_FOLDER" || true
    exec_check reattach-still-non-root '[ "$(id -u)" -ne 0 ]'
    exec_check reattach-still-owned 'test "$(stat -c %U "$HOME/.ssh")" = "$(id -un)"'
fi

jq -n --arg lane "$LANE" --arg workspace "$WORKSPACE_FOLDER" --arg host "$(hostname)" \
    --arg os "$(uname -srm)" '{lane: $lane, workspace: $workspace, host: $host, os: $os}' \
    > "$EVIDENCE_DIR/metadata.json"

if [ "$FAILURES" -gt 0 ]; then
    printf '\nContainer lane failed: %d check(s). Evidence: %s\n' "$FAILURES" "$EVIDENCE_DIR" >&2
    exit 1
fi
printf '\nContainer lane passed: %s. Evidence: %s\n' "$LANE" "$EVIDENCE_DIR"
