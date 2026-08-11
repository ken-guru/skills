#!/bin/bash
# devcontainer-cli-lifecycle Feature install script. Runs as root during
# `docker build`. This Skill's actual work (the age-gate check) is a
# runtime, postStartCommand concern -- install.sh only confirms the
# precondition its runtime script needs.

set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: node not found. devcontainer-cli-lifecycle's age-gate check needs Node.js already present on the base image; add it via devcontainer-scaffold's own build-time package-install step before installing this Feature." >&2
    exit 1
fi
