#!/bin/bash
# Feature-level test, run via:
#   devcontainer features test -f devcontainer-cli-lifecycle --base-image <node-capable-image>
#
# Verifies install.sh's own build-time precondition check only. The
# age-gating logic itself (fail-safe-on-uncertainty, the three HELD
# outcomes, self-updating drift detection, the MCP-server hand-off to
# devcontainer-agentic-clis) needs real manifests and a real multi-Feature
# container to exercise -- that's what this suite's full
# build-it/boot-it/actually-exercise-it verification bar is for, not a
# bare Feature test against a minimal image.

set -e

source dev-container-features-test-lib

check "node installed" bash -c "command -v node"

reportResults
