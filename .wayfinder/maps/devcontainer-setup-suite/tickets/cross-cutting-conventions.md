---
id: cross-cutting-conventions
title: "Decide cross-cutting conventions: artifact ownership + retrofit contract"
status: closed
type: grilling
assignee: claude
blocked_by: []
created: 2026-08-10
closed: 2026-08-10
---

## Question

Two conventions need to be fixed before individual module-scope tickets
can be written without re-litigating them each time:

1. Some artifacts are touched by more than one Add-on Skill (e.g. the
   allowed-domains manifest: `devcontainer-firewall` owns the mechanism,
   `devcontainer-agentic-clis` needs to add each CLI's vendor-API domains
   to it too; compose capability blocks: `NET_ADMIN`/`NET_RAW` are needed
   by firewall's logic but live in a file firewall doesn't otherwise own).
   How should the suite handle this, given the Collection's own glossary
   already defines "Artifact Owner" as the narrowest scope whose
   responsibility fully explains why something exists?
2. Every Add-on Skill retrofits onto a Target Devcontainer it may not have
   created. What's the general contract for how it behaves when something
   it needs (a non-root user, a capability, a config block) may or may not
   already be present?

## Resolution

1. **One narrow owner per artifact; others patch into it.** E.g.
   `devcontainer-firewall` owns the allowed-domains manifest file and
   format; `devcontainer-agentic-clis`'s job is to *add entries* to it
   (documented as a dependency on `devcontainer-firewall`'s format), not
   co-own it. This matches the Collection's existing Artifact Owner
   principle exactly — no new suite-level exception needed, and no
   suite-wide shared `docs/` dumping ground the way Presentation uses for
   genuinely suite-owned state schema docs. The exact interface for the
   allowed-domains hand-off specifically is still fog (see map's "Not yet
   specified") — the principle is settled, the concrete shape isn't yet.

2. **General retrofit contract, adopted verbatim:** "detect what you
   specifically need in the Target Devcontainer, create/add only what's
   missing, and never modify or remove something already there that you
   don't own." This generalizes the non-root-user answer (each Add-on
   Skill must detect and create a non-root user if none exists, rather
   than assuming the Scaffolding Skill already ran) to cover everything an
   Add-on Skill might touch — capabilities, config blocks, files, not just
   the user case. Every Add-on Skill's scope-decision ticket cites this
   contract rather than re-deciding it.

   Note: this settles the *contract*, not the *mechanism* — whether
   detection happens via filesystem inspection, a suite-authored state
   file, or a hybrid, and whether changes land via editing
   Dockerfile/compose directly or via devcontainer.json lifecycle hooks,
   is the separate, still-open
   [decide-retrofit-mechanism](decide-retrofit-mechanism.md) ticket.
