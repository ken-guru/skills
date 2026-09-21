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
