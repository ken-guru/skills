---
id: skill-suite-structure-and-naming
title: "Decide Skill Suite structure: focused installation, orchestrator, module boundaries & naming"
status: closed
type: grilling
assignee: claude
blocked_by: []
created: 2026-08-10
closed: 2026-08-10
---

## Question

Breadth-first: what does this Skill Suite's shape need to be before
individual module tickets can be written precisely? Specifically —

1. Does devcontainer-setup consciously support installing/invoking one
   member Skill independently ("focused installation"), given the repo's
   own restructuring spec (`docs/specs/repository-restructure.md` §6, §13)
   treats that as a *deferred-complexity trigger*, and Presentation (the
   only existing Skill Suite) currently supports whole-suite-only
   distribution?
2. Does this suite need a `build-presentation`-style orchestrator Skill?
3. How many Add-on Skills, and where do the boundary lines fall between
   PR #56's six existing topic docs?
4. What naming convention do the member Skill directories follow?

## Resolution

1. **Focused installation: deliberately supported.** devcontainer-setup's
   entire reason for being a suite is that pieces apply independently to a
   pre-existing Target Devcontainer. This is a conscious divergence from
   Presentation's whole-suite-only distribution contract, and a conscious
   trip of the named deferred-complexity trigger in
   `docs/specs/repository-restructure.md` §13. Hard to reverse, surprising
   without context, and the result of a real trade-off — **needs its own
   ADR** once the suite directory exists (owed by
   [scaffold-suite-root](scaffold-suite-root.md)).

2. **No mandatory orchestrator.** Every member Skill, including the
   Scaffolding Skill, must be fully self-sufficient and directly
   invocable — required anyway once focused installation is real. An
   orchestrator convenience wrapper for the "everything from scratch"
   happy path could exist later but isn't required now; tracked as fog in
   the map's "Not yet specified."

3. **Six members, ~1:1 with PR #56's existing docs:**
   - `devcontainer-scaffold` — the Scaffolding Skill. From
     `BUILD-ORDERING-CAPABILITIES.md` + `Dockerfile.skeleton` +
     `docker-compose.skeleton.yml`.
   - `devcontainer-firewall` — from `NETWORK-FIREWALL.md` + firewall
     templates.
   - `devcontainer-agentic-clis` — from `MCP-MULTI-CLI-WIRING.md` + mcp
     templates. Bundles agentic CLI binary installation (npm prefix, etc.)
     together with MCP server wiring, matching the user's own phrase
     "agentic coding clis" as one add-on.
   - `devcontainer-cli-lifecycle` — from `CLI-LIFECYCLE-AGE-GATING.md` +
     cli-lifecycle templates.
   - `devcontainer-git-auth` — from `SSH-DUAL-KEY-SIGNING.md`, expanded;
     see
     [git-auth-scope-and-pr56-disposition](git-auth-scope-and-pr56-disposition.md).
   - `devcontainer-dx-niceties` — from `DX-AND-DATABASE-NICETIES.md`.

4. **Naming: `devcontainer-<aspect>`.** Suite name (`devcontainer`) stays
   the stable prefix; reads clearly in a flat skills list or plugin
   picker. (Rejected: `<verb>-devcontainer` mirroring Presentation exactly
   — reads worse for non-verb aspects like firewall or dx-niceties.)
