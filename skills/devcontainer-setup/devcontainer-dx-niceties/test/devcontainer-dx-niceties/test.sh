#!/bin/bash
# Feature-level test, run via:
#   devcontainer features test -f devcontainer-dx-niceties --base-image <image>
#
# Verifies install.sh's own build-time responsibility: jq installed, the
# statusline wired into .bashrc with the re-evaluating (not frozen) PS1
# form. Cannot verify the statusline's actual git/gh output, symlink
# bridging (project-specific, no fixed paths), or the three manually-wired
# patterns (host-sleep prevention, database healthcheck, auth-dotfile
# mount) in isolation -- see this Skill's SKILL.md for how each of those
# gets verified for real.

set -e

source dev-container-features-test-lib

BASHRC="${_REMOTE_USER_HOME:-$HOME}/.bashrc"

check "jq installed" bash -c "command -v jq"
check "statusline wired into .bashrc" bash -c "grep -qF 'devcontainer-dx-niceties statusline' '$BASHRC'"
# Fixed-string match on the literal, single-quoted PS1 assignment --
# confirms the command substitution was NOT expanded at write time (which
# would freeze the statusline forever instead of updating it per-prompt).
check "PS1 uses re-evaluating single-quoted form, not frozen" bash -c "grep -qF \"export PS1='\\\$(bash\" '$BASHRC'"

reportResults
