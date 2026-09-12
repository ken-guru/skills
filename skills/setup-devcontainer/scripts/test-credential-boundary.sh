#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES_DIR="$SKILL_DIR/templates"

fail() { echo "FAIL: $1" >&2; exit 1; }

for file in bash-env.sh env.baseline.example devcontainer.json devcontainer.with-ssh.json post-create-ssh-block.sh; do
  [ -f "$TEMPLATES_DIR/$file" ] || fail "missing credential-boundary template: $file"
done

grep -q 'GH_TOKEN.*localEnv' "$TEMPLATES_DIR/devcontainer.json" || fail "GH_TOKEN is not host-provided"
grep -q 'GH_TOKEN.*localEnv' "$TEMPLATES_DIR/devcontainer.with-ssh.json" || fail "SSH config does not provide GH_TOKEN"
grep -q 'DEVCONTAINER_CREDENTIALS_DIR' "$TEMPLATES_DIR/devcontainer.with-ssh.json" || fail "SSH credential mount is not host-provided"
grep -q 'CREDENTIAL_DIR="/run/devcontainer-credentials"' "$TEMPLATES_DIR/post-create-ssh-block.sh" || fail "protected credential mount is not validated"
grep -q 'mode 0600 or 0400' "$TEMPLATES_DIR/post-create-ssh-block.sh" || fail "credential permissions are not validated"
grep -q 'source "$ENV_FILE"' "$TEMPLATES_DIR/bash-env.sh" && fail "bash-env must not source workspace env"
grep -q '^GH_TOKEN=' "$TEMPLATES_DIR/env.baseline.example" && fail "workspace env example must not contain GH_TOKEN"
grep -q 'gh api' "$TEMPLATES_DIR/post-create-ssh-block.sh" && fail "SSH setup must not administer deploy keys via API"

grep -q 'github.com/settings/personal-access-tokens/new' "$TEMPLATES_DIR/env.baseline.example" \
  || fail "env example must link the fine-grained token page, not the classic one"
grep -qE 'github\.com/settings/tokens[^/]' "$TEMPLATES_DIR/env.baseline.example" \
  && fail "env example must not link the classic tokens page"

SKILL_MD="$SKILL_DIR/SKILL.md"
grep -q 'docker info' "$SKILL_MD" || fail "SKILL.md's walkthrough does not verify Docker is available"
grep -q 'github.com/settings/personal-access-tokens/new' "$SKILL_MD" \
  || fail "SKILL.md's walkthrough does not link the fine-grained token page"
grep -q 'direnv' "$SKILL_MD" || fail "SKILL.md's walkthrough does not offer direnv for per-repo env delivery"

[ -f "$TEMPLATES_DIR/envrc.example" ] || fail "missing envrc.example template"
grep -q 'export GH_TOKEN=' "$TEMPLATES_DIR/envrc.example" || fail "envrc template does not export GH_TOKEN"
grep -q 'export DEVCONTAINER_CREDENTIALS_DIR=' "$TEMPLATES_DIR/envrc.example" \
  || fail "envrc template does not export DEVCONTAINER_CREDENTIALS_DIR"
grep -q 'templates/envrc.example' "$SKILL_MD" || fail "SKILL.md does not reference envrc.example — orphaned template"

echo "Credential-boundary contract checks passed."
