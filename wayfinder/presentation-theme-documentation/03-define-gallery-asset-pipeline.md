# Define the gallery asset pipeline

Map: [Document the presentation theme gallery](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex

Blocked by: [Select the matched production gallery examples](02-select-matched-production-examples.md)

## Question

How should the one-time AI-generated sample image and reviewed production HTML renders be specified, approved, captured, optimized, named, stored, referenced, and refreshed so the README and gallery remain fast, legible, repository-appropriate, reproducible, and explicit about provenance without treating ordinary generated build output as hand-maintained source?

## Resolution

Extend the existing `verification/presentation-themes` package with one gallery-specific path from committed fixture inputs to explicitly approved public documentation assets. Keep Marp, Chromium, screenshot, hashing, and comparison dependencies pinned in that package rather than creating a second documentation toolchain.

### Source inputs

Add a dedicated gallery fixture beneath `verification/presentation-themes/fixtures/gallery/`. Keep its content aligned with the existing capacity deck while replacing only the diagnostic portrait SVG used by the selected title and text-plus-image slides.

Store the one-time image inputs together:

```text
verification/presentation-themes/fixtures/gallery/
├── IMAGE_SPEC.md
├── media/
│   └── collaboration-portrait.png
└── <gallery fixture input>
```

The exact accepted raster is the reproducible source of truth because image generation is nondeterministic. `IMAGE_SPEC.md` is its durable provenance record and must contain:

- Concept and communicative purpose.
- Portrait orientation and protected central focal region.
- Accessibility description.
- Final prompt.
- Output filename.
- Generation provider and exact model identifier.
- Approval date.

Use the installed `generate-images` skill in one-at-a-time mode for initial creation. Generate one portrait with Gemini, review it, and regenerate with the same or revised prompt until accepted. Commit only the final spec and approved PNG. Routine fixture, render, verification, and approval commands always reuse that PNG and never invoke Gemini or replace it.

### Generated and approved outputs

Gallery render commands write temporary HTML, screenshots, and review reports into the existing ignored `.generated/` and `reports/` locations. Public documentation references only explicitly approved PNGs in:

```text
docs/assets/presentation-themes/
├── editorial-title.png
├── editorial-text-plus-image.png
├── editorial-data.png
├── editorial-quotation.png
├── signal-title.png
├── signal-text-plus-image.png
├── signal-data.png
├── signal-quotation.png
├── field-notes-title.png
├── field-notes-text-plus-image.png
├── field-notes-data.png
├── field-notes-quotation.png
└── manifest.json
```

Use full-slide, lossless, 1280×720 PNGs sourced from the production HTML render. The README and dedicated gallery reference the same three `*-title.png` files; do not create a duplicate README composite. Theme names and captions remain external Markdown content rather than pixels burned into screenshots.

The manifest maps every approved filename to its stable Theme identifier, Slide Archetype, fixture slide number, HTML renderer, width, height, and SHA-256 hash. It also records the gallery fixture version and the committed sample-media hash needed to establish provenance. Freshness triggers and validation semantics are decided separately by [Set gallery accessibility and freshness criteria](04-set-gallery-accessibility-and-freshness-criteria.md).

### Render and review flow

Add gallery-specific scripts to the existing verification package for these observable stages:

1. Generate the gallery fixture from committed inputs.
2. Render Editorial, Signal, and Field Notes through their actual Theme Packages and production Marp HTML path.
3. Capture only the selected title, text-plus-image, data, and quotation slides.
4. Generate one ignored review contact sheet as a 3×4 comparison matrix: theme columns in catalog order and Slide Archetype rows.
5. Verify expected filenames, dimensions, source identity, and asset-size budgets.
6. Explicitly approve reviewed screenshots with:

   ```bash
   npm run approve-gallery -- --approve
   ```

The approval command refuses to run without `--approve`, requires exactly the twelve expected reviewed HTML screenshots, copies only those screenshots into `docs/assets/presentation-themes/`, and replaces their manifest. It never changes ordinary HTML/PDF visual baselines, `IMAGE_SPEC.md`, or the approved portrait. Likewise, ordinary baseline approval never changes public documentation assets.

### Asset budget

Preserve visual quality and 1280×720 resolution under a lenient target-and-ceiling policy:

- Soft target: 750 KB per screenshot.
- Hard ceiling: 1.5 MB per screenshot.
- Hard ceiling: 12 MB for all twelve approved screenshots.

Report a soft-target overrun for human review but block approval only at a hard ceiling. Prefer a visually focused sample image and lossless optimization. If reviewed screenshots exceed the hard ceiling, add a pinned deterministic optimizer within the existing verification package rather than cropping slides, lowering resolution, or applying visibly destructive compression.

This pipeline introduces no new presentation-domain term and requires no ADR: it is a reversible documentation build and approval mechanism built on the existing verification seam.
