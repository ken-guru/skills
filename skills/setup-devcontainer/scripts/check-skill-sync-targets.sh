#!/bin/bash
set -euo pipefail

# Verifies each CLI Skill's skill-sync wipe/sync target against where the
# `skills` CLI really writes for that agent flag, empirically — not against
# a pinned table that could itself drift. Runs the live `skills add` command
# each CLI skill's post-start-block.sh renders, into a scratch $HOME, for
# each agent flag in turn, then compares the resulting install path against
# what the corresponding template encodes.
#
# Network-dependent (resolves the `skills` package via npx) and non-
# deterministic in timing, so this is deliberately kept out of
# test-integration.sh (documented there as deterministic, no network) and
# run instead as its own scheduled job — see
# .github/workflows/setup-devcontainer-skill-sync-drift.yml — the same
# split test-integration.sh itself uses against
# setup-devcontainer-image-scan.yml.
#
# Background: setup-antigravity-devcontainer, setup-codex-devcontainer and
# setup-copilot-devcontainer all wiped a directory `skills` never wrote to,
# for months, until noticed by a user (issues #346, #347). This check exists
# so the next time `skills`' agent table changes, or a CLI skill's `-a` flag
# is wrong, CI catches it instead.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FAIL_COUNT=0

fail() {
  echo "FAIL: $1" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# tool-dir:agent-flag — the agent flag each skill's post-start.sh render
# step (SKILL.md step 5/6) passes to `skills add -a <flag>`. Kept here,
# explicit, as the thing under test — not re-derived from SKILL.md prose,
# so a docs typo doesn't silently mask itself.
SKILL_AGENTS=(
  "setup-claude-devcontainer:claude-code"
  "setup-codex-devcontainer:codex"
  "setup-antigravity-devcontainer:antigravity-cli"
  "setup-copilot-devcontainer:github-copilot"
)

SCRATCH_ROOT="$(mktemp -d)"
trap 'rm -rf "$SCRATCH_ROOT"' EXIT

PROBE_SKILL_DIR="$SCRATCH_ROOT/probe-skill"
mkdir -p "$PROBE_SKILL_DIR"
cat > "$PROBE_SKILL_DIR/SKILL.md" <<'EOF'
---
name: probe-skill
description: Throwaway fixture skill, installed only to observe where the skills CLI writes it for a given agent flag.
---

# Probe skill

No-op; exists only to be installed and located on disk.
EOF

# Extract the wipe path (if any) a tool's post-start-block.sh hardcodes,
# relative to $HOME — e.g. "rm -rf /home/vscode/.claude/skills/*" yields
# ".claude/skills". Empty if the block has no wipe line (the "shares the
# Shared Skills Directory, nothing to wipe" case).
wipe_target() {
  local template="$1"
  grep -oE 'rm -rf /home/vscode/[^ ]+/skills/\*' "$template" 2>/dev/null \
    | sed -E 's#rm -rf /home/vscode/##; s#/\*$##' \
    | head -n1 || true
}

# Live-probes where `skills add ... -a <agent>` actually installs, relative
# to a scratch $HOME. Prints the relative directory (e.g. ".claude/skills")
# or nothing if the probe install failed or landed somewhere unexpected.
probe_install_target() {
  local agent="$1"
  local home
  home="$(mktemp -d)"
  (
    export HOME="$home"
    npx -y skills add "$PROBE_SKILL_DIR" --skill probe-skill -a "$agent" -y --copy -g
  ) >"$home/.probe-install.log" 2>&1 || {
    echo "npx skills add failed for -a $agent:" >&2
    cat "$home/.probe-install.log" >&2
    rm -rf "$home"
    return 1
  }
  local found
  found="$(find "$home" -mindepth 1 -iname 'SKILL.md' -path '*probe-skill*' 2>/dev/null | head -n1 || true)"
  rm -rf "$home"
  if [ -z "$found" ]; then
    return 1
  fi
  # Strip "$home/" prefix and the trailing "/probe-skill/SKILL.md".
  found="${found#"$home"/}"
  found="${found%/probe-skill/SKILL.md}"
  echo "$found"
}

for entry in "${SKILL_AGENTS[@]}"; do
  tool_dir="${entry%%:*}"
  agent_flag="${entry#*:}"
  template="$SKILLS_ROOT/$tool_dir/templates/post-start-block.sh"

  if [ ! -f "$template" ]; then
    fail "[$tool_dir] no templates/post-start-block.sh found at $template"
    continue
  fi

  wipe="$(wipe_target "$template")"

  if ! probed="$(probe_install_target "$agent_flag")"; then
    fail "[$tool_dir] 'skills add ... -a $agent_flag' probe install failed or couldn't be located — see stderr above"
    continue
  fi

  if [ -n "$wipe" ]; then
    if [ "$wipe" != "$probed" ]; then
      fail "[$tool_dir] wipes ~/$wipe but 'skills add -a $agent_flag' actually installs to ~/$probed — the wipe is stale"
    else
      echo "OK: [$tool_dir] wipe target ~/$wipe matches where -a $agent_flag actually installs"
    fi
  else
    if [ "$probed" != ".agents/skills" ]; then
      fail "[$tool_dir] has no wipe (assumes it shares the Shared Skills Directory, ~/.agents/skills) but 'skills add -a $agent_flag' actually installs to ~/$probed — this agent needs its own wipe restored"
    else
      echo "OK: [$tool_dir] no wipe, and -a $agent_flag confirmed installing to the shared ~/.agents/skills as assumed"
    fi
  fi
done

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$FAIL_COUNT check(s) failed" >&2
  exit 1
fi

echo "All skill-sync target checks passed."
