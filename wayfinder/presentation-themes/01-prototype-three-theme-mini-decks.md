# Choose the three visual directions through mini-deck prototypes

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:prototype`
Status: Closed
Assignee: Codex
Blocked by: None

## Question

Which concrete visual systems should become the three production Presentation Themes after comparing Editorial, Signal, and Field Notes as radically different four-slide mini-decks using identical content and throwaway sample images?

The prototype must be a clearly marked throwaway UI artifact near `generate-slides`, offer all three variants on one route via `?variant=`, include the floating keyboard-accessible switcher required by the `prototype` skill, and expose enough theme state to make the comparison legible. Use the `generate-images` skill to create one coherent sample image set shared by every variant.

## Resolution

Editorial, Signal, and Field Notes are approved as the three visual directions to carry into the production-theme specification. Together they provide meaningfully different visual grammars rather than palette swaps:

- Editorial: warm paper, serif-led hierarchy, asymmetric magazine composition, and framed photography.
- Signal: electric contrast, modular technical grids, clipped media, and metric-forward composition.
- Field Notes: natural color, tactile collage, documentary imagery, organic marks, and informal annotation.

Every direction was compared as the same four-slide mini-deck using the same two images generated from the shared throwaway image specification. User review found the set strong enough to continue; the only reported defect was Editorial's third-slide chart overlapping its title. Moving the chart's vertical anchor from `10cqw` to `21cqw` corrected the composition without changing its typography or width.

### Context pointer

[Throwaway presentation theme gallery](../../verification/presentation-themes/prototype/README.md)
