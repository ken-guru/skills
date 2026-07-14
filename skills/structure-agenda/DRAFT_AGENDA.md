### Step 2: Draft full agenda outline

Using the chosen structure:
1. Propose a full agenda outline with sections and slide topics
2. Include a Glossary section (in the presentation language) with all key domain terms defined
3. For each slide topic: indicate the visual choice (e.g., `[Visual: Picture]`, `[Visual: Diagram]`, or `[Visual: None]`) based on the presentation default, a placeholder for the file, and `[Source](url)` for source material where relevant. **Explicitly remind the user that they can override this choice to "None" or another type for any individual slide.**

When assigning filenames for pictures or diagrams, choose descriptive, stable names (e.g. `images/threat-model-diagram.svg`, not `images/slide-3.png`). These filenames are **canonical** — `generate-slides` will use them exactly to build `IMAGE_SPEC.md` or `DIAGRAM_SPEC.md` and the final slides. Renaming them later requires updating both `AGENDA.md` and any previously generated specs.

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
