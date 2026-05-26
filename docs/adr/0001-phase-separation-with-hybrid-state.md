# ADR-0001: Phase Separation with Hybrid File-Based State Management

**Status:** Proposed  
**Date:** 2026-05-26

## Context

The original `build-presentation` skill bundled three distinct phases (Discovery → Structure → Generation) into a single monolithic workflow. This creates two problems:

1. **Token waste** — users cannot run just one phase in isolation; they pay for the full conversation context even if they only want to refine an agenda
2. **Inflexibility** — users cannot iterate on a single phase without re-running earlier phases

## Decision

Split the workflow into three independent phase skills:
- `discover-presentation`
- `structure-agenda`
- `generate-slides`

Each skill reads and writes persistent state to files in the project folder (DISCOVERY.json, AGENDA.md, PROJECT.json, etc.). An orchestrator skill (`build-presentation`) calls them sequentially and detects project state to offer users the next logical step.

## Alternatives considered

### A) Monolithic (current state)
- Pro: Simple, single entrypoint
- Con: Forces full conversation context every time; no partial iteration; high token waste

### B) Pure stateless context passing
- Pro: No file I/O; skills are fully self-contained
- Con: Orchestrator must manage and pass all state; difficult to resume mid-workflow or call skills independently

### C) **Hybrid file-based (chosen)**
- Pro: Skills work independently; state persists; users can resume or skip phases
- Con: File I/O overhead; requires careful state schema management

## Consequences

- Each skill must implement startup checks (or call a shared validation module) to ensure environment is ready (e.g., `marp` CLI installed)
- Project folder becomes the source of truth; users must not manually delete or corrupt state files between calls
- Skills can be called in any order, but orchestrator guides the "happy path" (discovery → structure → generation)
- Future project types (documentation, PRDs, etc.) can reuse the same phase skills with type-specific orchestrators

## Rationale

Option C enables the primary goal: iterative refinement of individual phases without re-running earlier work. The file-based state is durable across sessions and supports the "resume mid-workflow" use case.
