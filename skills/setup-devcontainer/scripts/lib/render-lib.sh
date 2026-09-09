#!/bin/bash
# Shared rendering primitives for render-tool-container.sh and
# verify-tool-container.sh. Sourced, not executed. Both scripts need to agree
# on exactly how each template's placeholders resolve — this is that single
# shared source of truth, so verify checks against the same substitution
# rules render writes with, not a hand-copied guess at them.

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$(cd "$LIB_DIR/../../templates" && pwd)"

# Escapes a value for safe use as a sed replacement with a `|` delimiter.
sed_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//&/\\&}
  s=${s//|/\\|}
  printf '%s' "$s"
}

# post-create-base.sh's two git-identity lines aren't pure substitution: when
# a default is available the line keeps its `${VAR:-default}` shape, and when
# it isn't the line changes shape entirely to `${VAR:?required}` (see
# SKILL.md step 4). Reads the current template rather than a hand-copied
# line, so a future reformat of post-create-base.sh doesn't silently drift
# out of sync with this substitution.
render_base_block() {
  local email_value="$1" have_email="$2" name_value="$3" have_name="$4"
  local content
  content="$(cat "$TEMPLATES_DIR/post-create-base.sh")"

  if [ "$have_email" = "true" ]; then
    content="$(printf '%s\n' "$content" | sed "s|{{GIT_EMAIL_DEFAULT}}|$(sed_escape "$email_value")|g")"
  else
    content="$(printf '%s\n' "$content" | sed 's|${GIT_USER_EMAIL:-{{GIT_EMAIL_DEFAULT}}}|${GIT_USER_EMAIL:?Set GIT_USER_EMAIL in .devcontainer/.env}|')"
  fi

  if [ "$have_name" = "true" ]; then
    content="$(printf '%s\n' "$content" | sed "s|{{GIT_NAME_DEFAULT}}|$(sed_escape "$name_value")|g")"
  else
    content="$(printf '%s\n' "$content" | sed 's|${GIT_USER_NAME:-{{GIT_NAME_DEFAULT}}}|${GIT_USER_NAME:?Set GIT_USER_NAME in .devcontainer/.env}|')"
  fi

  printf '%s\n' "$content"
}

render_identity_banner_block() {
  local tool_display_name="$1"
  sed "s|{{TOOL_DISPLAY_NAME}}|$(sed_escape "$tool_display_name")|g" "$TEMPLATES_DIR/identity-banner-block.sh"
}

render_ssh_block() {
  local repo_name="$1" repo_slug="$2" tool_name="$3"
  sed -e "s|{{REPO_NAME}}|$(sed_escape "$repo_name")|g" \
      -e "s|{{REPO_SLUG}}|$(sed_escape "$repo_slug")|g" \
      -e "s|{{TOOL_NAME}}|$(sed_escape "$tool_name")|g" \
      "$TEMPLATES_DIR/post-create-ssh-block.sh"
}

# The remaining three blocks carry no placeholders — always copied verbatim.
tool_install_block() { cat "$TEMPLATES_DIR/$1/post-create-block.sh"; }
yolo_alias_block() { cat "$TEMPLATES_DIR/$1/yolo-alias-block.sh"; }
ssh_warnings_block() { cat "$TEMPLATES_DIR/post-create-warnings-block.sh"; }
