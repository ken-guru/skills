#!/bin/bash
# Library function, not a standalone script -- source this, then call
# ensure_symlink for each link/target pair your own postCreateCommand (or
# a script it calls) needs bridged. This suite doesn't know in advance
# which tools' config directories need bridging for your specific
# combination of installed CLIs, so nothing calls this automatically.
#
# When multiple tools read from conceptually the same content but disagree
# on the path or the persistence contract (one tool's directory gets
# rewiped and reinstalled from a pinned source on every start, favoring
# reproducibility; another's is additive and expected to persist), resolve
# it by designating one location as the source of truth and linking the
# others to it, rather than duplicating the content or forcing every
# consumer onto identical semantics. Only creates a symlink when the
# target doesn't already exist, and errors loudly rather than silently
# overwriting when something unexpected already occupies that path.

ensure_symlink() {
    local link_path=$1 target=$2
    if [ -L "$link_path" ]; then
        [ "$(readlink -f "$link_path")" = "$(readlink -f "$target")" ] && return
        echo "ERROR: $link_path points somewhere unexpected" >&2
        return 1
    fi
    if [ -e "$link_path" ]; then
        echo "WARN: preserving existing $link_path" >&2
        return
    fi
    ln -s "$target" "$link_path"
}
