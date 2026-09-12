#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: devcontainer-code-runner <command> [args... ]" >&2
}

if [ "$#" -eq 0 ]; then
  usage
  exit 64
fi

# Do not inherit the agent-operation environment. In particular, GH_TOKEN,
# BASH_ENV, credential-helper variables, and SSH agent settings must not reach
# workspace-derived commands. Keep only ordinary execution context needed by
# common build tools.
safe_path="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
safe_term="${TERM:-dumb}"
safe_lang="${LANG:-C.UTF-8}"
safe_ci="${CI:-}"
safe_node_env="${NODE_ENV:-}"

exec sudo -u code-runner --preserve-env=HOME \
  env -i \
    HOME=/home/code-runner \
    USER=code-runner \
    LOGNAME=code-runner \
    PATH="$safe_path" \
    TERM="$safe_term" \
    LANG="$safe_lang" \
    CI="$safe_ci" \
    NODE_ENV="$safe_node_env" \
    "$@"
