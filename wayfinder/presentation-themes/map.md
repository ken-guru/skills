# Three engaging presentation themes

Labels: `wayfinder:map`
Status: Closed

## Destination

Produce an implementation-ready specification for exactly three coherent, presentation-wide themes that replace the current plain dark style in newly generated presentations. The specification is backed by comparative mini-deck prototypes and defines the theme contract, selection behavior, composition rules, accessibility constraints, generator integration, and verification approach.

## Notes

- Domain: Agentic presentation generation, primarily `discover-presentation`, shared state, and `generate-slides`.
- Consult the `prototype`, `generate-images`, `domain-modeling`, and `grilling` skills where their ticket types require them.
- A Presentation Theme governs palette, typography, spacing, decorative geometry, image treatment, and slide-type composition. One theme applies to an entire presentation.
- Start with three deliberately opinionated directions: Editorial, Signal, and Field Notes.
- Prototype every direction as the same four-slide mini-deck: title, text-plus-image, data/diagram, and section/quotation.
- Generate one coherent set of throwaway sample images and reuse it across all three prototypes. Do not ship those assets with the production skill.
- Fonts must be offline-safe by default. A user may explicitly request a particular external font, such as a Google Font.
- Theme selection happens explicitly during Discovery and persists through regeneration.
- Planning only: implementation of the production skills is outside this map's destination.

## Decisions so far

- [Choose the three visual directions through mini-deck prototypes](01-prototype-three-theme-mini-decks.md) — Carry Editorial, Signal, and Field Notes forward as three structurally distinct theme directions, using the comparative mini-decks as the primary visual source.
- [Define the Presentation Theme contract](02-define-presentation-theme-contract.md) — Themes deterministically compose a complete set of semantic Slide Archetypes while preserving content and Media Intent within declared capacity, media, decoration, and customization boundaries.
- [Name, describe, and default the three themes](03-name-describe-and-default-the-themes.md) — Use stable Editorial, Signal, and Field Notes names and identifiers, translated descriptions, and Editorial as the recommended deterministic fallback.
- [Specify Discovery and project-state theme behavior](04-specify-discovery-and-state-behavior.md) — Require explicit theme choice for new projects, persist theme and optional slide-font state together, handle legacy and invalid identifiers distinctly, and use focused restart paths for theme-only changes.
- [Specify theme-aware slide composition](05-specify-theme-aware-slide-composition.md) — Replace the universal image-right layout with seven shared archetypes, a common capacity floor, orientation-selected media variations, and distinct Editorial, Signal, and Field Notes composition grammars.
- [Set accessibility and Marp export acceptance criteria](06-set-accessibility-and-export-criteria.md) — Gate every theme on WCAG 2.2 AA visual thresholds, semantic HTML media, readable type, zero content collisions, offline fonts, and matching Markdown/HTML/PDF default outputs while keeping PPTX optional.
- [Specify generator integration and theme packaging](07-specify-generator-integration.md) — Resolve theme IDs through one catalog, snapshot a locked manifest-and-CSS package, emit shared semantic markup and complete media handoffs, and load the same project-local theme across Marp surfaces.
- [Decide the implementation sequence and verification plan](08-decide-implementation-sequence-and-verification.md) — Roll out reader-first through complete Editorial, Signal, and Field Notes vertical slices, then activate Discovery only after focused evals, a 24-slide render matrix, CI gates, and human identity review pass.

## Not yet specified

## Out of scope

- Implementing or releasing the changes to the production skills; this map ends at an implementation-ready specification.
- Shipping prototype sample images with the installed skills; they are throwaway comparison assets.
- Retrofitting already-generated presentation files; they remain unchanged unless explicitly regenerated later.
- Supporting arbitrary user-authored custom themes in the first version.
- Placing essential text over raster media; protected text regions are required in the first version and overlay compositions may be reconsidered later.
