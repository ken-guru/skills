# Specify theme-aware slide composition

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Choose the three visual directions through mini-deck prototypes](01-prototype-three-theme-mini-decks.md), [Define the Presentation Theme contract](02-define-presentation-theme-contract.md)

## Question

Which slide archetypes and composition rules must each selected theme define so title, section, text-plus-image, data/diagram, quotation, and text-only slides remain recognizably related without collapsing into palette swaps?

## Resolution

Replace the global `img-right` golden rule with theme-specific compositions. Retain shared Marp safety constraints: media must use declared classes or composition wrappers, content may not clip, and background-image directives remain forbidden. `img-right` may exist as one named variation but is not the universal layout.

### Core archetypes and Content Slots

Every theme implements these seven Slide Archetypes using the same theme-independent Content Slots:

- **Title:** title, optional subtitle/context, optional hero image.
- **Section:** section title and optional short orientation line; no body list.
- **Text-only:** heading plus short body, bullets, or numbered steps.
- **Text-plus-image:** heading, short body/list, one Picture, and optional caption.
- **Data:** heading, one primary quantitative message, one chart or 1–4 metrics, and optional takeaway.
- **Diagram:** heading, one diagram, and optional caption/takeaway.
- **Quotation:** quotation, attribution, and optional context label.

Data and Diagram are distinct. Data protects scales, legends, metric hierarchy, and semantic encodings; Diagram protects labels, entities, sequence, hierarchy, and relationship geometry.

Themes may arrange populated Content Slots but cannot invent filler copy. Video remains governed by the existing dedicated-slide rule rather than joining the core archetype set.

### Initial variation set

- One required composition per core archetype.
- Text-plus-image additionally defines `portrait` and `landscape` Archetype Variations.
- Intended Media Orientation is required on Picture entries in the Media Specs and deterministically selects the matching variation before rendering.
- Existing media uses its actual dimensions. If they contradict the declared orientation, validation reports the mismatch instead of silently switching composition.
- Light, dark, and accent treatments are tonal states within a composition, not additional recipes.
- Further variations wait for rendered-deck evidence of repetition or capacity failures.

### Shared Content Capacity minimum

Every theme must render at least:

- Title: 3 title lines and 2 subtitle lines.
- Section: 3 title lines and 2 orientation lines.
- Text-only: 2 heading lines and up to 5 bullets, each wrapping to 2 lines.
- Text-plus-image: 2 heading lines, up to 4 bullets at 2 lines each, and 2 caption lines.
- Data: 2 heading lines, one chart or 4 metrics, and 2 takeaway lines.
- Diagram: 2 heading lines, one diagram, and 2 caption/takeaway lines.
- Quotation: 4 quote lines, 2 attribution lines, and 1 context-label line.

A tighter aesthetic composition is valid only when Generation deterministically selects a roomier variation or splits the slide. Exact font sizes and measurable readability thresholds belong to [Set accessibility and Marp export acceptance criteria](06-set-accessibility-and-export-criteria.md).

### Shared composition safety

- Essential textual Content Slots never overlay raster media in the first version. Text occupies protected solid-color regions outside the image.
- Decorative frames and shapes may overlap media edges without covering its Media Intent.
- Pagination remains semantic and visible. Decorative numbers may not impersonate slide sequence.
- Pictures may be framed, clipped, or graded within the media boundary. Diagrams and Data remain in protected regions without decorative cropping.

### Editorial composition grammar

- Paper-toned canvas, strong margins, folios, fine rules, serif display type, and restrained coral/aubergine accents.
- **Title:** asymmetric text block with circular or framed hero image.
- **Section:** oversized section number and title with generous negative space.
- **Text-only:** editorial column with standfirst and ruled list or steps.
- **Text-plus-image:** framed portrait beside copy; landscape media becomes a wide lower band or offset side frame.
- **Data:** statement-led heading paired with restrained band, table, chart, or metric composition.
- **Diagram:** protected paper panel with caption and folio; no crop or color grading.
- **Quotation:** aubergine field, large serif quotation, and small editorial stamp.

### Signal composition grammar

- Dark modular grid, uppercase grotesk/monospace hierarchy, visible slide indices, and controlled acid-yellow, cyan, and magenta accents.
- **Title:** stacked display headline with clipped hero media in a contrasting grid region.
- **Section:** large numeric marker and compressed section title on an accent field.
- **Text-only:** modular rows or numbered blocks rather than a conventional bullet column.
- **Text-plus-image:** landscape media uses an angled split; portrait media occupies a vertical grid module beside structured copy.
- **Data:** high-contrast metric modules or chart panels with stable semantic colors.
- **Diagram:** full protected grid region with minimal surrounding chrome.
- **Quotation:** oversized uppercase statement with one highlighted phrase and structured footer.

### Field Notes composition grammar

- Warm paper, sage/mustard/coral accents, humanist text, serif emphasis, documentary imagery, and restrained collage marks.
- **Title:** handwritten-style context label, large serif title, and taped photograph.
- **Section:** quiet paper field with organic marker, section title, and short orientation line.
- **Text-only:** observation label, conversational heading, and arrow-led notes or steps.
- **Text-plus-image:** portrait media uses a slightly rotated print beside notes; landscape media becomes a wide documentary print with copy outside the image.
- **Data:** clearly separated circles, hand-drawn axes, or annotated metric groups that preserve exact values and encodings.
- **Diagram:** protected paper panel; organic annotations stay outside nodes, labels, and connectors.
- **Quotation:** spacious serif quote with understated underline, pressed-flower-like Decorative Element, and attribution.

Tape, scribbles, arrows, grid lines, signal bars, folios, and similar marks remain Decorative Elements unless their meaning is explicitly supplied by content.

### Context pointers

- [Comparative theme prototype](../../verification/presentation-themes/prototype/README.md)
- [Presentation theme domain glossary](../../CONTEXT.md)
