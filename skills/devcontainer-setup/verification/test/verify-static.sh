#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
EVIDENCE_DIR=$(mktemp -d)
trap 'rm -rf "$EVIDENCE_DIR"' EXIT

bash "$ROOT/verification/verify.sh" --static --evidence-dir "$EVIDENCE_DIR"

test -s "$EVIDENCE_DIR/summary.txt"
test -s "$EVIDENCE_DIR/results.jsonl"
grep -q 'PASS' "$EVIDENCE_DIR/summary.txt"
grep -q 'scaffold-npm-global-path' "$EVIDENCE_DIR/results.jsonl"
grep -q 'firewall-preserves-docker-nat' "$EVIDENCE_DIR/results.jsonl"
grep -q 'agentic-installs-as-runtime-user' "$EVIDENCE_DIR/results.jsonl"
grep -q 'dx-statusline-is-persistent' "$EVIDENCE_DIR/results.jsonl"
