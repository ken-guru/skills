---
name: discover-presentation
description: Gather requirements for a new presentation by interviewing the user. Produces DISCOVERY.json and PROJECT.json. Use as the first step when starting a new presentation, or when you want to update requirements for an existing one.
---

# Discover Presentation

Gathers presentation requirements through a conversational interview. Writes results to `DISCOVERY.json` and `PROJECT.json` in the project folder.

## Startup

Run validation checks per [../shared/validation.md](../shared/validation.md). Abort if any errors are returned.

If `DISCOVERY.json` already exists in the project folder, warn the user:

> ⚠️ Discovery has already been completed for this project.
> Would you like to update the requirements? This will not delete `AGENDA.md`, but the agenda may need revision afterwards.

Wait for confirmation before continuing.

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
- Dark mode: Yes (class: invert)
- Pagination: Yes
- Max bullet points per slide: 5–6
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

### Step 3: Write state files

Write `DISCOVERY.json` and `PROJECT.json` to the project folder per [../shared/state-schema.md](../shared/state-schema.md).

Mark `phases.discovery.status = "done"` in `PROJECT.json`.

### Step 4: Report to user

```
✅ Discovery complete
📁 Project folder: [path]
▶️  Next step: Run `structure-agenda` to build the agenda
```
