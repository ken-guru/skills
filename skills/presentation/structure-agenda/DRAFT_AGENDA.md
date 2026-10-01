### Step 2: Draft full agenda outline

Using the chosen structure:
1. Propose a full agenda outline with sections and slide topics
2. Include a Glossary section (in the presentation language) with all key domain terms defined
3. For each slide topic: indicate the visual choice and its canonical filename (e.g., `[Visual: Picture — \`images/example.png\`]`, `[Visual: Diagram — \`images/example.svg\`]`, or `[Visual: None]`) based on the presentation default, and `[Source](url)` for source material where relevant. **Explicitly remind the user that they can override this choice to "None" or another type for any individual slide.**
4. For every Picture, declare `Intended Media Orientation` as exactly `Portrait` or `Landscape`. Infer the orientation from Media Intent and the selected theme's composition needs, show it in the draft, and let the user override it. This declaration selects the matching text-plus-image Archetype Variation and guides image generation.
5. Give every Diagram its own Diagram slide. Only the diagram archetype has a diagram media box: a wide, short slot (1116–1152 px wide and 252–347 px tall on the 1280×720 slide, depending on the theme), so diagrams read left to right. When the presenter asks for a diagram on a title, section, or other slide, say so in the draft and offer a separate Diagram slide next to it, or a Picture or None on that slide. The final agenda approval settles it; Generation and validation block a Diagram on any other archetype.

Use this Picture form:

```markdown
[Visual: Picture — `images/example.png`]
- **Intended Media Orientation:** Portrait
```

When assigning filenames for pictures or diagrams, choose descriptive, stable names (e.g. `images/threat-model-diagram.svg`, not `images/slide-3.png`). These filenames are **canonical** — `generate-slides` will use them exactly to build `IMAGE_SPEC.md` or `DIAGRAM_SPEC.md` and the final slides. Renaming them later requires updating both `AGENDA.md` and any previously generated specs.

### Diagram briefing

Present the draft agenda to the user before writing any files. When it has Diagram slides, end the same message with one Diagram brief form covering every Diagram slide, so the presenter can fill in all briefs in one reply:

```
To make each diagram useful, fill in its Message, Show, and Takeaway.
Reply "draft" for a brief to have me propose it, or switch a slide to Picture or None.

Slide 4 — <title> (`images/example.svg`)
- Message:
- Show:
- Takeaway:

Slide 9 — <title> (`images/other.svg`)
- Message:
- Show:
- Takeaway:
```

Leave every field blank: the diagram's intent is the presenter's. The form is plain text in one message; a harness's structured question tool may carry it when it fits.

Validate the whole reply together:

- **Complete brief** (three non-empty fields): add this block directly below that slide's visual entry in the in-memory agenda draft.

  ```markdown
  [Visual: Diagram — `images/example.svg`]
  - **Diagram brief**
    - **Message:** …
    - **Show:** …
    - **Takeaway:** …
  ```

- **"draft"**: propose that slide's brief from the agenda context and show it for the presenter to edit or accept.
- **Picture or None**: apply that visual to the slide in the in-memory draft; a Picture also gets its Intended Media Orientation.
- **Missing fields**: re-ask only the missing fields, listing every incomplete slide with its missing fields together in one message. Leave complete briefs as they are.

A complete brief or replacement visual needs no separate per-slide approval; the final agenda approval remains the commitment point.

### Step 3: Iterate

Iterate with the user per [ITERATION.md](ITERATION.md). Do **not** write AGENDA.md until the user explicitly approves.

### Step 4: Write AGENDA.md

Write the approved agenda to the path specified in `DISCOVERY.json` (default: `AGENDA.md`).

Require `PROJECT.json` to have `projectType: "presentation"`. Mark
`phases.structure.status = "done"` and record its completion timestamp while
preserving all other phase records.

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
