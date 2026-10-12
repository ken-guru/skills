#!/usr/bin/env bash
# Smoke-runs one plugin eval scenario in Copilot CLI or Codex, which have no
# eval runner. Maintainer tool, not part of any skill's runtime.
#
# Usage: run.sh [--i-accept-host-risk] <copilot|codex> <scenario folder name> [output folder]
#   e.g. run.sh copilot 01-sourced-team-update
#
# The prompt is the scenario's prompt.md body. The run happens in a fresh
# folder; read its log and Deck Folder against the scenario's graders/.
#
# Both harnesses run with every tool, every path, and the network allowed, so
# the script runs in a container (such as this repo's devcontainer) unless
# --i-accept-host-risk says the maintainer accepts that on their own machine.
set -euo pipefail

accept_host_risk=false
if [ "${1:-}" = "--i-accept-host-risk" ]; then
  accept_host_risk=true
  shift
fi
if [ "$accept_host_risk" = false ] && [ ! -f /.dockerenv ] && [ ! -f /run/.containerenv ]; then
  echo "This runs Copilot or Codex with every tool, every path, and the network allowed. Run it in the repo's devcontainer, or pass --i-accept-host-risk first to run it on this machine." >&2
  exit 2
fi

harness="${1:?usage: run.sh [--i-accept-host-risk] <copilot|codex> <scenario> [output folder]}"
scenario="${2:?usage: run.sh [--i-accept-host-risk] <copilot|codex> <scenario> [output folder]}"
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
    # network access lets Chromium start on Linux. Codex 0.154 replaced
    # --full-auto with --approve-for-me (same sandbox, approvals reviewed for you).
    # The run folder is not a git repository, and Codex would wait on stdin.
    codex exec --approve-for-me --skip-git-repo-check -c sandbox_workspace_write.network_access=true "$prompt" < /dev/null > run.log 2>&1 || status=$?
    ;;
  *)
    echo "Unknown harness $harness: use copilot or codex" >&2
    exit 2
    ;;
esac
echo "$harness $scenario exit=${status:-0} secs=$(( $(date +%s) - start )) folder=$out"
echo "Graders to apply by hand: $(ls "$case_dir/graders" | tr '\n' ' ')"
exit "${status:-0}"
