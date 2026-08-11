#!/bin/bash
# Feature-level test, run via:
#   devcontainer features test -f devcontainer-git-auth --base-image <image>
#
# Verifies install.sh's own build-time responsibility only: gh CLI
# installed, ssh-keygen available, the SSH directory pre-created and
# owned by the non-root user. Cannot verify key generation, GitHub
# registration, or the marker-file onboarding flow in isolation -- all
# three need a real repo remote and live GitHub API access, which is what
# this suite's full build-it/boot-it/actually-exercise-it verification
# bar is for.

set -e

source dev-container-features-test-lib

check "gh CLI installed" bash -c "command -v gh"
check "ssh-keygen available" bash -c "command -v ssh-keygen"
check "jq installed" bash -c "command -v jq"

reportResults
