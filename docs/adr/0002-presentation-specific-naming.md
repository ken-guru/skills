# ADR-0002: Presentation-Specific Skill Naming and Orchestrator Role

**Status:** Proposed  
**Date:** 2026-05-26

## Context

The refactored phase skills and orchestrator need clear, discoverable names. The skills are intentionally generic (discovery, structure, generation work for any content project), but presentations are the primary use case for the foreseeable future.

## Decision

Use presentation-specific names:
- `discover-presentation`
- `structure-agenda`
- `generate-slides`
- Keep `build-presentation` as the orchestrator

This makes the current use case immediately obvious and discoverable, while keeping the internal implementation generic enough to support other project types later.

## Alternatives considered

### A) Generic names
- `discover-project`, `structure-content`, `generate-content`, `orchestrate`
- Pro: Signals reusability; easier to rename/reuse for other projects
- Con: Less clear what the skills do; adds cognitive overhead now

### B) **Presentation-specific names (chosen)**
- `discover-presentation`, `structure-agenda`, `generate-slides`, `build-presentation`
- Pro: Clear, focused, discoverable; matches current primary use case
- Con: May need renaming if other project types become equally important

## Consequences

- When other project types (e.g., documentation, PRDs) are added, they will have their own orchestrator skills (`build-documentation`, `build-prd`, etc.) that coordinate the same generic phase skills
- The phase skills themselves remain type-agnostic; type-specific logic lives in the orchestrator and in type-specific templates/defaults
- Users will discover multiple orchestrator skills rather than a single generic one with a `--type` parameter (simpler than conditional logic, clearer intent)

## Rationale

Presentations are the dominant use case. Naming should reflect that clarity. Generic internal architecture allows adding new project types without breaking changes; new orchestrators are additive, not disruptive.
