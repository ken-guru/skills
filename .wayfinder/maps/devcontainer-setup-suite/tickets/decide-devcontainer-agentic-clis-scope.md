---
id: decide-devcontainer-agentic-clis-scope
title: Decide devcontainer-agentic-clis's exact scope and content, and write it
status: open
type: grilling
assignee: null
blocked_by: [scaffold-suite-root, decide-retrofit-mechanism]
created: 2026-08-10
---

## Question

Source content: PR #56's `MCP-MULTI-CLI-WIRING.md` plus `templates/mcp/*`
(staged-install-handshake-atomic-swap.sh.template,
mcp-handshake-template.mjs, per-cli-mcp-config-checklist.md). Covers:
installing the agentic CLI binaries themselves (npm prefix note — cross-
check against whatever `devcontainer-scaffold` ends up doing generically
for npm, since that gotcha's root cause is generic but the fix might now
live in two places), stage/verify/atomic-swap for MCP servers,
version-skew trap, per-CLI config-location comparison table, and — most
load-bearing for the retrofit requirement — the vendor-API-domains
checklist item that patches into `devcontainer-firewall`'s allowed-domains
manifest.

This is the other half of the allowed-domains hand-off flagged as fog on
the map; resolving this ticket and
[decide-devcontainer-firewall-scope](decide-devcontainer-firewall-scope.md)
together (or at least in awareness of each other) is expected to settle
that fog.

Write `skills/devcontainer-setup/devcontainer-agentic-clis/SKILL.md` plus
its templates, to `/writing-for-agents` standards.

## Resolution

(pending)
