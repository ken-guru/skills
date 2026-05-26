---
name: build-presentation
description: Orchestrates the full presentation-building workflow. Detects project state and guides the user through discover-presentation → structure-agenda → generate-slides. Use when user wants to build a presentation, create slides, or mentions "presentasjon", "slides", "marp", "bygg presentasjon", "lag presentasjon".
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

## User guidance (based on state)

### Nothing started
> "Det ser ut til at dette er et nytt prosjekt. Vil du starte med å samle krav? (discover-presentation)"

→ Call `discover-presentation`, then continue.

### Discovery done, no agenda
> "Discovery er fullført. Vil du bygge agendaen nå? (structure-agenda)"

Options:
- **Ja** — call `structure-agenda`
- **Redo discovery** — call `discover-presentation` again (warn: existing agenda will need revision)

### Structure done, no slides
> "Agendaen er godkjent. Vil du generere presentasjonen nå? (generate-slides)"

Estimated token cost: **~high** (fetches sources, writes all slides)

Options:
- **Ja** — call `generate-slides`
- **Fortsett å redigere agenda** — call `structure-agenda` again

### Generation done
> "Presentasjonen er fullført ✅"

Options:
- **Regenerer** — re-run `generate-slides` from existing agenda
- **Revider agenda** — go back to `structure-agenda`
- **Start på nytt** — confirm, then wipe state and call `discover-presentation`

## Sequential invocation

When calling phase skills in sequence, pass the project folder path. Each skill reads `DISCOVERY.json` and `PROJECT.json` to find all paths and settings.

## Token cost hints

Display estimated effort before calling expensive operations:

| Operation | Estimated cost |
|-----------|---------------|
| `discover-presentation` | Low — conversational only |
| `structure-agenda` | Low-medium — iterative drafting |
| `generate-slides` | High — source fetching + full slide generation |
