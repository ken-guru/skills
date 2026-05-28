---
name: structure-agenda
description: Load when the user wants to build, draft, or revise the presentation agenda, or when discover-presentation has just completed.
---

# Structure Agenda

Builds and refines `AGENDA.md` through collaborative iteration with the user.

## Gotchas
- Do not write AGENDA.md until the user gives explicit approval — premature writes trigger the restart guard on every subsequent iteration
- When the user says "update a slide", iterate on the in-memory draft only; commit to disk only on approval

## Startup

Before proceeding:
1. Run `which marp` — if not found, abort: ❌ `marp-cli` not installed. Run `npm install -g @marp-team/marp-cli`
2. Confirm the project folder is writable — if not, abort: ❌ Cannot write to `<path>`

Check that `DISCOVERY.json` exists in the project folder. If not:
> ❌ `DISCOVERY.json` not found. Run `discover-presentation` first.
Abort.

Read `DISCOVERY.json` to load topic, audience, duration, language, and occasion.

If downstream files exist (check for `IMAGE_SPEC.md` or `PRESENTASJON.md` in the project folder), run the restart guard per [RESTART-GUARD.md](RESTART-GUARD.md) with phase `structure-agenda` before proceeding.

## Procedure

### Step 1: Propose agenda alternatives

Based on the discovery data, generate **2–3 radically different agenda structures**. Draw from [DEFAULTS.md](DEFAULTS.md) and adapt to the specific topic, audience, and occasion.

For each alternative provide:
- A short label
- The narrative arc (3–5 phases with one-line descriptions)
- A one-sentence rationale

Example format:
```
A) **Problem → Solution → Demo → Implications** (classic technical)
   Starts with the pain the audience knows, builds to the "aha" moment, ends with "what now"

B) **Demo-first → Background → Deeper concepts → Next steps** (show, don’t tell)
   Captures attention immediately — explains "why" after "wow"

C) **Story → Concepts → Exercise → Takeaways** (workshop style)
   Best when the audience wants hands-on experience rather than passive listening
```

Ask the user:
> "Which structure resonates with you, or would you like to combine elements from several?"

Wait for the user's choice before drafting the full slide-level outline.

### Step 2: Draft full agenda outline

Using the chosen structure:
1. Propose a full agenda outline with sections and slide topics
2. Include a Glossary section (in the presentation language) with all key domain terms defined
3. For each slide topic: include an image placeholder and `[Source](url)` for source material where relevant

Present the draft agenda to the user before writing any files.

### Step 3: Iterate

Iterate with the user per [ITERATION.md](ITERATION.md). Do **not** write AGENDA.md until the user explicitly approves.

### Step 4: Write AGENDA.md

Write the approved agenda to the path specified in `DISCOVERY.json` (default: `AGENDA.md`).

Mark `phases.structure.status = "done"` in `PROJECT.json`.

### Step 5: Report to user

If `IMAGE_SPEC.md` exists from a previous `generate-slides` run:

```
✅ Agenda approved and written to [path]

ℹ️  Your image specifications will be updated when you run `generate-slides` next.
   Any new images added, removed, or modified will be reported clearly.

▶️  Next step: Run `generate-slides` to generate the presentation
   (Image changes will be displayed before slide generation begins)
```

If `IMAGE_SPEC.md` does not exist (first time running):

```
✅ Agenda approved and written to [path]
▶️  Next step: Run `generate-slides` to generate the presentation
```
