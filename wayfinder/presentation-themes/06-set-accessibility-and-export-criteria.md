# Set accessibility and Marp export acceptance criteria

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Choose the three visual directions through mini-deck prototypes](01-prototype-three-theme-mini-decks.md), [Define the Presentation Theme contract](02-define-presentation-theme-contract.md)

## Question

What measurable contrast, readability, overflow, image-legibility, offline-font, HTML, PDF, and PPTX acceptance criteria must every theme satisfy before it is considered implementable?

## Resolution

### Accessibility boundary

- `PRESENTASJON.html` is the Accessible Reference Output used to evaluate semantic headings, reading order, text alternatives, and visual accessibility.
- `PRESENTASJON.pdf` is a visual derivative that must preserve appearance and legibility but is not claimed to be a tagged, semantically equivalent accessible document.
- Standard Marp PPTX is image-backed, and editable PPTX is experimental with lower visual reproducibility. PPTX remains a documented manual export, not a default output or theme acceptance gate.
- Do not claim full WCAG conformance for every export. The HTML reference must satisfy the semantic requirements below and the WCAG 2.2 AA visual criteria in scope.

Primary references:

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C technique H37: alt attributes on images](https://www.w3.org/WAI/WCAG22/Techniques/html/H37)
- [Marp CLI export documentation](https://github.com/marp-team/marp-cli/blob/main/README.md)

### Contrast and use of color

Every theme and every tonal state must provide:

- At least 4.5:1 contrast for body text, captions, attributions, pagination, and labels.
- At least 3:1 contrast for large headings and display text.
- At least 3:1 contrast for meaningful chart lines, diagram boundaries, data markers, and other semantic non-text graphics against adjacent colors.
- Meaning conveyed by text, shape, pattern, or position in addition to color.
- Contrast exemptions only for genuinely non-semantic Decorative Elements.

### Typography and readability

On the 16:9, 1280×720 reference slide:

- Title text is at least 54 px.
- Slide headings are at least 36 px.
- Body text and metric labels are at least 28 px.
- Captions and attribution are at least 20 px.
- Pagination and short context labels are at least 18 px; no informational text may be smaller.
- Body line height remains between 1.25 and 1.5. Display-heading line height is at least 1.0.
- All-caps text is limited to short labels and brief Signal display headings, never paragraphs or long quotations.

All thresholds are measured against the actual offline fallback font, including when an External Font Override is configured.

### Semantic media and reading order

- Every meaningful Picture, chart, and Diagram has purpose-based alternative text that communicates its function, not merely its appearance or type.
- Chart and Diagram alt text summarizes the key relationship or takeaway; presenter notes contain the fuller explanation.
- Decorative images use empty alt text, and Decorative Elements are excluded from the reading order with the appropriate HTML semantics.
- DOM reading order is heading, body or takeaway, media, then caption, regardless of visual placement.
- Essential wording is rendered as text, never baked into raster imagery.

### Overflow and collision

Every theme/archetype fixture populated to the shared Content Capacity minimum must pass at 1280×720:

- No text or semantic media extends outside the slide.
- Protected Content Slots do not overlap.
- No scrollbar, clipped glyph, cut-off caption, hidden list item, or truncated label exists.
- Essential content remains at least 32 px from the slide edge.
- Decorative or media bleed may enter the safe margin only when it cannot cover, clip, or imply meaning.

Any essential-content overflow or protected-region collision is fatal, not a warning.

### Media legibility

- Picture dimensions agree with Intended Media Orientation.
- Raster media is not enlarged beyond its native dimensions in the 1280×720 reference render.
- Cropping retains every subject and detail named by Media Intent.
- Diagram labels and chart values remain readable at 100% slide view.
- Diagram output uses SVG when available. Raster fallbacks render at least twice their displayed pixel dimensions.
- Theme filters and grading preserve distinguishable semantic colors and required contrast.

Orientation mismatch, lost focal detail, unreadable labels, destructive color treatment, or visible pixelation is fatal.

### Offline fonts

- Bundled themes pass generation and export with network access disabled and issue zero font requests.
- Content Capacity is tested with the final generic fallback in each stack, not the most favorable locally installed font.
- An External Font Override may request an approved online source, but the same deck must export offline using the theme fallback and report the substitution.

### Default outputs and export parity

Default Generation produces:

- `PRESENTASJON.md`, ready to serve with `marp -s`.
- `PRESENTASJON.html`.
- `PRESENTASJON.pdf`.

For every theme capacity fixture:

- Markdown parses and serves successfully with Marp.
- HTML and PDF export successfully with local-file access enabled.
- HTML and PDF contain identical slide counts, 16:9 dimensions, textual content, media, and pagination.
- Export emits no missing-asset, blocked-local-file, or bundled-font warning.
- PDF shows no layout shift, clipping, missing decoration, materially different color, or illegible media relative to the HTML reference.
- PDF opens successfully in an independent viewer.

PPTX remains available through the documented manual Marp command but is outside the default output set and acceptance matrix.

Any failure in contrast, typography, overflow, semantic media, reading order, orientation, media legibility, offline-font rendering, or required export parity blocks theme acceptance.

### Context pointer

[Presentation theme domain glossary](../../CONTEXT.md)
