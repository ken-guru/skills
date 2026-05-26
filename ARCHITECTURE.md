# Architecture Refactor Plan

**Date:** 2026-05-26  
**Status:** Ready for implementation

## Current State

```
skills/build-presentation/
├── SKILL.md           (monolithic entry point)
├── PHASES.md          (all 3 phases bundled)
├── DEFAULTS.md
├── QUALITY.md
└── SCAFFOLD.md
```

## Proposed Architecture

```
skills/
├── CONTEXT.md                      (domain glossary)
├── docs/adr/
│   ├── 0001-phase-separation-with-hybrid-state.md
│   └── 0002-presentation-specific-naming.md
├── shared/                         (new)
│   ├── validation.md               (environment checks for all skills)
│   └── state-schema.md             (DISCOVERY.json, PROJECT.json, etc.)
├── build-presentation/             (orchestrator - REFACTORED)
│   ├── SKILL.md                    (smart entry point, state detection)
│   ├── ORCHESTRATION.md            (state machine, flow chart)
│   └── TEMPLATES.md                (defaults and templates by type)
├── discover-presentation/          (phase 1 - NEW)
│   ├── SKILL.md
│   ├── QUESTIONS.md
│   └── DEFAULTS.md
├── structure-agenda/               (phase 2 - NEW)
│   ├── SKILL.md
│   ├── ITERATION.md
│   └── GLOSSARY.md
└── generate-slides/                (phase 3 - NEW)
    ├── SKILL.md
    ├── SOURCES.md                  (fetching & summarizing)
    ├── QUALITY.md                  (validation rules)
    └── SCAFFOLD.md                 (templates for PRESENTASJON.md, HTML)
```

## Phase Skill Responsibilities

### `discover-presentation`
- **Input:** Project folder path, optional existing DISCOVERY.json
- **Output:** DISCOVERY.json, PROJECT.json, ready state
- **State files created:** DISCOVERY.json, PROJECT.json
- **Validation:** Calls shared validation module

### `structure-agenda`
- **Input:** Project folder path, DISCOVERY.json (required)
- **Output:** AGENDA.md, glossary section
- **State files created/updated:** AGENDA.md
- **Validation:** Calls shared validation module, checks DISCOVERY.json exists
- **Error handling:** Warns on scope creep (e.g., "Adding this slide extends duration to 90 min"), offers reconciliation options

### `generate-slides`
- **Input:** Project folder path, AGENDA.md (required)
- **Output:** PRESENTASJON.md, PRESENTASJON.html, docs/sources/
- **State files created/updated:** PRESENTASJON.md, PRESENTASJON.html, docs/sources/*.md
- **Validation:** Calls shared validation module, checks marp CLI, checks AGENDA.md exists
- **Error handling:** Collects all source-fetch failures, reports at end (doesn't halt)

## Orchestrator (`build-presentation`) Responsibilities

1. **Startup checks**
   - Call shared validation module (marp installed, folder writable, etc.)
   - Abort with clear instructions if any check fails

2. **State detection**
   - Check if DISCOVERY.json exists → discovery done?
   - Check if AGENDA.md exists → structure done?
   - Check if PRESENTASJON.html exists → generation done?

3. **User guidance**
   - If nothing exists: "Start fresh?"
   - If discovery only: "Refine agenda or re-do discovery?"
   - If discovery + agenda: "Generate slides or keep iterating agenda?"
   - etc.

4. **Optional: Token cost estimation**
   - Display estimated token usage for each option

5. **Sequential invocation**
   - Call phase skills in order based on user choice
   - Pass PROJECT.json path to each skill

## Shared Module

**Location:** `shared/validation.md`

Defines the validation contract all skills call:

```
validate_environment():
  - check marp CLI installed
  - check PROJECT folder writable
  - check node/npm available (if needed)
  returns: { ok: bool, errors: [string], warnings: [string] }
```

Each skill calls this at startup and aborts if `ok === false`.

## State Schema

**Location:** `shared/state-schema.md`

Defines the exact shape of:
- **DISCOVERY.json** — user inputs (topic, audience, duration, language, occasion, project folder)
- **PROJECT.json** — metadata (projectType, createdDate, discoveredSettings, generationOptions, phases: {discovery, structure, generation})
- **AGENDA.md** — structure from Phase 2
- All paths and naming conventions

## Migration Path

1. **Extract phase logic** — move PHASES.md sections into separate SKILL.md files for each phase
2. **Create shared module** — consolidate environment checks
3. **Refactor orchestrator** — implement state detection + routing logic
4. **Test each skill independently** — ensure they work in isolation
5. **Update SKILL.md** — update entry points, add `.instructions.md` for each skill
6. **Deprecate old structure** — mark old `build-presentation/SKILL.md` as archived

---

## Decision Summary

| Question | Answer |
|----------|--------|
| **Q1: Domain abstraction** | Generic reusable pipeline, presentations primary use case (Option B) |
| **Q2: Project scope** | Presentations + future content types; questions mostly same, outputs vary |
| **Q3: State management** | Hybrid file-based (Option C) — skills read/write, orchestrator routes |
| **Q4: Orchestrator design** | Smart orchestrator with state detection & token cost hints (Option B) |
| **Q5: Error recovery** | Scenario-specific: warn on scope creep, collect source failures, explicit re-discovery choice |
| **Q6: Naming** | Presentation-specific names (Option B) for clarity now + generic internals for future |

---

## Next Steps

1. ✅ Capture architecture (this document)
2. Create `discover-presentation/SKILL.md` by extracting from `PHASES.md` Phase 1
3. Create `structure-agenda/SKILL.md` by extracting from `PHASES.md` Phase 2
4. Create `generate-slides/SKILL.md` by extracting from `PHASES.md` Phase 3
5. Create shared validation module
6. Refactor `build-presentation/SKILL.md` as orchestrator
7. Define state schema (DISCOVERY.json, PROJECT.json shapes)
