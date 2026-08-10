---
id: name-destination-and-terminology
title: Name the destination and correct terminology
status: closed
type: grilling
assignee: claude
blocked_by: []
created: 2026-08-10
closed: 2026-08-10
---

## Question

What is this map finding its way to — precisely enough to fix scope — given
the user's loose idea of "dial back" PR #56 or rebuild it as a
"skillset" like the presentation suite, with a barebones devcontainer
first and agentic-CLI/firewall/security/gh-auth as add-ons, including
retrofit onto a pre-existing devcontainer?

## Resolution

Destination confirmed as:

> Restructure devcontainer-setup from a single Standalone Skill (PR #56)
> into a devcontainer-setup Skill Suite under skills/devcontainer-setup/:
> one Scaffolding Skill for a barebones devcontainer plus
> independently-invocable Add-on Skills (agentic CLI installs, network
> firewall, MCP wiring, CLI lifecycle age-gating, SSH/gh auth + deploy
> keys, DX niceties) that each retrofit onto a pre-existing Target
> Devcontainer, written to writing-for-agents standards, ready to review
> as a PR that supersedes #56.

Destination form: a restructured skill directory, ready to review (not
just a decision doc) — this map carries execution, an explicit override
of wayfinder's plan-only default.

The "trim in place vs. restructure" framing from the original loose idea
is resolved: restructuring into a Skill Suite is decided, not competing;
`/writing-for-agents` becomes the quality bar applied to each resulting
module rather than an alternative path.

Terminology correction (repo's own Collection glossary, `CONTEXT.md`):
the canonical term is **Skill Suite**, not "skillset" — the glossary
explicitly lists "skillset" under _Avoid_. Adopted throughout the map.

Retrofit-onto-a-pre-existing-devcontainer is a **hard requirement** for
Add-on Skills specifically (CLI installs, firewall, MCP wiring,
auth/deploy-keys) — they must not assume they own the whole Dockerfile
from scratch. The Scaffolding Skill is the one exception, since scaffolding
from scratch inherently assumes more control.

This effort **supersedes PR #56** (see
[git-auth-scope-and-pr56-disposition](git-auth-scope-and-pr56-disposition.md)
for the closure decision).
