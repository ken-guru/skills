#!/bin/bash
# Runs on the HOST, not inside the container -- a devcontainer Feature
# cannot wire this up automatically (initializeCommand is a base
# devcontainer.json property only; no Feature manifest field declares it).
# Add this line yourself to your project's devcontainer.json after
# installing this Feature -- note the workspace folder is passed twice:
# once inside the invoked path (devcontainer.json resolves it before the
# shell ever sees the string) and once as an explicit argument this
# script needs at runtime to scope its docker ps filter:
#
#   "initializeCommand": "nohup bash \"${localWorkspaceFolder}/.devcontainer/devcontainer-dx-niceties/feature/devcontainer-dx-niceties/files/keep-host-awake.sh\" \"${localWorkspaceFolder}\" >/tmp/keep-awake.log 2>&1 &"
#
# Prevents the host machine from sleeping while a container matching this
# project is running -- there is no way to prevent host sleep from inside
# a container, since the host is a different machine (or VM) as far as
# the container's process namespace is concerned.

set -uo pipefail

WORKSPACE_LABEL=${1:?"local workspace folder required (pass \${localWorkspaceFolder})"}
LOCK_FILE="/tmp/devcontainer-dx-niceties-keep-awake.$(basename "$WORKSPACE_LABEL").lock"
POLL_INTERVAL=30
STARTUP_TIMEOUT=300
GRACE_PERIOD=10

# No-op on unsupported hosts: exit cleanly so the same script is safe to
# run in CI or on hosts with nothing to do here.
if ! command -v caffeinate >/dev/null 2>&1; then
    exit 0
fi
if ! command -v docker >/dev/null 2>&1; then
    exit 0
fi

# Guard against duplicate watchers: a lock file holding the watcher's PID,
# checked with a liveness probe, prevents watchers stacking up every
# rebuild or reattach.
if [ -f "$LOCK_FILE" ]; then
    existing_pid=$(cat "$LOCK_FILE" 2>/dev/null)
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
        exit 0
    fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# Scope the watch to this project's containers, matched by the workspace
# folder label container tooling attaches, so multiple devcontainer
# projects running concurrently don't step on each other's wake locks.
container_running() {
    docker ps --filter "label=devcontainer.local_folder=${WORKSPACE_LABEL}" --format '{{.ID}}' 2>/dev/null | grep -q .
}

caffeinate_pid=""
elapsed=0
saw_container=false

while true; do
    if container_running; then
        saw_container=true
        if [ -z "$caffeinate_pid" ] || ! kill -0 "$caffeinate_pid" 2>/dev/null; then
            caffeinate -i &
            caffeinate_pid=$!
        fi
        elapsed=0
    else
        if [ "$saw_container" = true ]; then
            elapsed=$((elapsed + POLL_INTERVAL))
            if [ "$elapsed" -ge "$GRACE_PERIOD" ]; then
                break
            fi
        else
            elapsed=$((elapsed + POLL_INTERVAL))
            if [ "$elapsed" -ge "$STARTUP_TIMEOUT" ]; then
                break
            fi
        fi
    fi
    sleep "$POLL_INTERVAL"
done

[ -n "$caffeinate_pid" ] && kill "$caffeinate_pid" 2>/dev/null
