#!/bin/bash
# Prints one line: repo, branch, open-PR status, and uncommitted-work
# count -- the questions a developer re-asks dozens of times a session.
# Works two ways:
#   - No stdin (or non-JSON stdin): reads $PWD, for a plain PS1 hook.
#   - JSON on stdin with a "cwd" field: an agentic CLI's own statusline
#     hook convention (Claude Code's statusLine command, for instance)
#     invokes scripts this way, passing the CLI's own idea of the current
#     directory rather than relying on the shell's.
#
# Uses jq for the JSON parsing, deliberately, even in this hot-path,
# frequently-invoked script -- a statusline script reaching for a sed/grep
# one-liner instead of the JSON tool used everywhere else in this suite is
# a real, previously-observed pattern, and worth a one-line comment either
# way if you change it, rather than leaving a future maintainer to
# re-derive the reasoning from the code alone.

DIR="$PWD"
if [ ! -t 0 ]; then
    input=$(cat)
    if parsed=$(echo "$input" | jq -r '.cwd // empty' 2>/dev/null) && [ -n "$parsed" ]; then
        DIR=$parsed
    fi
fi

cd "$DIR" 2>/dev/null || { echo "?"; exit 0; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "(not a git repo)"
    exit 0
fi

repo=$(basename "$(git rev-parse --show-toplevel)")
branch=$(git branch --show-current 2>/dev/null || echo "detached")

dirty_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
dirty=""
[ "$dirty_count" -gt 0 ] && dirty=" *${dirty_count}"

pr=""
if command -v gh >/dev/null 2>&1; then
    pr_number=$(gh pr view --json number --jq '.number' 2>/dev/null)
    [ -n "$pr_number" ] && pr=" #${pr_number}"
fi

echo "${repo} (${branch}${pr}${dirty})"
