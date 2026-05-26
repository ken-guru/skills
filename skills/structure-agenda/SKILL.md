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

### Step 1: Propose agenda alternatives

Based on the discovery data, generate **2–3 radically different agenda structures**. Draw from [DEFAULTS.md](DEFAULTS.md) and adapt to the specific topic, audience, and occasion.

For each alternative provide:
- A short label
- The narrative arc (3–5 phases with one-line descriptions)
- A one-sentence rationale

Example format:
```
A) **Problem → Løsning → Demo → Implikasjoner** (klassisk teknisk)
   Starter med smerten publikum kjenner, bygger til aha-moment, slutter med "hva nå"

B) **Demo-first → Bakgrunn → Dypere konsepter → Neste steg** (show, don't tell)
   Fanger oppmerksomhet umiddelbart — forklarer "hvorfor" etter "wow"

C) **Fortelling → Konsepter → Øvelse → Takeaways** (workshop-stil)
   Passer om publikum ønsker hands-on erfaring fremfor passiv lytting
```

Ask the user:
> "Hvilken struktur resonerer med deg, eller vil du kombinere elementer fra flere?"

Wait for the user's choice before drafting the full slide-level outline.

### Step 2: Draft full agenda outline

Using the chosen structure:
1. Propose a full agenda outline with sections and slide topics
2. Include a `## Begreper og definisjoner` section with all key domain terms defined
3. For each slide topic: include an image placeholder and `[Kilde](url)` for source material where relevant

Present the draft agenda to the user before writing any files.

### Step 3: Iterate

Iterate with the user per [ITERATION.md](ITERATION.md). Do **not** write AGENDA.md until the user explicitly approves.

### Step 4: Write AGENDA.md

Write the approved agenda to the path specified in `DISCOVERY.json` (default: `AGENDA.md`).

Mark `phases.structure.status = "done"` in `PROJECT.json`.

### Step 5: Report to user

```
✅ Agenda godkjent og skrevet til [path]
▶️  Neste steg: Kjør `generate-slides` for å generere presentasjonen
```
