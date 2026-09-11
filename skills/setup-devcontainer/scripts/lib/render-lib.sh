#!/bin/bash
# Shared rendering primitives for render-devcontainer.sh and
# verify-devcontainer.sh. Sourced, not executed. Both scripts need to agree
# on exactly how each template's placeholders resolve — this is that single
# shared source of truth, so verify checks against the same substitution
# rules render writes with, not a hand-copied guess at them.
#
# Scoped only to what's still genuinely parameterized per repo (git-identity
# defaults, SSH). The old per-tool lookup functions (tool_install_block,
# yolo_alias_block) are gone: each CLI skill now owns static, single-tool
# content directly in its own templates/, with nothing left to parameterize
# across tools.

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
# out of sync with this substitution. Also substitutes the Local Checkout
# git-init placeholders.
render_base_block() {
  local email_value="$1" have_email="$2" name_value="$3" have_name="$4"
  local local_checkout_git_init="$5" git_default_branch="$6"
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

  content="$(printf '%s\n' "$content" | sed \
    -e "s|{{LOCAL_CHECKOUT_GIT_INIT}}|$(sed_escape "$local_checkout_git_init")|g" \
    -e "s|{{GIT_DEFAULT_BRANCH}}|$(sed_escape "$git_default_branch")|g")"

  printf '%s\n' "$content"
}

render_ssh_block() {
  local repo_slug="$1" repo_name="$2"
  sed -e "s|{{REPO_SLUG}}|$(sed_escape "$repo_slug")|g" \
      -e "s|{{REPO_NAME}}|$(sed_escape "$repo_name")|g" \
      "$TEMPLATES_DIR/post-create-ssh-block.sh"
}

# post-attach.sh is a single, always-substituted file (no --ssh toggle of its
# own — it's only ever written into the Scaffold at all when SSH is enabled)
# rather than one of the conditional post-create.sh blocks above, but it
# shares the same {{REPO_SLUG}} substitution rule, so it reuses this library
# for the same reason verify-devcontainer.sh checks the SSH block against
# the real template instead of a hand-copied guess.
render_post_attach_block() {
  local repo_slug="$1"
  sed -e "s|{{REPO_SLUG}}|$(sed_escape "$repo_slug")|g" \
      "$TEMPLATES_DIR/post-attach.sh"
}

# The remaining two blocks carry no placeholders — always copied verbatim.
install_cli_block() { cat "$TEMPLATES_DIR/install-cli-block.sh"; }
ssh_warnings_block() { cat "$TEMPLATES_DIR/post-create-warnings-block.sh"; }
