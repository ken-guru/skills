#!/bin/bash
# devcontainer-dx-niceties Feature install script. Runs as root during
# `docker build`. Installs jq (statusline.sh's own JSON parsing) and wires
# the statusline into the non-root user's interactive shell -- the one
# piece of this Skill that's genuinely install-and-forget. Everything else
# this Skill ships (ensure-symlink.sh, keep-host-awake.sh, the healthcheck
# and auth-dotfile compose snippets documented in SKILL.md) needs a manual
# step this script can't perform, since it either has no fixed paths to
# act on (symlink bridging) or lives outside what a Feature can touch at
# all (host-side initializeCommand, compose-file service definitions).

set -euo pipefail

apt-get update
apt-get install -y --no-install-recommends jq
rm -rf /var/lib/apt/lists/*

USER_HOME="${_REMOTE_USER_HOME:-$HOME}"
USER_NAME="${_REMOTE_USER:-$(id -un)}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
STATUSLINE_PATH="$SCRIPT_DIR/files/statusline.sh"

# Interactive, non-login shells only (a plain `docker exec -it ... bash`,
# the common case for attaching to a running devcontainer) -- .bashrc is
# not sourced for login shells or non-interactive ones. Documented as a
# known scope limitation in this Skill's SKILL.md rather than solved here,
# the same way the Debian-login-shell-PATH-reset gotcha elsewhere in this
# suite is a known, documented limitation of ENV PATH rather than
# something every Feature re-solves.
BASHRC="$USER_HOME/.bashrc"
touch "$BASHRC"
MARKER="# devcontainer-dx-niceties statusline"
if ! grep -qF "$MARKER" "$BASHRC" 2>/dev/null; then
    {
        echo ""
        echo "$MARKER"
        # Single-quoted: '$(...)' and '$PS1' must stay LITERAL in the
        # exported value, not get expanded once when this export line
        # itself runs. Bash re-expands PS1 fresh before every prompt, so
        # this is what makes the statusline actually update per-prompt
        # rather than freezing at whatever it was when .bashrc loaded.
        printf 'export PS1='"'"'$(bash "%s" 2>/dev/null) $PS1'"'"'\n' "$STATUSLINE_PATH"
    } >> "$BASHRC"
fi
chown "$USER_NAME" "$BASHRC" 2>/dev/null || true
