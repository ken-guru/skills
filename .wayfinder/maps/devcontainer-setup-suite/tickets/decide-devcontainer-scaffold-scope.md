---
id: decide-devcontainer-scaffold-scope
title: Decide devcontainer-scaffold's exact scope and content, and write it
status: open
type: grilling
assignee: null
blocked_by: [scaffold-suite-root]
created: 2026-08-10
---

## Question

`devcontainer-scaffold` is the Scaffolding Skill — the one member that
assumes it owns the devcontainer's build definition from scratch, so it
does NOT need [decide-retrofit-mechanism](decide-retrofit-mechanism.md)
resolved first (no retrofit ambiguity: it's always building fresh).

Source content to redistribute: PR #56's `BUILD-ORDERING-CAPABILITIES.md`,
`templates/build/Dockerfile.skeleton`,
`templates/build/docker-compose.skeleton.yml`. Covers: build-time vs.
runtime-firewalled ordering, floating-base-image-tag trap,
scripting-runtime-for-the-agent gotcha, capability scoping
(`NET_ADMIN`/`NET_RAW`/`SYS_ADMIN`), non-root user creation with
mkdir+chown volume pairing, the nested-volume-under-bind-mount gotcha, npm
global-install prefix, Debian login-shell `PATH` reset, and the Compose
project-name collision fix.

Decide: does this module also need to seed the *hooks* other Add-on
Skills will need (e.g. a `postCreateCommand`/`postStartCommand` chain
structure they can append to), even though this module doesn't itself
retrofit? Write `skills/devcontainer-setup/devcontainer-scaffold/SKILL.md`
plus its templates, to `/writing-for-agents` standards, per this map's
Notes (execution is in scope, not just a decision).

## Resolution

(pending)
