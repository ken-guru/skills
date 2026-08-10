---
id: decide-devcontainer-firewall-scope
title: Decide devcontainer-firewall's exact scope and content, and write it
status: open
type: grilling
assignee: null
blocked_by: [scaffold-suite-root, decide-retrofit-mechanism]
created: 2026-08-10
---

## Question

Source content: PR #56's `NETWORK-FIREWALL.md` plus
`templates/firewall/*` (init-firewall.sh.template,
refresh-allowlist.sh.template, allowed-domains.manifest.example.json,
domains-from-manifest.sh.template). Covers: self-bootstrapping
deny-by-default allowlist, fail-open bootstrap ordering, CDN-rotation
refresh loop, small-stable-pool vs. large-rotating-pool distinction,
IPv6-in-CIDR-array gotcha, read-only bind-mount gotcha, desktop-runtime
host-bridge gotcha, manifest-derived domain lists.

This module is the declared **owner** of the allowed-domains manifest per
[cross-cutting-conventions](cross-cutting-conventions.md) — decide the
concrete interface `devcontainer-agentic-clis` will patch vendor-API
domains through (still fog per the map's "Not yet specified" until this
resolves). Apply
[decide-retrofit-mechanism](decide-retrofit-mechanism.md)'s answer for how
this module adds `NET_ADMIN`/`NET_RAW` and its init script to a Target
Devcontainer it may not have scaffolded.

Write `skills/devcontainer-setup/devcontainer-firewall/SKILL.md` plus its
templates, to `/writing-for-agents` standards.

## Resolution

(pending)
