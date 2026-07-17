# Presentation themes

Editorial, Signal, and Field Notes are presentation-wide visual systems for the same semantic slide content. They make presentations recognizably different without changing their message, Media Intent, or reading order.

## How Presentation Themes behave

Each theme is deterministic: its typography, palette, spacing, decorative geometry, image treatment, and Slide Archetype composition rules remain consistent throughout a presentation. The selected Theme Package is snapshotted into the project so Markdown, HTML, and PDF use the same visual system. PPTX remains optional.

Exact layouts respond to the Slide Archetype, content length, and intended media orientation. A declared variation may be selected or over-capacity content may be split, so these examples are representative rather than fixed templates or pixel-identical promises.

## Compare the themes

Every example below contains the same content and uses the same production rendering path. Only the selected Presentation Theme changes.

The sample artwork was AI-generated for this comparison and is reused unchanged across all themes. The themes control its placement, crop, framing, and treatment—not its underlying artistic style.

### Title

#### Editorial

![Editorial title slide on a warm cream canvas with an asymmetric serif headline, fine red rule, circular portrait frame, and restrained page furniture](assets/presentation-themes/editorial-title.png)

#### Signal

![Signal title slide on a near-black technical grid with a condensed uppercase headline, cyan label, pink rule, and sharply angled portrait panel](assets/presentation-themes/signal-title.png)

#### Field Notes

![Field Notes title slide on textured cream paper with a green serif headline, red handwritten label, gold underline, and loosely taped portrait print](assets/presentation-themes/field-notes-title.png)

### Text plus image

#### Editorial

![Editorial text-plus-image slide with a compact serif heading and bullet list on the left, a clean portrait frame on the right, and an italic caption below](assets/presentation-themes/editorial-text-plus-image.png)

#### Signal

![Signal text-plus-image slide with an uppercase heading and neon rule on the left, a dark grid canvas, and a tall angled portrait treatment on the right](assets/presentation-themes/signal-text-plus-image.png)

#### Field Notes

![Field Notes text-plus-image slide with a taped portrait print on the left, serif heading and bullets on the right, and a handwritten-style caption beneath the image](assets/presentation-themes/field-notes-text-plus-image.png)

### Data

#### Editorial

![Editorial data slide with a large serif heading in a narrow left column and four measured cream metric cells arranged as a red-ruled grid](assets/presentation-themes/editorial-data.png)

#### Signal

![Signal data slide with a fluorescent yellow canvas, condensed black heading, and four near-black metric cards separated by cyan and pink accents](assets/presentation-themes/signal-data.png)

#### Field Notes

![Field Notes data slide with a green serif heading, gold underline, italic takeaway, and four softly colored hand-drawn oval metrics](assets/presentation-themes/field-notes-data.png)

### Quotation

#### Editorial

![Editorial quotation slide with an aubergine canvas, large cream serif quotation, pale vertical rule, small gold label, and restrained attribution](assets/presentation-themes/editorial-quotation.png)

#### Signal

![Signal quotation slide with a dark grid, oversized condensed white quotation, cyan label, pale vertical bar, and a vivid pink attribution strip](assets/presentation-themes/signal-quotation.png)

#### Field Notes

![Field Notes quotation slide on textured paper with a centered green serif quotation, pale blue rule, gold underline, red handwritten label, and botanical decoration](assets/presentation-themes/field-notes-quotation.png)

## Choosing a theme

These affinities are suggestions, not subject-matter restrictions. Every bundled theme supports the complete core Slide Archetype set.

### Editorial

Warm, typographic, and composed like a modern magazine. Choose it for polished narratives, proposals, strategy, and reports. Editorial is the recommended default.

### Signal

Bold, high-contrast, and structured for energy, systems, and data. Choose it for energetic launches, system explanations, and data-forward stories.

### Field Notes

Tactile, natural, and shaped like a documented working session. Choose it for workshops, research, retrospectives, and human-centered stories.

## What stays consistent

- One theme applies to the entire presentation.
- Palette, offline-safe typography, spacing, decoration, and media framing come from that theme.
- Slide compositions are selected deterministically from declared content and media inputs.
- Semantic content, Media Intent, and accessible reading order remain unchanged.
- The project-local Theme Package keeps Markdown, HTML, and PDF aligned across regeneration.

## What can vary

- Different Slide Archetypes use different compositions within the same visual system.
- Portrait and landscape media select their declared variations.
- Content that exceeds a composition's capacity is split rather than clipped or shrunk below readability limits.
- An explicitly requested external slide font can override the default stack; bundled themes themselves use offline-safe fonts.
- A later, explicitly approved Theme Package refresh can intentionally update a project's rendering.

## Themes and generated media

A Presentation Theme controls how media is placed, cropped, framed, graded, and visually integrated. The approved Media Spec controls what an image or diagram communicates and, for generated imagery, the artistic prompt. A theme preserves that Media Intent; it does not replace the subject, labels, relationships, or underlying artwork.

The gallery portrait is a committed comparison fixture, not a theme-owned asset and not an image that generated presentations automatically receive.

## Select or change a theme

New presentations choose Editorial, Signal, or Field Notes during Discovery immediately after visual preference. Theme names and identifiers remain stable even when their descriptions are translated into the presentation language.

For an existing presentation, rerun Discovery to select another theme. A theme change can regenerate Media Specs and presentation outputs, so the workflow reports every affected artifact and asks for confirmation before invalidating it. Use the skills rather than manually editing `DISCOVERY.json`, theme locks, project snapshots, or project-local CSS.

[Build a presentation with the guided workflow](../skills/build-presentation/SKILL.md), or use [Discover Presentation](../skills/discover-presentation/SKILL.md) to start or revise the brief.
