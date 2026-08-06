# ADR-0003: Smart Orchestrator with State Detection and Resilient Error Recovery

**Status:** Accepted  
**Date:** 2026-05-26

## Context

With three independent phase skills (`discover-presentation`, `structure-agenda`, `generate-slides`), there needs to be a way to coordinate them into a full workflow. Two design questions arose:

1. **Orchestrator intelligence:** How much logic should `build-presentation` contain?
2. **Error recovery:** How should phase skills behave when things go wrong mid-workflow?

## Decisions

### Orchestrator: Smart (state-aware)

`build-presentation` inspects the project folder at startup and infers what has already been done by reading `PROJECT.json` and checking for `AGENDA.md` and `PRESENTASJON.html`. It routes the user to the appropriate next step rather than requiring them to know which skill to call.

It also displays estimated token cost for each available operation before executing.

### Error recovery conventions

| Scenario | Behaviour |
|----------|-----------|
| Proposed agenda change exceeds discovered duration | `structure-agenda` warns and presents options (split, extend, remove); waits for user choice |
| Source URL fetch fails during generation | `generate-slides` collects all failures and reports at the end; does not halt |
| User re-runs discovery on existing project | Orchestrator asks: keep existing agenda or start fresh |

## Alternatives considered

### Thin orchestrator
- User is responsible for calling `discover-presentation`, `structure-agenda`, `generate-slides` in order
- Pro: Less logic in the orchestrator; each skill is truly independent
- Con: Poor UX — users must remember state and order; easy to accidentally overwrite work

### Halt-on-error for source fetching
- `generate-slides` stops when any source URL fails
- Pro: Explicit; user always knows about failures immediately
- Con: One broken URL halts an entire generation run; source quality is often outside the user's control

## Consequences

- `build-presentation` must read `PROJECT.json` to detect phase state; if the file is missing or corrupt, it falls back to "nothing started"
- Phase skills remain independently callable — the orchestrator's state detection is additive, not required for individual skill use
- Source fetch failures are surfaced in the final report; the user decides whether to fix links and regenerate
- Scope warnings during agenda refinement require user input before `structure-agenda` writes any changes — it cannot silently alter a presentation's duration

## Rationale

The smart orchestrator reduces cognitive load without removing the ability to call skills directly. Token cost hints let users make informed choices about which operations are expensive. Resilient source fetching avoids blocking presentation creation over external dependencies.
