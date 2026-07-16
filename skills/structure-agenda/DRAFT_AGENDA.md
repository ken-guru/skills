### Step 2: Draft full agenda outline

Using the chosen structure:
1. Propose a full agenda outline with sections and slide topics
2. Include a Glossary section (in the presentation language) with all key domain terms defined
3. For each slide topic: indicate the visual choice and its canonical filename (e.g., `[Visual: Picture — \`images/example.png\`]`, `[Visual: Diagram — \`images/example.svg\`]`, or `[Visual: None]`) based on the presentation default, and `[Source](url)` for source material where relevant. **Explicitly remind the user that they can override this choice to "None" or another type for any individual slide.**
4. For every Picture, declare `Intended Media Orientation` as exactly `Portrait` or `Landscape`. Infer the orientation from Media Intent and the selected theme's composition needs, show it in the draft, and let the user override it. This declaration selects the matching text-plus-image Archetype Variation and guides image generation.

Use this Picture form:

```markdown
[Visual: Picture — `images/example.png`]
- **Intended Media Orientation:** Portrait
```

When assigning filenames for pictures or diagrams, choose descriptive, stable names (e.g. `images/threat-model-diagram.svg`, not `images/slide-3.png`). These filenames are **canonical** — `generate-slides` will use them exactly to build `IMAGE_SPEC.md` or `DIAGRAM_SPEC.md` and the final slides. Renaming them later requires updating both `AGENDA.md` and any previously generated specs.

### Diagram briefing

Handle Diagram slides one at a time: immediately after proposing a slide with a Diagram visual, ask:

> To make this diagram useful, what is its **Message**, what should it **Show**, and what **Takeaway** should the audience leave with?

Wait for the user's reply before continuing to the next slide. When the user provides all three non-empty answers, add this block directly below that slide's visual entry in the in-memory agenda draft:

```markdown
[Visual: Diagram — `images/example.svg`]
- **Diagram brief**
  - **Message:** …
  - **Show:** …
  - **Takeaway:** …
```

If an answer omits a field, identify the missing field and ask the user to complete it. If the user cannot provide a useful brief, offer to change that slide's visual to Picture or None, then apply the chosen visual to the in-memory draft. A complete brief or replacement visual needs no separate per-slide approval; the final agenda approval remains the commitment point.

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
