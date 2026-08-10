---
id: decide-devcontainer-cli-lifecycle-scope
title: Decide devcontainer-cli-lifecycle's exact scope and content, and write it
status: open
type: grilling
assignee: null
blocked_by: [scaffold-suite-root, decide-retrofit-mechanism]
created: 2026-08-10
---

## Question

Source content: PR #56's `CLI-LIFECYCLE-AGE-GATING.md` plus
`templates/cli-lifecycle/*` (manifest.example.json,
age-gate-check.example.sh). Covers: minimum-release-age gating,
fail-safe-on-uncertainty, registry-package vs. pinned-release vs.
self-updating distribution channels, the `ARG_MAX` trap for large
registry responses, probe-the-real-operation health checks.

Decide whether this module's manifest (per-tool update policy) is a
separate file from `devcontainer-agentic-clis`'s installed-CLI list, or
whether the two should be unified (both are "facts about which agentic
CLIs are installed in this Target Devcontainer") — this is a real
artifact-ownership question the
[cross-cutting-conventions](cross-cutting-conventions.md) principle
(narrowest owner) should resolve directly once this module's boundary
against `devcontainer-agentic-clis` is examined concretely, but wasn't
explicitly checked during charting.

Write `skills/devcontainer-setup/devcontainer-cli-lifecycle/SKILL.md`
plus its templates, to `/writing-for-agents` standards.

## Resolution

(pending)
