#!/bin/bash
set -euo pipefail
# Runs on every container start (not just create/rebuild). Copilot-specific:
# when COPILOT_CLI_VERSION is pinned (not "latest"), checks once per start
# whether a newer release exists, caching the result to a local file so the
# every-terminal warnings snippet in ~/.bashrc (appended below, once) can
# show it without any terminal paying for its own network call. Any lookup
# failure degrades to silence — never blocks or slows down startup. A slow
# (not just failed) response is capped by `timeout` for the same reason: a
# hung network call would otherwise stall `postStartCommand` itself, and
# this container's `waitFor: postStartCommand` would then delay readiness.

CACHE_FILE="$HOME/.copilot-version-check"
PINNED="${COPILOT_CLI_VERSION:-latest}"

if [ "$PINNED" = "latest" ]; then
  rm -f "$CACHE_FILE"
else
  latest_tag=$(timeout 5s gh api repos/github/copilot-cli/releases/latest --jq .tag_name 2>/dev/null || true)
  latest="${latest_tag#v}"
  if [ -n "$latest" ] && [ "$latest" != "$PINNED" ]; then
    echo "$latest" > "$CACHE_FILE"
  else
    rm -f "$CACHE_FILE" 2>/dev/null || true
  fi
fi

# Guarded like the other ~/.bashrc-appending blocks in this skill: this
# script reruns on every start, but the snippet only needs inserting once.
if ! grep -q "devcontainer-copilot-version-warning" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-copilot-version-warning
if [[ $- == *i* ]]; then
  if [ -f "$HOME/.copilot-version-check" ]; then
    echo "⚠ A newer Copilot CLI release is available: $(cat "$HOME/.copilot-version-check") — update COPILOT_CLI_VERSION in .devcontainer/.env, then Dev Containers: Rebuild Container."
  fi
fi
EOF
fi
