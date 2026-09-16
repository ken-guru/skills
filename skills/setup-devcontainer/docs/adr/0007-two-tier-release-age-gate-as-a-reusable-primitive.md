# ADR-0007: Two-tier Release Age Gate, built as a reusable primitive from the start

**Status:** Accepted
**Date:** 2026-09-16

## Context

A Wayfinder map (issue #299) set out to decide `skills/setup-devcontainer`'s remaining extension
points after a field stress-test against `the-words-are-snake`. One request — a minimum-release-age
gate on CLI installs, modeled on that sibling repo's own ADR-0029/ADR-0030 — was deferred pending
research, since none of the four CLI companion skills (Claude Code, Codex, Antigravity, Copilot CLI)
install via npm, ruling out the sibling's npm-`time`-metadata-based mechanism directly.

Research (issue #309) confirmed a dateable release feed exists for all four CLIs (each vendor's
GitHub Releases `published_at`), but found the correlation between that feed and what each
installer actually fetches varies sharply, and — critically — that only two of the four installers
(Codex, Copilot CLI) support pinning to a specific, older version at all. Claude Code's and
Antigravity's installers only ever fetch "whatever's currently latest" from their own vendor
CDN/manifest; there is no version parameter to request an older, age-eligible release instead.

Separately, resolving this decision (issue #310) surfaced a scoping question: `the-words-are-snake`'s
own gating need originally covered MCP servers (context7, playwright) as well as CLI installs — but
MCP servers are project-owned tooling (driven by a project's own `.mcp.json`), not something
`setup-devcontainer` generates or manages for any project. Bringing MCP-server gating fully in scope
would mean `setup-devcontainer` learning about arbitrary, per-project MCP servers — a materially
different, larger feature than gating four known, universal CLI installs.

## Decision

**Two-tier gating**, not a single uniform mechanism: Codex and Copilot CLI get a full gate — find the
newest release at least `minimumReleaseAgeDays` old and install that, or hold at "not installed yet"
if no eligible release is found, matching the sibling repo's own fail-safe posture ("absence of
proof of age is treated as insufficient age"). Claude Code and Antigravity get a weaker gate, the
only one their installers' capabilities allow — proceed with the normal install only if "latest" is
already old enough, otherwise skip installing that CLI this run. Both tiers are documented as such in
the Release Age Manifest, not glossed over as equivalent guarantees.

**A new base-owned Release Age Manifest** (`CONTEXT.md`), parallel to the Network Manifest: each CLI
Skill that has a gate declares its own `minimumReleaseAgeDays` and `versionCheck` source. Unlike the
Network Manifest, entries are object-shaped, not array-appended — `patch-json-array-if-absent.sh`
doesn't fit as-is; implementation needs an object-merge sibling primitive.

**The Release Age Gate is built as a standalone, reusable primitive from the start** — not folded
exclusively into `install_cli()`, which only a CLI Skill's own install-block.sh calls. This is the
one deliberate scope expansion: a project's own hand-written scripts (e.g. installing its own MCP
servers) can call the same fail-safe age-check logic directly, for their own needs, without
`setup-devcontainer` itself generating, owning, or knowing about that project-owned thing.
`setup-devcontainer`'s own concern stays exactly what it already is — gating the four CLI installs it
already owns — but the mechanism it builds to do that is shaped so a project isn't left to
reimplement the same fail-safe logic from scratch for its own out-of-scope needs.

## Alternatives considered

### A) Gate only Codex and Copilot CLI, leave Claude Code and Antigravity ungated (rejected)

- Pro: simpler — no weaker-tier caveat to document or maintain, no risk of the two tiers being
  confused as equivalent.
- Con: leaves half the four CLIs with zero supply-chain protection, despite a real (if imperfect)
  gate being buildable for them. Real, documented, unequal protection was judged better than no
  protection for two of the four.

### B) `setup-devcontainer` generates and owns MCP-server install/gate scripts directly (rejected)

- Pro: would have delivered `the-words-are-snake`'s original ask in full, matching the sibling
  repo's own scope exactly.
- Con: MCP servers are per-project (context7/playwright are specific to one repo, not universal like
  the four CLIs) and driven by a project's own `.mcp.json` — `setup-devcontainer` would need to learn
  about arbitrary project-specific MCP servers to generate lifecycle scripts for them, a materially
  bigger feature than gating four known installs, and a real reversal of this skill's existing
  boundary (it doesn't generate or manage project-specific tooling anywhere else either).

## Consequences

- A new `templates/release-age-manifest.json` (base-owned, seeded per CLI Skill as each is
  installed, same pattern as the Network Manifest).
- A new object-merge patch primitive alongside `patch-if-absent.sh` and
  `patch-json-array-if-absent.sh`.
- The Release Age Gate's own implementation (the actual GitHub API calls, version selection,
  fail-safe hold logic) is a follow-up effort — this decision fixes the shape, not the code.
- `setup-devcontainer` still never touches `.mcp.json` or generates MCP-server lifecycle scripts;
  a project wanting the Release Age Gate for its own MCP servers writes and owns that call itself,
  the same way it already owns any other Project-Owned Block.
