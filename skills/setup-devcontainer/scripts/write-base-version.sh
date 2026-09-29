#!/bin/bash
set -euo pipefail

# Writes the Base Version Marker (see CONTEXT.md): this skill's own
# metadata.version, into <devcontainer-dir>/.setup-devcontainer-version.
# Runs on every generation (render-devcontainer.sh calls it) and on every
# re-run against an existing container, so the marker always names the
# version that last touched the container.

if [ "$#" -ne 1 ]; then
  echo "Usage: write-base-version.sh <devcontainer-dir>" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(sed -n 's/^  version: "\([0-9][0-9.]*\)" # x-release-please-version$/\1/p' "$SCRIPT_DIR/../SKILL.md")"

if [ -z "$VERSION" ]; then
  echo "write-base-version.sh: no metadata.version in $SCRIPT_DIR/../SKILL.md" >&2
  exit 1
fi

printf '%s\n' "$VERSION" > "$1/.setup-devcontainer-version"
