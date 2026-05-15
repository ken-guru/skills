---
name: build-presentation
description: Scaffold and generate a complete Marp presentation from a topic or rough agenda. Interactively builds AGENDA.md, scaffolds the full project structure, generates PRESENTASJON.md and PRESENTASJON.html. Defaults to Norwegian (bokmål). Use when user wants to build a presentation, create slides, or mentions "presentasjon", "slides", "marp", "bygg presentasjon", "lag presentasjon".
---

# Build Presentation

Builds a complete Marp presentation interactively. **Language defaults to Norwegian (bokmål)** unless otherwise specified.

## Startup checks

1. **Prerequisites** — run `which marp`. If not found, abort:
   > ❌ `marp-cli` er ikke installert. Kjør: `npm install -g @marp-team/marp-cli`

2. **Existing project** — if `AGENDA.md` exists, ask the user:
   - **Fortsett** — refine the agenda (go to Phase 2)
   - **Regenerer** — regenerate slides from the existing agenda (go to Phase 3)
   - **Start på nytt** — discard and begin fresh (go to Phase 1)

## Phases

Run in order. Full instructions in [PHASES.md](PHASES.md).

| Phase | Goal |
|-------|------|
| 1. Discovery | Gather topic, audience, duration, occasion, language, folder preferences |
| 2. Agenda refinement | Build and iterate `AGENDA.md` with glossary, image placeholders, sources |
| 3. Generation | Scaffold project, generate slides, validate, build `PRESENTASJON.html` |

## Content rules (soft defaults — warn but defer to user)

- Max 5–6 bullet points per slide; split if exceeded
- No code blocks in slides
- No progressive reveal syntax
- Images: `<img class="img-right">` beside text; never `![bg ...]`
- Videos: dedicated blank slide only; only when explicitly requested
- Presenter notes: always generated in bullet format (2–3 sentences each)
- Paginate: always on

See [QUALITY.md](QUALITY.md) for the validation pass run before final output.
See [SCAFFOLD.md](SCAFFOLD.md) for project structure and all file templates.
See [DEFAULTS.md](DEFAULTS.md) for default assumptions and narrative structure templates.
