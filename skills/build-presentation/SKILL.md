---
name: build-presentation
description: Orchestrates the full presentation-building workflow. Detects project state and guides the user through discover-presentation → structure-agenda → generate-slides. Use when user wants to build a presentation, create slides, or mentions "presentation", "slides", "marp", "presentasjon", "bygg presentasjon", "lag presentasjon".
---

# Build Presentation (Orchestrator)

Coordinates the full presentation pipeline. Detects what has already been done and guides the user to the next step.

## Startup

Run validation checks per [../shared/validation.md](../shared/validation.md). Abort if any errors are returned.

## State detection

Read the project folder to determine current state per [../shared/state-schema.md](../shared/state-schema.md):

| State | Condition |
|-------|-----------|
| Nothing started | `PROJECT.json` missing |
| Discovery done | `PROJECT.json` exists, `phases.discovery.status == "done"` |
| Structure done | `AGENDA.md` exists, `phases.structure.status == "done"` |
| Generation done | `PRESENTASJON.html` exists, `phases.generation.status == "done"` |
| Proofread done | `phases.proofread.status == "done"` |

## User guidance (based on state)

### Nothing started
> "This looks like a new project. Would you like to start by gathering requirements? (discover-presentation)"

→ Call `discover-presentation`, then continue.

**Discovery exit criteria** before proceeding:
- [ ] `DISCOVERY.json` validated as JSON
- [ ] Persona identified with at least 3 of 4 depth dimensions (experience level, goal, concerns, takeaways)
- [ ] Duration and slide count estimated and confirmed by user
- [ ] Top 3 takeaways documented in `DISCOVERY.json`

### Discovery done, no agenda
> "Discovery is complete. Would you like to build the agenda now? (structure-agenda)"

Options:
- **Yes** — call `structure-agenda`
- **Redo discovery** — call `discover-presentation` again (warn: existing agenda will need revision)

**Agenda exit criteria** before proceeding to generation:
- [ ] User has chosen one of the 2–3 proposed structures (or a hybrid)
- [ ] All slides have a title and at least 3 content points
- [ ] The Glossary section is populated
- [ ] IMAGE_SPEC.md has been generated and approved by the user
- [ ] User has given explicit "approved" or equivalent

### Structure done, no slides
> "The agenda is approved. Would you like to generate the presentation now? (generate-slides)"

Estimated token cost: **~high** (fetches sources, writes all slides)

Options:
- **Yes** — call `generate-slides`
- **Continue editing agenda** — call `structure-agenda` again

### Generation done, not proofread
> "The presentation has been generated. Would you like to run a proofreading pass now?"

Options:
- **Yes** — run the proofreading pass from [../generate-slides/QUALITY.md](../generate-slides/QUALITY.md) against the existing `PRESENTASJON.md`, report all findings, and mark `phases.proofread.status = "done"` in `PROJECT.json`
- **Skip** — mark proofread as skipped (not recommended — warn the user)

### Proofread done
> "The presentation is complete ✅"

Options:
- **Regenerate** — re-run `generate-slides` from existing agenda
- **Revise agenda** — go back to `structure-agenda`
- **Start over** — confirm, then wipe state and call `discover-presentation`

## Sequential invocation

When calling phase skills in sequence, pass the project folder path. Each skill reads `DISCOVERY.json` and `PROJECT.json` to find all paths and settings.

The full pipeline is:
```
discover-presentation → structure-agenda → generate-slides → proofread
```

Do not advance to the next phase until the current phase's exit criteria are satisfied (see guidance sections above).

## Token cost hints

Display estimated effort before calling expensive operations:

| Operation | Estimated cost |
|-----------|---------------|
| `discover-presentation` | Low — conversational only |
| `structure-agenda` | Low-medium — iterative drafting |
| `generate-slides` | High — source fetching + full slide generation |
| Proofread pass | Low — reads existing files only |
