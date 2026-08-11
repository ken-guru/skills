#!/bin/bash
# Entry point this Feature's postStartCommand invokes. Runs the firewall
# init script every container start (idempotent by construction -- see
# init-firewall.sh's own reset-to-permissive-first step), then launches the
# background refresh loop only if you've opted in.
#
# The refresh loop is off by default, matching NETWORK-FIREWALL.md's own
# guidance: skip it entirely, and the two-file domain-list drift risk it
# carries, unless you actually have a domain behind a rotating-IP CDN. To
# enable it, create an empty marker file next to this one:
#   touch "$(dirname "${BASH_SOURCE[0]}")/.enable-refresh-loop"
# This is a plain project-source file, not a Feature install-time option --
# a Feature's install-time options are only visible to install.sh at build
# time, and this decision needs to be readable by a script that runs at
# container start, every start, long after the build finished.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

bash "$SCRIPT_DIR/init-firewall.sh"

if [ -f "$SCRIPT_DIR/.enable-refresh-loop" ]; then
    echo "Refresh loop enabled (.enable-refresh-loop present) -- launching in background."
    bash "$SCRIPT_DIR/refresh-allowlist.sh" &
else
    echo "Refresh loop disabled (no .enable-refresh-loop marker) -- skipping."
fi
