#!/bin/bash
set -euo pipefail

# Exercises templates/firewall-lib.sh's firewall_collect_domains() — the
# pure function both init-firewall.sh and refresh-allowlist.sh source to
# build their domain list (see CONTEXT.md's "Network Manifest" and
# ADR-0005). Builds a scratch .devcontainer-shaped directory per case (a
# real network-manifest.json + a real copy of network-manifest-domains.sh +
# an allowed-domains.local.txt), points FIREWALL_DEVCONTAINER_DIR at it, and
# asserts the resulting FIREWALL_DOMAINS array. Never touches a real
# .devcontainer/ and never runs iptables/ipset — this is deliberately scoped
# to the domain-collection logic alone (issue #291's own testing decisions
# rule out runtime firewall enforcement as untestable in this sandbox).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RUN_COUNT=0
FAIL_COUNT=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  RUN_COUNT=$((RUN_COUNT + 1))
  if [ "$expected" != "$actual" ]; then
    echo "FAIL: $label" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# Builds a scratch devcontainer-shaped directory ($1) with a real copy of
# network-manifest-domains.sh, the given manifest JSON ($2), and the given
# local-domains file content ($3, may be empty string for "no local file").
setup_case() {
  local dir="$1" manifest_json="$2" local_content="$3"
  mkdir -p "$dir"
  cp "$TEMPLATES_DIR/network-manifest-domains.sh" "$dir/network-manifest-domains.sh"
  chmod +x "$dir/network-manifest-domains.sh"
  printf '%s' "$manifest_json" > "$dir/network-manifest.json"
  if [ -n "$local_content" ]; then
    printf '%s' "$local_content" > "$dir/allowed-domains.local.txt"
  fi
}

BASELINE_MANIFEST='{
  "baseline": {
    "networkAllowlist": [
      {"host": "registry.npmjs.org", "purpose": "npm", "source": "https://docs.npmjs.com/cli/v10/using-npm/registry"},
      {"host": "github.com", "purpose": "git", "source": "https://docs.github.com/en/get-started/quickstart/set-up-git"},
      {"host": "api.github.com", "purpose": "gh CLI", "source": "https://docs.github.com/en/rest"}
    ]
  }
}'

# Builds case $1 (manifest $2, local-domains content $3), sources
# firewall-lib.sh with FIREWALL_DEVCONTAINER_DIR pointed at it, runs
# firewall_collect_domains, and asserts FIREWALL_DOMAINS against $4 ($5 as
# the assert_eq label).
run_collect_domains_case() {
  local case_name="$1" manifest_json="$2" local_content="$3" expected="$4" label="$5"
  local case_dir="$TMP_DIR/$case_name"
  setup_case "$case_dir" "$manifest_json" "$local_content"
  (
    FIREWALL_DEVCONTAINER_DIR="$case_dir"
    # shellcheck source=../templates/firewall-lib.sh
    source "$TEMPLATES_DIR/firewall-lib.sh"
    firewall_collect_domains
    printf '%s\n' "${FIREWALL_DOMAINS[@]}" > "$TMP_DIR/$case_name.out"
  )
  assert_eq "$label" "$expected" "$(cat "$TMP_DIR/$case_name.out")"
}

run_collect_domains_case "case-baseline-no-local" "$BASELINE_MANIFEST" "" \
  "$(printf 'registry.npmjs.org\ngithub.com\napi.github.com')" \
  "baseline manifest, no local file: exactly the manifest hosts"

run_collect_domains_case "case-baseline-plus-local" "$BASELINE_MANIFEST" \
  "$(printf '# my project hosts\n\napi.example.com\n  api2.example.com  \n# api3.example.com (disabled)\n')" \
  "$(printf 'registry.npmjs.org\ngithub.com\napi.github.com\napi.example.com\napi2.example.com')" \
  "baseline manifest + local file: manifest hosts then local hosts, comments/blanks/whitespace stripped"

# --- local file present but entirely comments/blank: contributes nothing, no crash ---
run_collect_domains_case "case-empty-local" "$BASELINE_MANIFEST" "$(printf '# nothing here yet\n\n')" \
  "$(printf 'registry.npmjs.org\ngithub.com\napi.github.com')" \
  "local file present but empty of real hosts: falls back to manifest hosts alone"

# --- multiple manifest entries (baseline + a CLI) + local file, full composition ---
MULTI_MANIFEST='{
  "baseline": {
    "networkAllowlist": [
      {"host": "registry.npmjs.org", "purpose": "npm", "source": "https://docs.npmjs.com/cli/v10/using-npm/registry"}
    ]
  },
  "claude": {
    "networkAllowlist": [
      {"host": "api.anthropic.com", "purpose": "Claude Code API", "source": "https://code.claude.com/docs/en/network-config"}
    ]
  }
}'
run_collect_domains_case "case-multi-plus-local" "$MULTI_MANIFEST" "$(printf 'myproject-api.example.com\n')" \
  "$(printf 'registry.npmjs.org\napi.anthropic.com\nmyproject-api.example.com')" \
  "multiple manifest entries + local file: manifest order preserved, local appended last"

# --- missing manifest file: firewall_collect_domains returns non-zero, does not exit the caller ---
case_dir="$TMP_DIR/case-missing-manifest"
mkdir -p "$case_dir"
cp "$TEMPLATES_DIR/network-manifest-domains.sh" "$case_dir/network-manifest-domains.sh"
chmod +x "$case_dir/network-manifest-domains.sh"
# deliberately no network-manifest.json written
RUN_COUNT=$((RUN_COUNT + 1))
if (
  FIREWALL_DEVCONTAINER_DIR="$case_dir"
  # shellcheck source=../templates/firewall-lib.sh
  source "$TEMPLATES_DIR/firewall-lib.sh"
  firewall_collect_domains
) 2>/dev/null; then
  echo "FAIL: missing manifest file — expected firewall_collect_domains to return non-zero" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# --- missing network-manifest-domains.sh helper entirely: returns non-zero, does not exit the caller ---
case_dir="$TMP_DIR/case-missing-helper"
mkdir -p "$case_dir"
printf '%s' "$BASELINE_MANIFEST" > "$case_dir/network-manifest.json"
# deliberately no network-manifest-domains.sh copied in
RUN_COUNT=$((RUN_COUNT + 1))
if (
  FIREWALL_DEVCONTAINER_DIR="$case_dir"
  # shellcheck source=../templates/firewall-lib.sh
  source "$TEMPLATES_DIR/firewall-lib.sh"
  firewall_collect_domains
) 2>/dev/null; then
  echo "FAIL: missing network-manifest-domains.sh — expected firewall_collect_domains to return non-zero" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo "$RUN_COUNT assertions, $FAIL_COUNT failed"
[ "$FAIL_COUNT" -eq 0 ]
