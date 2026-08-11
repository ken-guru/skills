#!/bin/bash
# Feature-level test, run via:
#   devcontainer features test -f devcontainer-agentic-clis --base-image <node-capable-image>
#
# Verifies install.sh's own build-time responsibility: jq present, the
# npm-prefix/PATH fix landed, and at least one CLI package actually ended
# up on PATH. Cannot verify the MCP-server stage/verify/atomic-swap
# machinery or the firewall-manifest patch in isolation -- both need a
# real multi-Feature container to exercise, which is what this suite's
# full build-it/boot-it/actually-exercise-it verification bar is for.

set -e

source dev-container-features-test-lib

check "jq installed" bash -c "command -v jq"
check "npm-global PATH profile.d script installed" bash -c "[ -f /etc/profile.d/devcontainer-agentic-clis-npm-path.sh ]"
check "claude-code CLI on PATH" bash -c "source /etc/profile.d/devcontainer-agentic-clis-npm-path.sh && command -v claude"

reportResults
