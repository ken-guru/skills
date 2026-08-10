# Focused installation is a supported path for devcontainer-setup

**Status:** Accepted
**Date:** 2026-08-10

## Context

`docs/specs/repository-restructure.md` §6 makes "the complete suite" the
only supported distribution unit for Presentation, the Collection's first
Skill Suite: installers may expose individual member selection, but
focused (single-member) installation is explicitly not documented or
tested as a product guarantee. §13 lists "focused installation" — a real
distribution path promising one member independently — as a
deferred-complexity trigger: a deliberately unbuilt capability, opened only
when a real need shows up.

devcontainer-setup's own reason for existing as a suite, rather than
staying one large Standalone Skill, is that its Add-on Skills (firewall,
agentic-CLI installs, MCP wiring, CLI lifecycle age-gating, git/SSH auth,
DX niceties) need to retrofit onto a Target Devcontainer this suite didn't
necessarily scaffold — including a devcontainer this suite had no hand in
creating at all. That's exactly a focused-installation use case: install
and invoke `devcontainer-firewall` alone against someone else's
hand-written devcontainer, with no expectation that any other member is
present.

## Decision

devcontainer-setup consciously trips the focused-installation trigger:
every member Skill is documented, tested, and supported as independently
installable and invocable, not only as part of the complete suite. This is
a deliberate divergence from Presentation's whole-suite-only distribution
contract, not an oversight or an unsupported side effect of how the
Skills happen to be built.

## Alternatives considered

**Whole-suite-only, matching Presentation exactly.** Individual Skills
would still live as suite members for organizational and ownership
reasons, but the documented, tested distribution path would remain "install
the complete suite." Retrofit onto an existing devcontainer would become an
unsupported side effect rather than a guarantee. Rejected because it
directly contradicts the requirement that motivated splitting this suite
into Add-on Skills in the first place — a Presentation-shaped suite that
can't be installed piecemeal would have no reason to be six Skills instead
of one.

## Consequences

- Every Add-on Skill's own SKILL.md must be genuinely self-sufficient: it
  cannot assume a sibling member ran first, only that it *might* have.
  Where one Skill's output feeds another (e.g. devcontainer-agentic-clis
  patching vendor-API domains into devcontainer-firewall's allowlist), that
  dependency must be handled as "if present, use it; if absent, note the
  gap" rather than assumed.
- Each Add-on Skill needs its own detection logic for what's already
  present in the Target Devcontainer (see the Retrofit Contract in
  [CONTEXT.md](../../CONTEXT.md)) rather than relying on suite-wide
  install-time state the way Presentation's Project Folder does.
- No mandatory orchestrator Skill exists for devcontainer-setup, unlike
  Presentation's `build-presentation`. An orchestrator convenience wrapper
  for the "set up everything from scratch" happy path could still be added
  later, but it cannot be the only entry point, since that would silently
  reintroduce whole-suite-only distribution through the back door.
