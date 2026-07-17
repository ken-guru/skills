# Decide the implementation sequence and verification plan

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Specify Discovery and project-state theme behavior](04-specify-discovery-and-state-behavior.md), [Specify theme-aware slide composition](05-specify-theme-aware-slide-composition.md), [Set accessibility and Marp export acceptance criteria](06-set-accessibility-and-export-criteria.md), [Specify generator integration and theme packaging](07-specify-generator-integration.md)

## Question

In what incremental order should the agreed specification be implemented, and what focused evals and rendered-deck checks prove each step without leaving the presentation pipeline in an inconsistent state?

## Resolution

Implement themes reader-first and writer-last through complete vertical slices. Every committed slice remains usable and green: older projects continue through the documented Editorial fallback, and Discovery does not write new theme state until every downstream reader supports all three bundled themes.

Use test-driven development at three agreed public seams. Tests assert observable outputs and errors through these seams rather than theme internals:

1. **Theme Resolution:** Given a Theme Catalog, theme identifier, and optional project snapshot, return one validated locked Theme Package or a precise blocking error.
2. **Project generation:** Given fixture Discovery, Agenda, and Media Specs, produce the expected snapshot, Semantic Slide Markup, media handoffs, Markdown, HTML, PDF, and phase transitions.
3. **Rendered-deck acceptance:** Given generated outputs, report accessibility structure, Content Capacity, collisions, media integrity, offline-font behavior, and HTML/PDF parity across the required matrix.

Existing skill-routing evals continue to prove which skill loads. Do not overload them with generation behavior.

### Implementation sequence

Work one red-green tracer bullet at a time and leave every commit passing:

1. **Establish the Theme Acceptance Suite.** Create the non-shipping harness, canonical fixture inputs, synthetic fixture media, independent expected results, and the first failing Theme Resolution case. Do not introduce user-visible behavior.
2. **Add Theme Resolution and package validation.** Introduce the Theme Catalog, manifest schema, version/fingerprint validation, project lock behavior, precise errors, and missing-state Editorial fallback. Make the focused resolution cases green before proceeding.
3. **Complete the Editorial vertical slice.** Add its Theme Package and update generator instructions, scaffold, Semantic Slide Markup, media handoff, Marp configuration, proofreading, default Markdown/HTML/PDF exports, and documentation together. Remove the universal `img-right`, `class: invert`, and duplicated inline-CSS assumptions in this slice so the proofreader cannot undo generated compositions. Pass Editorial's eight-slide render matrix and human identity review.
4. **Complete the Signal vertical slice.** Add the full package, capacity fixture, deterministic compositions, rendered checks, baselines, and human review before starting Field Notes.
5. **Complete the Field Notes vertical slice.** Apply the same complete green slice and review.
6. **Add downstream state behavior before its writer.** Update shared schema readers, focused Restart Guards, project phase transitions, build orchestration, theme refresh, theme-change invalidation, font-only regeneration, output paths, and renderer tolerance for the expanded Media Specs. Discovery still emits no theme field during this step.
7. **Activate Discovery last.** Only after all three identifiers resolve and all downstream behavior passes does Discovery ask for a Presentation Theme after Visual preference, persist the selected theme and optional External Font Override, show translated descriptions, and expose focused correction paths.
8. **Run the release matrix and finish documentation.** Execute both CI tiers, approve the final three-theme contact sheet, verify user guidance and optional PPTX documentation, and confirm that prototype assets are absent from installed packages.

Do not commit failing tests between slices, horizontally implement all manifests before their observable behavior, or activate Discovery behind an incomplete downstream pipeline.

### Non-shipping verification layout

Keep product and verification dependencies separate:

```text
verification/presentation-themes/
├── package.json
├── fixtures/
│   ├── projects/
│   └── media/
├── expected/
├── baselines/
├── scripts/
└── README.md
```

The isolated package pins Marp CLI, browser automation, accessibility checks, and image-comparison tooling. Commit fixture inputs, independent expected results, deterministic synthetic media, and explicitly approved visual baselines. Generated Markdown, HTML, PDF, screenshots, contact sheets, and reports remain ignored build artifacts unless a baseline is intentionally accepted.

