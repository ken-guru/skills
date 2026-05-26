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
| Proofread done | `phases.proofread.status == "done"` |

## User guidance (based on state)

### Nothing started
> "Det ser ut til at dette er et nytt prosjekt. Vil du starte med å samle krav? (discover-presentation)"

→ Call `discover-presentation`, then continue.

**Discovery exit criteria** before proceeding:
- [ ] `DISCOVERY.json` validert som JSON
- [ ] Persona identifisert med minst 3 av 4 dybde-dimensjoner (erfaringsnivå, formål, bekymringer, takeaways)
- [ ] Varighet og slide-antall estimert og bekreftet av bruker
- [ ] Topp-3 takeaways dokumentert i `DISCOVERY.json`

### Discovery done, no agenda
> "Discovery er fullført. Vil du bygge agendaen nå? (structure-agenda)"

Options:
- **Ja** — call `structure-agenda`
- **Redo discovery** — call `discover-presentation` again (warn: existing agenda will need revision)

**Agenda exit criteria** before proceeding to generation:
- [ ] Bruker har valgt én av de 2–3 foreslåtte strukturene (eller en hybrid)
- [ ] Alle slides har tittel og minst 3 innholdspunkter
- [ ] `## Begreper og definisjoner`-seksjonen er utfylt
- [ ] IMAGE_SPEC.md er generert og godkjent av bruker
- [ ] Bruker har gitt eksplisitt "godkjent" eller tilsvarende

### Structure done, no slides
> "Agendaen er godkjent. Vil du generere presentasjonen nå? (generate-slides)"

Estimated token cost: **~high** (fetches sources, writes all slides)

Options:
- **Ja** — call `generate-slides`
- **Fortsett å redigere agenda** — call `structure-agenda` again

### Generation done, not proofread
> "Presentasjonen er generert. Vil du kjøre korrekturlesing nå?"

Options:
- **Ja** — run the proofreading pass from [../generate-slides/QUALITY.md](../generate-slides/QUALITY.md) against the existing `PRESENTASJON.md`, report all findings, and mark `phases.proofread.status = "done"` in `PROJECT.json`
- **Hopp over** — mark proofread as skipped (not recommended — warn the user)

### Proofread done
> "Presentasjonen er fullført ✅"

Options:
- **Regenerer** — re-run `generate-slides` from existing agenda
- **Revider agenda** — go back to `structure-agenda`
- **Start på nytt** — confirm, then wipe state and call `discover-presentation`

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
