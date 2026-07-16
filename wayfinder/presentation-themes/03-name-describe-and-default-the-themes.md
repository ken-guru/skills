# Name, describe, and default the three themes

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Choose the three visual directions through mini-deck prototypes](01-prototype-three-theme-mini-decks.md)

## Question

What final names and concise user-facing descriptions should the three selected themes have, and which one should be the default when older or incomplete project state has no explicit selection?

## Resolution

The first version uses three stable, untranslated theme names and machine identifiers. Discovery presents them in this order:

1. `editorial` — **Editorial** — “Warm, typographic, and composed like a modern magazine.”
2. `signal` — **Signal** — “Bold, high-contrast, and structured for energy, systems, and data.”
3. `field-notes` — **Field Notes** — “Tactile, natural, and shaped like a documented working session.”

Editorial is shown first and marked as recommended. It is also the deterministic fallback when older or incomplete project state contains no explicit theme selection. Generation must not infer a replacement from topic or audience when the stored value is absent.

The names and identifiers remain stable in every language so project state, documentation, and support conversations use one vocabulary. Discovery translates the selection prompt and descriptions into the user's language. These names are canonical for the first version but remain reversible in a later version.

### Context pointer

[Comparative theme prototype](../../verification/presentation-themes/prototype/README.md)
