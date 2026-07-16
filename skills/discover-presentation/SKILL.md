---
name: discover-presentation
description: "Interview the user. Use when starting a new presentation or updating requirements."
---

# Discover Presentation

Gathers presentation requirements through a conversational interview. Writes results to `DISCOVERY.json` and `PROJECT.json` in the project folder.

## Gotchas
- Advance to Step 2 only after at least 3 of 4 persona dimensions are known — thin personas produce generic slides
- Infer language from how the user writes; ask explicitly only if ambiguous
- Write DISCOVERY.json only after the user confirms the defaults summary in Step 2

## Startup

Before proceeding:
1. Run `which marp` — if not found, abort: ❌ `marp-cli` not installed. Run `npm install -g @marp-team/marp-cli`
2. Confirm the project folder is writable — if not, abort: ❌ Cannot write to `<path>`

If `DISCOVERY.json` already exists, read and retain it for change comparison. Do not delete anything yet.

## Procedure

### Step 1: Interview

Ask the questions in [QUESTIONS.md](QUESTIONS.md) conversationally. Extract structured data from free-form answers. Accept partial answers and fill the rest with defaults from [DEFAULTS.md](DEFAULTS.md).

**Language detection:** Infer the presentation language from how the user writes. If they write in Norwegian, default to Norwegian bokmål. If they write in English or another language, use that. The detected language is recorded in `DISCOVERY.json` and must be respected throughout all subsequent phases — all generated content (slides, presenter notes, glossary) must be in that language.

Complete the persona depth section before moving to Step 2. A persona is considered sufficient when at least 3 of the 4 depth dimensions (experience level, goal, concerns, takeaways) are known.

### Step 2: Confirm defaults

Present a one-shot confirmation summary before writing any files:

```
📋 Default assumptions — correct anything that doesn’t fit:

- Topic: [topic]
- Audience: [audience]
  - Experience level: [experience_level]
  - Goal: [goal — implement / understand]
  - Concerns: [top_concerns]
  - Top 3 takeaways: [top_takeaways]
- Duration: [duration]
- Occasion: [occasion]
- Language: [language]
- Presentation style: [narrative structure from DEFAULTS.md]
- Presentation Theme: [Editorial / Signal / Field Notes] ([identifier])
- External Font Override: [exact family or none]
- Pagination: Yes
- Max bullet points per slide: 5–6
- Visual preference: [Picture / Diagram / None]
```

Also confirm file/folder naming:

| File / Folder | Default |
|---|---|
| Agenda | `AGENDA.md` |
| Presentation | `PRESENTASJON.md` |
| Images | `images/` |
| Videos | `videos/` |
| Docs | `docs/` |
| Sources | `docs/sources/` |
| Themes | `themes/` |

Ask: "Would you like to use the default names, or would you like to adjust any?"

Wait for the user to approve or correct before proceeding to Step 3.

If prior Discovery state exists, compare it with the confirmed values now. Run the restart guard per [RESTART-GUARD.md](RESTART-GUARD.md), selecting the theme-only, font-only, or general path from the actual diff. Complete the guard before writing new state.

### Step 3: Write state files
Read the external pointer file `WRITE_DISCOVERY.md` for the next steps ONLY AFTER the user confirms the defaults in Step 2.
