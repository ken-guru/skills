---
name: structure-agenda
description: Build and iteratively refine the presentation agenda (AGENDA.md). Requires DISCOVERY.json to exist. Use after discover-presentation, or standalone to keep iterating on an existing agenda.
---

# Structure Agenda

Builds and refines `AGENDA.md` through collaborative iteration with the user.

## Startup

Run validation checks per [../shared/validation.md](../shared/validation.md). Abort if any errors are returned.

Check that `DISCOVERY.json` exists in the project folder. If not:
> ❌ `DISCOVERY.json` ikke funnet. Kjør `discover-presentation` først.
Abort.

Read `DISCOVERY.json` to load topic, audience, duration, language, and occasion.

## Procedure

### Step 1: Propose agenda outline

Based on the discovery data:
1. Infer the best narrative structure from [../discover-presentation/DEFAULTS.md](../discover-presentation/DEFAULTS.md)
2. Propose a full agenda outline with sections and slide topics
3. Include a `## Begreper og definisjoner` section with all key domain terms defined
4. For each slide topic: include an image placeholder and `[Kilde](url)` for source material where relevant

Present the draft agenda to the user before writing any files.

### Step 2: Iterate

Iterate with the user per [ITERATION.md](ITERATION.md). Do **not** write AGENDA.md until the user explicitly approves.

### Step 3: Write AGENDA.md

Write the approved agenda to the path specified in `DISCOVERY.json` (default: `AGENDA.md`).

Mark `phases.structure.status = "done"` in `PROJECT.json`.

### Step 4: Report to user

```
✅ Agenda godkjent og skrevet til [path]
▶️  Neste steg: Kjør `generate-slides` for å generere presentasjonen
```
