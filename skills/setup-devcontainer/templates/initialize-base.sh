#!/bin/sh

# Seeds .devcontainer/.env from .env.example before the container exists —
# identical behavior to this skill's original inline initializeCommand
# one-liner. Resolves its own directory via "$0"/dirname, not
# ${localWorkspaceFolder}: that devcontainer.json variable is substituted
# only inside devcontainer.json's own string fields (the command that
# invokes this script), never inside a script file the command then runs.
DIR="$(dirname "$0")"
test -f "$DIR/.env" || cp "$DIR/.env.example" "$DIR/.env"
