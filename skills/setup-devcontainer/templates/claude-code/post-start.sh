#!/bin/bash
set -euo pipefail
# Runs on every container start (not just create/rebuild). Two unrelated
# jobs share this one script/hook, same as this skill's other concatenated
# lifecycle scripts: skill sync below, then Claude Code's own
# version-staleness check.

# Claude Code skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the existing
# per-repo Claude config volume, so no separate volume is needed.
rm -rf /home/vscode/.claude/skills/* 2>/dev/null || true
{{SKILLS_SOURCES_COMMANDS}}

# Re-applies post-create-block.sh's DISABLE_AUTOUPDATER → settings.json merge
# on every start, not just once at container create. Claude Code's own
# onboarding flow (theme selection, notification prompt, on first `claude`
# run) overwrites settings.json wholesale rather than merging into it,
# silently stripping the env.DISABLE_AUTOUPDATER key post-create.sh just
# wrote — confirmed in the wild: pinned to 2.1.265, onboarded, and the very
# next launch was already running a silently auto-updated 2.1.266. A
# one-time write in postCreateCommand can't survive that; reapplying it
# here, on every postStartCommand, makes the guard self-healing on the next
# container start instead of a single point-in-time write an interactive
# flow can silently undo. (Doesn't cover re-running `claude` again in the
# same still-running container without a start in between — Claude Code's
# own periodic background check could still fire in that narrow window; a
# full fix would need to wrap the `claude` binary itself, which is more
# invasive than this skill takes on.)
settings_file="$HOME/.claude/settings.json"
[ -f "$settings_file" ] || echo '{}' > "$settings_file"
if [ "${DISABLE_AUTOUPDATER:-false}" = "1" ]; then
  jq '.env.DISABLE_AUTOUPDATER = "1"' "$settings_file" > "$settings_file.tmp" && mv "$settings_file.tmp" "$settings_file"
else
  jq 'if .env then .env |= del(.DISABLE_AUTOUPDATER) else . end' "$settings_file" > "$settings_file.tmp" && mv "$settings_file.tmp" "$settings_file"
fi

# Claude-Code-specific: when CLAUDE_CODE_VERSION is pinned (not "latest"),
# checks once per start whether a newer release exists, caching the result
# to a local file so the every-terminal warnings snippet in ~/.bashrc
# (appended below, once) can show it without any terminal paying for its
# own network call. Any lookup failure degrades to silence — never blocks
# or slows down startup. A slow (not just failed) response is capped by
# `timeout` for the same reason: a hung network call would otherwise stall
# `postStartCommand` itself.
#
# Compared against npm's registry rather than a GitHub releases API — the
# native binary has no such API of its own, and Anthropic's own npm package
# (`@anthropic-ai/claude-code`) installs that same native binary and is
# documented to carry matching version numbers, so its registry "latest"
# dist-tag is a reliable proxy without needing an extra tool (npm is
# already present in the base image; no jq dependency this way either).

CACHE_FILE="$HOME/.claude-code-version-check"
PINNED="${CLAUDE_CODE_VERSION:-latest}"

if [ "$PINNED" = "latest" ]; then
  rm -f "$CACHE_FILE"
else
  latest="$(timeout 5s npm view @anthropic-ai/claude-code version 2>/dev/null || true)"
  if [ -n "$latest" ] && [ "$latest" != "$PINNED" ]; then
    echo "$latest" > "$CACHE_FILE"
  else
    rm -f "$CACHE_FILE" 2>/dev/null || true
  fi
fi

# Guarded like the other ~/.bashrc-appending blocks in this skill: this
# script reruns on every start, but the snippet only needs inserting once.
if ! grep -q "devcontainer-claude-code-version-warning" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-claude-code-version-warning
if [[ $- == *i* ]]; then
  if [ -f "$HOME/.claude-code-version-check" ]; then
    echo "⚠ A newer Claude Code release is available: $(cat "$HOME/.claude-code-version-check") — update CLAUDE_CODE_VERSION in .devcontainer/.env, then Dev Containers: Rebuild Container."
  fi
fi
EOF
fi
