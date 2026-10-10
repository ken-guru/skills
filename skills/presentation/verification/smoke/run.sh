#!/usr/bin/env bash
# Smoke-runs one plugin eval scenario in Copilot CLI or Codex, which have no
# eval runner. Maintainer tool, not part of any skill's runtime.
#
# Usage: run.sh <copilot|codex> <scenario folder name> [output folder]
#   e.g. run.sh copilot 01-sourced-team-update
#
# The prompt is the scenario's prompt.md body. The run happens in a fresh
# folder; read its log and Deck Folder against the scenario's graders/.
set -euo pipefail

harness="${1:?usage: run.sh <copilot|codex> <scenario> [output folder]}"
scenario="${2:?usage: run.sh <copilot|codex> <scenario> [output folder]}"
here="$(cd "$(dirname "$0")" && pwd)"
case_dir="$here/../../evals/$scenario"
[ -f "$case_dir/prompt.md" ] || { echo "No scenario $scenario in skills/presentation/evals/" >&2; exit 2; }

out="${3:-$(mktemp -d "${TMPDIR:-/tmp}/presentation-smoke-$harness-$scenario-XXXXXX")}"
mkdir -p "$out"
# The prompt is everything after the frontmatter.
prompt="$(awk 'BEGIN{n=0} /^---$/ && n<2 {n++; next} n>=2 {print}' "$case_dir/prompt.md")"

cd "$out"
start=$(date +%s)
case "$harness" in
  copilot)
    # gh's GH_TOKEN may lack Copilot access and override the /login credentials.
    env -u GH_TOKEN -u GITHUB_TOKEN copilot -p "$prompt" --allow-all-tools --allow-all-paths > run.log 2>&1 || status=$?
    ;;
  codex)
    # Rendering needs the browser outside Codex's sandbox; workspace-write with
    # network access lets Chromium start on Linux.
    codex exec --full-auto -c sandbox_workspace_write.network_access=true "$prompt" > run.log 2>&1 || status=$?
    ;;
  *)
    echo "Unknown harness $harness: use copilot or codex" >&2
    exit 2
    ;;
esac
echo "$harness $scenario exit=${status:-0} secs=$(( $(date +%s) - start )) folder=$out"
echo "Graders to apply by hand: $(ls "$case_dir/graders" | tr '\n' ' ')"
