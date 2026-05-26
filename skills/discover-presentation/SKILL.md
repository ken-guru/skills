---
name: discover-presentation
description: Gather requirements for a new presentation by interviewing the user. Produces DISCOVERY.json and PROJECT.json. Use as the first step when starting a new presentation, or when you want to update requirements for an existing one.
---

# Discover Presentation

Gathers presentation requirements through a conversational interview. Writes results to `DISCOVERY.json` and `PROJECT.json` in the project folder.

## Startup

Run validation checks per [../shared/validation.md](../shared/validation.md). Abort if any errors are returned.

If `DISCOVERY.json` already exists in the project folder, warn the user:

> ⚠️ Discovery er allerede gjennomført for dette prosjektet.
> Vil du oppdatere kravene? Dette vil ikke slette `AGENDA.md`, men agendaen kan trenge revisjon etterpå.

Wait for confirmation before continuing.

## Procedure

### Step 1: Interview

Ask the questions in [QUESTIONS.md](QUESTIONS.md) conversationally. Extract structured data from free-form answers. Accept partial answers and fill the rest with defaults from [DEFAULTS.md](DEFAULTS.md).

Complete the persona depth section before moving to Step 2. A persona is considered sufficient when at least 3 of the 4 depth dimensions (experience level, goal, concerns, takeaways) are known.

### Step 2: Confirm defaults

Present a one-shot confirmation summary before writing any files:

```
📋 Standardantagelser — korriger det som ikke stemmer:

- Emne: [topic]
- Målgruppe: [audience]
  - Erfaringsnivå: [experience_level]
  - Formål: [goal — implementere / forstå]
  - Bekymringer: [top_concerns]
  - Topp-3 takeaways: [top_takeaways]
- Varighet: [duration]
- Anledning: [occasion]
- Språk: [language]
- Presentasjonsstil: [narrative structure from DEFAULTS.md]
- Mørk modus: Ja (class: invert)
- Sidenummerering: Ja
- Maks kulepunkter per lysbilde: 5–6
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

Ask: "Vil du bruke standardnavn, eller ønsker du å justere noen?"

Wait for the user to approve or correct before proceeding to Step 3.

### Step 3: Write state files

Write `DISCOVERY.json` and `PROJECT.json` to the project folder per [../shared/state-schema.md](../shared/state-schema.md).

Mark `phases.discovery.status = "done"` in `PROJECT.json`.

### Step 4: Report to user

```
✅ Discovery fullført
📁 Prosjektmappe: [path]
▶️  Neste steg: Kjør `structure-agenda` for å bygge agendaen
```
