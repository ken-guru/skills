---
name: structure-agenda
description: "Drafting. Use when structuring presentation content, or after discover-presentation has completed."
---

# Structure Agenda

Builds and refines `AGENDA.md` through collaborative iteration with the user.

## Gotchas
- Write AGENDA.md only after the user gives explicit approval — premature writes trigger the restart guard on every subsequent iteration
- When the user says "update a slide", iterate on the in-memory draft only; commit to disk only on approval
- Every Picture has an explicit Intended Media Orientation (`Portrait` or `Landscape`)

## Startup

Before proceeding:
1. Confirm the project folder is writable — if not, abort:
   `❌ Cannot write to <path>`.

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
Read the external pointer file `DRAFT_AGENDA.md` for instructions on drafting and writing the agenda ONLY AFTER the user has chosen an agenda alternative.
