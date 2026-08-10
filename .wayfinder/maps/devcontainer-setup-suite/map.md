---
label: wayfinder:map
title: Restructure devcontainer-setup into a Skill Suite
tracker: local-markdown
created: 2026-08-10
---

## Destination

Restructure `devcontainer-setup` from a single Standalone Skill (PR #56 on
`ken-guru/skills`) into a **devcontainer-setup Skill Suite** under
`skills/devcontainer-setup/`: one Scaffolding Skill for a barebones
devcontainer plus independently-invocable Add-on Skills (agentic CLI
installs, network firewall, MCP wiring, CLI lifecycle age-gating, SSH/gh
auth + deploy keys, DX niceties) that each retrofit onto a pre-existing
Target Devcontainer, written to `/writing-for-agents` standards, ready to
review as a PR that supersedes #56.

## Notes

- **This map carries execution**, overriding wayfinder's plan-only default.
  The user explicitly chose "restructured directory, ready to review" as
  the destination form — ticket resolutions are expected to produce real
  files, not just decisions on paper.
- Domain: this repo (`ken-guru/skills`) is a **Collection** of **Standalone
  Skills** and **Skill Suites** (root `CONTEXT.md`). Use these terms, not
  "skillset" — the Collection glossary explicitly lists it under _Avoid_.
- Suite-local terms coined for this effort (not yet written to any
  `CONTEXT.md` — the first ticket to touch `skills/devcontainer-setup/`
  should create that file and record them there):
  - **Scaffolding Skill** — the member Skill that assumes it owns the
    devcontainer's build definition from scratch.
  - **Add-on Skill** — any member Skill whose contract requires operating
    against a **Target Devcontainer** it doesn't assume it created.
  - **Target Devcontainer** — the devcontainer.json/Dockerfile/compose
    configuration a given Skill invocation acts on, whether the Scaffolding
    Skill created it or it pre-existed.
- Structural convention is fixed by `docs/specs/repository-restructure.md`
  §4-5 (already governs Presentation, the one existing Skill Suite):
  `skills/<suite>/<name>/SKILL.md` per member; suite root has `README.md`
  and no `SKILL.md`; one level of nesting; root `CONTEXT.md` has Collection
  terms, suite `CONTEXT.md` has suite-local terms, `CONTEXT-MAP.md` links
  them; root `README.md` has Skill Suites / Standalone Skills tables.
- Reference implementation with real, already-made decisions: a sibling
  devcontainer setup at
  `/Users/ken/Workspace/ken-guru/the-words-are-snake/devcontainer-setup`
  (this session's other working directory). Particularly load-bearing for
  the git-auth Add-on Skill's scope.
- Skills every session should consult: `/writing-for-agents` (the quality
  bar every module's SKILL.md and docs must meet), `/grilling` +
  `/domain-modeling` (for every scope-decision ticket below), `/research`
  (for the one research ticket).
- PR #56 (`ken-guru/skills`) is superseded by this effort and is being
  closed directly (not via a ticket — fully decided, unblocks nothing
  downstream, pure cleanup).

## Decisions so far

- [Name the destination and correct terminology](tickets/name-destination-and-terminology.md) — destination is a restructured, ready-to-review Skill Suite superseding PR #56; "skillset" → "Skill Suite" per the Collection's own glossary.
- [Decide Skill Suite structure: focused installation, orchestrator, module boundaries & naming](tickets/skill-suite-structure-and-naming.md) — six members (`devcontainer-scaffold`, `devcontainer-firewall`, `devcontainer-agentic-clis`, `devcontainer-cli-lifecycle`, `devcontainer-git-auth`, `devcontainer-dx-niceties`); focused installation deliberately supported (diverges from Presentation, needs an ADR); no mandatory orchestrator.
- [Decide cross-cutting conventions: artifact ownership + retrofit contract](tickets/cross-cutting-conventions.md) — narrowest-owner principle for shared artifacts (e.g. firewall owns the allowed-domains manifest, others patch into it); general Add-on Skill contract: detect what you need, add only what's missing, never touch what you don't own.
- [Decide git-auth scope and PR #56 disposition](tickets/git-auth-scope-and-pr56-disposition.md) — "deploy key" is corrected terminology for PR #56's existing transport key, not new scope; `gh` CLI API auth via `GH_TOKEN`/`.env` is genuinely new scope, folded into `devcontainer-git-auth`; PR #56 closes now as superseded.

## Not yet specified

- **Optional orchestrator convenience wrapper.** Not required by the
  destination (every member Skill must be self-sufficient regardless), but
  once the six member Skills exist it may become clear users want a guided
  "set up everything from scratch" happy path, mirroring
  `build-presentation`. Revisit after the member Skills exist, not before —
  premature to design now.
- **Concrete shape of the allowed-domains-manifest hand-off** between
  `devcontainer-firewall` (owner) and `devcontainer-agentic-clis` (patches
  in vendor-API domains). The narrowest-owner *principle* is decided; the
  exact interface (a documented file format `devcontainer-agentic-clis`
  writes to, vs. instructions telling the user to run a firewall-owned
  script) isn't sharp yet — expected to fall out naturally once both
  module-scope tickets resolve, not before.

## Out of scope

(none yet)
