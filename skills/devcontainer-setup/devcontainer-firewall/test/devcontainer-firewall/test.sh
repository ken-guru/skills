#!/bin/bash
# Feature-level test, run via:
#   devcontainer features test -f devcontainer-firewall --base-image <image>
#
# Verifies install.sh's own build-time responsibility only (OS packages
# present) -- it cannot verify the firewall actually initializes correctly,
# since that depends on the manifest and scripts under files/ being reached
# through a real workspace bind mount at runtime, which a bare Feature test
# harness against a minimal image doesn't set up. That's what this suite's
# full build-it/boot-it/actually-exercise-it verification bar is for.

set -e

source dev-container-features-test-lib

check "iptables installed" bash -c "command -v iptables"
check "ipset installed" bash -c "command -v ipset"
check "iproute2 installed" bash -c "command -v ip"
check "jq installed" bash -c "command -v jq"
check "dig installed" bash -c "command -v dig"
check "curl installed" bash -c "command -v curl"

reportResults
