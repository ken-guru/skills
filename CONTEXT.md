# Domain Glossary

## Skill

An agent skill is a reusable, standalone unit of work that performs a specific phase of a larger workflow. Each skill:
- Has a clear input/output contract
- Can be called independently or as part of a sequence
- Reads/writes persistent state to files in the project folder
- Handles its own environment validation via a shared validation module

## Phase

One logical step in the content creation pipeline. Current phases:

1. **Discovery** — gather requirements from the user (topic, audience, duration, language, occasion)
2. **Structure** — build and iterate on the content outline (AGENDA.md, glossary, sources)
3. **Generation** — render final output files (PRESENTASJON.md, HTML, sourced content)

## Project Types (future)

Content projects can be presentations, documentation, PRDs, tutorials, etc. All follow the same phase sequence, but with type-specific:
- Default values
- Output templates
- Validation rules

Currently, **presentations** is the primary project type.

## State Files

Each project folder contains:

- **DISCOVERY.json** — user requirements captured during Phase 1 (topic, audience, etc.)
- **AGENDA.md** — structured outline with sections, slide topics, glossary, source placeholders (Phase 2 output)
- **PROJECT.json** — metadata (project type, created date, discovered settings, generation options)
- **PRESENTASJON.md** — final presentation source (Phase 3 output)
- **PRESENTASJON.html** — rendered HTML (Phase 3 output)
- **docs/sources/** — fetched and summarized source material (Phase 3 generated)

## Orchestrator

A skill that:
- Detects the project state (discovery done? agenda exists? ready to generate?)
- Guides the user through the next logical step
- Calls phase skills sequentially
- Handles environment validation before starting
- Provides estimated token cost for each operation

---

## Presentation-specific terminology

**Slide** — One page in the final output (PRESENTASJON.md)

**Agenda** — The structured outline (AGENDA.md) containing sections, slide topics, image placeholders, source references, and glossary

**Narrative structure** — The logical flow of a presentation (e.g., "problem → solution → implications")

**Glossary** (Begreper og definisjoner) — Canonical definitions of all domain-specific terms used in the presentation

---

## Norwegian language conventions

For Norwegian (bokmål) presentations, all generated content must follow [Språkrådet guidelines](https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/) for:
- Spelling (rettskriving)
- Grammar (grammatikk)
- Terminology consistency
- Gender-neutral language where appropriate

This applies to slide text, presenter notes, glossary definitions, and UI messaging.
