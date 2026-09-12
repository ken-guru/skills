#!/bin/bash
set -euo pipefail

# SKILL.md documents an exact render-devcontainer.sh invocation, plus a
# prose claim that verify-devcontainer.sh takes "the exact same flags
# (minus --out, plus --file)". Neither is checked against the scripts'
# actual argument parsers anywhere else, so this test exists purely to
# catch drift: a flag added/renamed/removed in one place and not the
# other three.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILL_MD="$SKILL_DIR/SKILL.md"
RENDER="$SKILL_DIR/scripts/render-devcontainer.sh"
VERIFY="$SKILL_DIR/scripts/verify-devcontainer.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Long-flag case labels (e.g. "--repo-name") a script's arg parser accepts,
# excluding the -h|--help alias and the catch-all *) branch.
accepted_flags() {
  grep -oE '^ *--[a-zA-Z0-9-]+\)' "$1" | tr -d ' )' | sort -u
}

# The fenced ```bash block immediately following the render-devcontainer.sh
# invocation example in SKILL.md.
render_doc_block() {
  awk '/scripts\/render-devcontainer\.sh\]/{found=1}
       found && /^  ```bash/{incode=1; next}
       incode && /^  ```/{exit}
       incode' "$SKILL_MD"
}

render_doc_flags() {
  render_doc_block | grep -oE -- '--[a-zA-Z0-9-]+' | sort -u
}

render_actual="$(accepted_flags "$RENDER")"
verify_actual="$(accepted_flags "$VERIFY")"
render_documented="$(render_doc_flags)"

[ -n "$render_documented" ] || fail "could not find SKILL.md's render-devcontainer.sh invocation block"

if [ "$render_actual" != "$render_documented" ]; then
  fail "SKILL.md's render-devcontainer.sh invocation doesn't match its actual flags
--- render-devcontainer.sh accepts ---
$render_actual
--- SKILL.md documents ---
$render_documented"
fi

# SKILL.md's prose claim: verify-devcontainer.sh == render's flags, minus
# --out, plus --file.
expected_verify="$(printf '%s\n' "$render_actual" --file | grep -v '^--out$' | sort -u)"
if [ "$verify_actual" != "$expected_verify" ]; then
  fail "verify-devcontainer.sh's flags no longer match SKILL.md's 'same flags minus --out plus --file' claim
--- verify-devcontainer.sh accepts ---
$verify_actual
--- expected (render's flags, -out +file) ---
$expected_verify"
fi

echo "SKILL.md documented-flag checks passed."
