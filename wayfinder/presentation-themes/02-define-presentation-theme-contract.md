# Define the Presentation Theme contract

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Choose the three visual directions through mini-deck prototypes](01-prototype-three-theme-mini-decks.md)

## Question

What invariant capabilities and boundaries define a Presentation Theme across palettes, typography, spacing, decorative geometry, image treatment, and slide-type composition without allowing a theme to alter presentation content or media intent?

## Resolution

A Presentation Theme is a closed, deterministic visual system that composes theme-independent Slide Archetypes without changing their content, semantic role, Media Intent, or presenter meaning.

### Ownership

- Generation owns content, Media Intent, presenter meaning, Slide Archetype selection, and restructuring content that exceeds Content Capacity.
- A Presentation Theme owns palette, typography, spacing, decorative geometry, media framing, and archetype composition.
- A theme cannot hide, summarize, invent, reorder, or substitute content or media, and cannot reclassify a Slide Archetype.

### Required capabilities

- Every theme implements the complete core archetype set: title, section, text-only, text-plus-image, data, diagram, and quotation.
- Each archetype composition declares Content Capacity. A theme may adjust spacing and type only within approved ranges; it may not clip content, hide overflow, or compress text below readability limits.
- Missing core-archetype support is a validation error. Themes never fall back into one another or into an unthemed layout.
- A theme may define multiple named Archetype Variations with explicit applicability rules. Generation selects them deterministically from content shape, media orientation, and other declared inputs.
- Controlled light, dark, or accent-heavy variations are allowed when the visual system remains recognizably one theme.
- The same inputs must produce the same composition on regeneration.

### Media boundary

- Themes may crop, mask, frame, border, shadow, grade, and set aspect ratio for media only while every subject, label, relationship, encoding, and other part of its Media Intent remains perceptible.
- Themes must not obscure referenced details, change chart encodings, recolor semantic status cues, or substitute different media.
- Theme-aware media prompting may contribute palette, texture, photographic treatment, line style, and background compatibility. It must not rewrite image Concept or Elements, nor diagram Message, Show, or Takeaway.

### Decoration and customization

- Decorative Elements remain non-semantic, stay outside the Slide's reading order, and never obstruct content or media. They may not imply status, sequence, quantity, or relationships absent from the content.
- The first version exposes no user-configurable palette, spacing, geometry, or media-treatment tokens. Such changes would create a custom theme, which is outside this map's scope.
- The sole supported exception is an explicitly requested font. The requested font is followed by the theme's offline-safe fallback stack; failure to load produces a warning rather than a broken deck. Content Capacity is validated against the fallback stack.

### Context pointer

[Presentation theme domain glossary](../../CONTEXT.md)
