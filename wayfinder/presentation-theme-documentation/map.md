# Document the presentation theme gallery

Labels: `wayfinder:map`
Status: Open

## Destination

Specify, implement, and verify a two-level presentation-theme gallery in the existing deterministic-presentation-themes pull request: concise representative previews in the general README and a dedicated gallery page that helps users compare, choose, and correctly understand Editorial, Signal, and Field Notes.

## Notes

- Domain: User-facing documentation for the presentation skill suite and its bundled Presentation Themes.
- Consult the `domain-modeling` and `grilling` skills while resolving decision tickets.
- Use the `generate-images` skill in one-at-a-time mode when execution creates the one-time gallery sample image; preserve its exact spec, model, approval date, and AI provenance.
- The README should remain concise: one matched production-rendered example and a short description for each theme, leading to the expanded gallery.
- The gallery should show the same content across all themes and cover the shared minimum of title, text-plus-image, data or diagram, and section or quotation.
- Use only production-rendered fixture output as current behavior evidence. The throwaway prototype remains historical design evidence and must not appear as evidence of shipped behavior.
- Describe screenshots as representative of a deterministic visual system, not pixel-identical templates. Content length, Slide Archetype, and media orientation may change exact composition.
- Explain that a theme controls media placement, crop, framing, and treatment, while generated image style follows the approved Media Spec.
- Give each theme its stable name, a one-sentence visual description, lightweight “best suited for” guidance, and no subject-matter restriction. State that Editorial is the default and theme selection happens during Discovery.
- Documentation screenshot freshness should be mechanically checked and require explicit refresh after relevant production theme or baseline changes.
- This effort explicitly carries execution through verification. Commit and push the finished documentation to the existing `feat/deterministic-presentation-themes` pull-request branch rather than opening a separate pull request.

## Decisions so far

- [Define the theme documentation architecture and promise](01-define-documentation-architecture-and-promise.md) — Lead the README with a concise matched preview and deterministic-system promise, then use a dedicated gallery for four-archetype comparison, selection guidance, stable-versus-variable behavior, the media boundary, and the Discovery workflow.
- [Select the matched production gallery examples](02-select-matched-production-examples.md) — Use full-slide HTML renders of matched title, portrait, data, and quotation fixtures; feature the title comparison in the README and replace diagnostic crop-marker media with one disclosed, committed AI-generated sample reused unchanged across themes.
- [Define the gallery asset pipeline](03-define-gallery-asset-pipeline.md) — Extend the existing verification package with a committed one-time image spec and raster, ignored production renders, a 3×4 review matrix, twelve approved 1280×720 PNGs plus provenance manifest, and a separate explicit gallery-approval command.
- [Set gallery accessibility and freshness criteria](04-set-gallery-accessibility-and-freshness-criteria.md) — Require portable stacked Markdown, meaningful alt text and visible AI disclosure, fast static and full rendered gates, precise source fingerprinting, existing pixel tolerance, explicit reviewed refreshes, and separate confirmed paid image generation.
- [Decide the documentation implementation and verification plan](05-decide-documentation-implementation-and-verification.md) — Implement test-first and producer-before-consumer in three green commits on the existing PR, pausing for confirmed paid image generation and completing only after local, rendered, responsive, and live GitHub verification.

## Not yet specified

## Out of scope

- Changing the visual design, composition grammar, or behavior of Editorial, Signal, or Field Notes.
- Using the throwaway prototype or its generated sample images as current product documentation.
- Promising pixel-identical slide output across different content, media, renderers, or theme-package versions.
- Showing every supported Slide Archetype in the first gallery revision.
- Making generated raster imagery automatically inherit a Presentation Theme's artistic style.