Fixture media lives outside installed skills, makes orientation and protected focal regions mechanically inspectable, and requires no AI generation, network access, external font, or third-party license.

### Canonical rendered matrix

Render one identical eight-slide capacity deck in Editorial, Signal, and Field Notes:

1. Title.
2. Section.
3. Text-only.
4. Text-plus-image portrait.
5. Text-plus-image landscape.
6. Data.
7. Diagram.
8. Quotation.

These 24 slides populate every required Content Slot to the shared Content Capacity minimum and use the same local fixture media so visual differences come from the selected Theme Package. The approved four-slide prototype remains design evidence, not an acceptance fixture.

Focused cases outside the matrix cover over-capacity restructuring, orientation mismatch, legacy and invalid state, font fallback, snapshot damage, and refresh behavior.

### Minimum focused behavior suite

The release suite must prove:

- Missing theme state uses Editorial, reports guidance, and does not mutate Discovery.
- Every known identifier resolves the correct package; an unknown identifier blocks.
- Catalog/manifest mismatch, unsupported markup, missing package files, modified fingerprints, or an incomplete lock blocks before project writes.
- A newer installed package does not replace a locked snapshot without explicit refresh.
- Theme changes and refreshes invalidate the agreed Media Specs, presentation outputs, and phases while preserving the Agenda and generated media.
- Font-only changes invalidate presentation outputs and Proofread only.
- Ordered classification selects all seven Slide Archetypes deterministically and persists their classes.
- Portrait and landscape variations follow Intended Media Orientation; an existing-media mismatch blocks.
- Exact-capacity fixtures fit without collision; over-capacity input selects an applicable roomier variation or splits rather than shrinking below thresholds.
- Theme changes alter the explicit Theme Treatment in Media Specs; font changes do not alter Media Specs.
- Markdown, HTML, and PDF are generated by default and PPTX is not.
- Discovery asks for theme after Visual preference, never proactively asks for a font, and exposes all three choices only after downstream support is complete.
- Image and diagram renderers accept the expanded complete Media Specs without independently loading theme state.

### Automated and human rendered checks

Use a hybrid verification model:

- Browser checks inspect DOM order, semantic headings, alternative text, computed contrast and font sizes, slot and media bounding boxes, safe margins, overlap, clipping, scroll overflow, and declared orientation.
- Marp renders HTML and PDF in a pinned environment with network access disabled. Checks compare slide count, dimensions, text, media, pagination, missing assets, and successful PDF parsing.
- Rendered HTML and PDF pages produce contact sheets for review and reviewed image baselines for regression detection with a small pinned-environment tolerance.
- Pixel similarity is a regression signal, not accessibility or geometry proof. Tests never update baselines automatically.
- A human identity review compares each eight-slide contact sheet with its approved prototype direction and composition grammar. Final activation requires all three sheets side by side to remain recognizably distinct rather than palette swaps.
- Human reapproval is required only when package CSS, composition rules, typography, or approved visual baselines change.

### Required CI tiers

Both tiers block theme-related changes:

- **Fast tier:** Catalog and schema validation, Theme Resolution errors, state transitions, classification, Semantic Slide Markup, Media Spec handoffs, output selection, and skill-routing evals.
- **Full render tier:** The 24-slide matrix, HTML/PDF parity, offline-font behavior, accessibility, geometry, media integrity, and visual regression whenever Theme Packages, generator/scaffold, state handling, or proofreading changes.

CI publishes contact sheets and reports but cannot approve or replace visual baselines.

### Completion gate

The feature is releasable only when all three packages pass schema and integrity validation, the complete focused suite is green, all 24 capacity slides pass the shared acceptance criteria in HTML and PDF, offline export emits no bundled-font request, visual baselines are explicitly approved, the final side-by-side identity review passes, and Discovery activation introduces no failing routing or restart behavior.

### Context pointer

[Presentation theme domain glossary](../../CONTEXT.md)
