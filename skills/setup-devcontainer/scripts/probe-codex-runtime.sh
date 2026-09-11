#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: probe-codex-runtime.sh --image <image> --profile <profile>" >&2
}

IMAGE=""
PROFILE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 64 ;;
  esac
done

[ -n "$IMAGE" ] && [ -n "$PROFILE" ] || { usage; exit 64; }
[ -f "$PROFILE" ] || { echo "No profile: $PROFILE" >&2; exit 1; }

# This is deliberately a disposable prerequisite probe, not a Codex prompt
# test. The exact image used for the Shared Container must contain Bubblewrap
# for the namespace check to be meaningful.
exec docker run --rm \
  --security-opt "seccomp=$PROFILE" \
  "$IMAGE" \
  sh -lc 'command -v bwrap >/dev/null || { echo "bwrap is not installed in this image" >&2; exit 2; }; bwrap --ro-bind / / true'
