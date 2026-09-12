#!/bin/bash
# Loads the non-secret .devcontainer/.env settings. Sourced from two places so
# every shell in this container sees git identity and host-label settings — not
# just the postCreate/postStart/postAttach lifecycle
# scripts, which each run once per rebuild/start/attach and exit, so nothing
# they export on their own survives into a shell opened afterward:
#   - as BASH_ENV (containerEnv in devcontainer.json) — bash reads this
#     automatically for every non-interactive invocation, which is the shape
#     an AI CLI's own tool calls run in (`bash -c ...`), and which never
#     sources ~/.bashrc;
#   - from ~/.bashrc (see post-create-base.sh) — for interactive shells, a
#     human's VS Code terminal.
ENV_FILE="/workspace/.devcontainer/.env"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      GIT_USER_EMAIL=*|GIT_USER_NAME=*|DEVCONTAINER_HOST=*|DEVCONTAINER_ACCEPT_RESIDUAL_RISK=*)
        key="${line%%=*}"
        value="${line#*=}"
        value="${value#\"}"
        value="${value%\"}"
        export "$key=$value"
        ;;
    esac
  done < "$ENV_FILE"
fi
