---
id: decide-devcontainer-dx-niceties-scope
title: Decide devcontainer-dx-niceties's exact scope and content, and write it
status: open
type: grilling
assignee: null
blocked_by: [scaffold-suite-root, decide-retrofit-mechanism]
created: 2026-08-10
---

## Question

Source content: PR #56's `DX-AND-DATABASE-NICETIES.md` (host-sleep
prevention via `initializeCommand`, symlink-bridging for config-directory
wipe-vs-persist disagreements, statusline, database
`condition: service_healthy` healthchecks, gitignored `.env` +
`.env.example` pattern, bind-mounting a host CLI's existing auth dotfile).

Check for overlap with `devcontainer-git-auth`'s `GH_TOKEN`/`.env` scope
(flagged in that ticket) — this module documents the *general*
gitignored-`.env`-for-secrets pattern; decide whether `GH_TOKEN`
specifically stays purely an instance `devcontainer-git-auth` documents,
or whether this module's `.env.example` guidance needs to explicitly
reference it as a worked example.

Some niceties here (bind-mounting a host CLI's auth dotfile, symlink
bridging) are inherently retrofit-relevant — apply
[decide-retrofit-mechanism](decide-retrofit-mechanism.md)'s answer.

Write `skills/devcontainer-setup/devcontainer-dx-niceties/SKILL.md` plus
its templates, to `/writing-for-agents` standards.

## Resolution

(pending)
