#!/bin/bash
set -euo pipefail

# BASH_ENV (see post-create-base.sh) already sources this before this
# script's first line runs, but source it again directly, defensively, in
# case this script is ever run by hand outside that containerEnv. A
# skill-sync block appended below may need GH_TOKEN (private skill sources).
ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Runs on every container start (not just create/rebuild). Empty by design —
# each CLI skill appends its own skill-sync block here, under its own
# marker, when the user opts into automatic skill sync for that tool.

# --- Network egress firewall ---
# Opt-in network egress firewall (ADR-0005). Runs on every container start
# (not just create/rebuild), matching init-firewall.sh's own policy-reset-
# before-flush design: a script that died mid-run on a previous start can't
# permanently deadlock a later one. The refresh loop keeps CDN-backed
# allowlisted hosts from going stale mid-session (see refresh-allowlist.sh).
sudo /workspace/.devcontainer/init-firewall.sh
sudo bash -c 'bash /workspace/.devcontainer/refresh-allowlist.sh &'
# --- Claude Code skill-sync ---
# Claude Code skills are wiped and reinstalled from the configured sources on
# every start, so the skill set stays current with upstream instead of
# persisting a stale copy across rebuilds. This lives inside the shared
# config volume, so no separate volume is needed.
rm -rf /home/vscode/.claude/skills/* 2>/dev/null || true
npx -y skills add mattpocock/skills --skill '*' -a claude-code -y --copy -g
# --- Codex skill-sync ---
# Codex skills are synced from the configured sources on every start, so
# the skill set stays current with upstream. The `skills` CLI writes them to
# the Shared Skills Directory (~/.agents/skills) for every "universal" agent,
# `codex` included — the same directory Copilot's and Antigravity's
# skill-sync also write into, so nothing here wipes it (a wipe from one
# CLI's block would delete skills another CLI's block just synced). A skill
# removed upstream stays until it is deleted by hand. This lives inside the
# shared config volume, so no separate volume is needed.
npx -y skills add mattpocock/skills --skill '*' -a codex -y --copy -g
# --- Antigravity skill-sync ---
# Antigravity skills are synced from the configured sources on every start, so
# the skill set stays current with upstream. The `skills` CLI writes them to
# the Shared Skills Directory (~/.agents/skills) for every "universal" agent,
# `antigravity-cli` included; agy sees that directory through the skills-link
# block (a link from ~/.gemini/skills). Nothing is wiped, so a skill removed
# upstream stays until it is deleted by hand. This lives inside the shared
# config volume, so no separate volume is needed.
#
# Trust boundary: the source(s) below were named and accepted during this
# devcontainer's setup. Every start re-fetches and re-runs their skills
# unattended, with no per-skill review step — only as trustworthy as the
# source(s) chosen.
npx -y skills add mattpocock/skills --skill '*' -a antigravity-cli -y --copy -g
# --- Antigravity skills-link ---
# agy does not read the Shared Skills Directory (~/.agents/skills), where the
# `skills` CLI writes every global install for its "universal" agents. It does
# read ~/.gemini/skills, so link that to the shared directory: everything
# installed there, now or later, is visible to agy with no copy step.
#
# ~/.gemini/skills is not documented by Google for the CLI (its docs list
# ~/.gemini/antigravity-cli/skills). It has worked reliably, but if `/skills`
# in agy ever stops listing synced skills, this is the place to look. Fallbacks,
# in order: the same link at ~/.gemini/antigravity-cli/skills, then a copy into
# ~/.gemini/config/skills.
#
# No download and no wipe. Never destroys anything: an empty real directory is
# replaced (rmdir only removes an empty one); a non-empty directory, or a link
# to somewhere else, is left alone with a warning.
mkdir -p "$HOME/.agents/skills" "$HOME/.gemini"
_agy_skills_link="$HOME/.gemini/skills"
_agy_skills_target="$HOME/.agents/skills"
if [ -L "$_agy_skills_link" ]; then
  if [ "$(readlink -f "$_agy_skills_link")" != "$(readlink -f "$_agy_skills_target")" ]; then
    echo "WARN: $_agy_skills_link is a link to $(readlink "$_agy_skills_link"), not $_agy_skills_target — left alone; agy will not see the shared skills until you repoint it." >&2
  fi
elif [ -d "$_agy_skills_link" ]; then
  if [ -z "$(ls -A "$_agy_skills_link")" ]; then
    if rmdir "$_agy_skills_link"; then
      ln -s "$_agy_skills_target" "$_agy_skills_link"
    else
      echo "WARN: could not replace empty directory $_agy_skills_link with a link to $_agy_skills_target — left alone." >&2
    fi
  else
    echo "WARN: $_agy_skills_link is a non-empty directory — left alone; move its contents into $_agy_skills_target and replace it with a link to make them visible to agy." >&2
  fi
elif [ -e "$_agy_skills_link" ]; then
  echo "WARN: $_agy_skills_link exists and is not a directory — left alone; agy will not see the shared skills until you replace it with a link to $_agy_skills_target." >&2
else
  ln -s "$_agy_skills_target" "$_agy_skills_link"
fi
unset _agy_skills_link _agy_skills_target
# --- Copilot skill-sync ---
# Copilot skills are synced from the configured sources on every start, so
# the skill set stays current with upstream. The `skills` CLI writes them to
# the Shared Skills Directory (~/.agents/skills) for every "universal" agent,
# `github-copilot` included — the same directory Codex's and Antigravity's
# skill-sync also write into, so nothing here wipes it (a wipe from one
# CLI's block would delete skills another CLI's block just synced). A skill
# removed upstream stays until it is deleted by hand. This lives inside the
# shared config volume, so no separate volume is needed.
npx -y skills add mattpocock/skills --skill '*' -a github-copilot -y --copy -g
