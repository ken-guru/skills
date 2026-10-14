# Accessibility Bar

Every deck meets WCAG 2.2 level AA. This file is the single statement of the bar; suite skills carry an identical copy in their `references/` folder, kept in step by CI.

## Visual criteria

| Criterion | Requirement |
|---|---|
| Text contrast (WCAG 1.4.3) | At least 4.5:1, or 3:1 for large text (24 px and up, or 18.7 px bold) |
| Graphics contrast (WCAG 1.4.11) | At least 3:1 for shapes, lines, borders, and chart marks against their background |
| Use of colour (WCAG 1.4.1) | Colour is never the only signal: diagram roles also differ by line style or weight, chart series by labels, shapes, or patterns |
| Text size | At least 20 px on the 1280×720 slide reference, for slide, diagram, and chart text |

## Structural criteria

| Criterion | Requirement |
|---|---|
| Non-text content (1.1.1) | Every image has alt text, unless it is marked decorative |
| Info and relationships (1.3.1) | Headings, lists, and tables are real Markdown structure, carried into the HTML and tagged PDF |
| Meaningful sequence (1.3.2) | Reading order follows source order; no CSS that reorders content |
| Images of text (1.4.5) | Text is real text, never drawn into an image |
| Page titled (2.4.2) | The deck has a `title` in its front matter |
| Link purpose (2.4.4) | Link text says where it goes; never a bare URL or "click here" |
| Headings (2.4.6) | Every slide has one visible heading. Headings need not be unique: a slide split in two may repeat its heading |
| Language (3.1.1, 3.1.2) | `lang` is set in the front matter; passages in another language use `<span lang="…">` |

## Deck Source rules

- One visible heading per slide, including `title`, `visual`, and `quote` slides (shown small, never hidden).
- Every image has non-empty alt text, except one with a `<!-- decorative -->` comment right next to it.
- Background images (`![bg](…)`) are for decoration only and always carry the decorative marker; content images use ordinary image syntax.
- `lang` and `title` are required in the front matter.
- `<span lang>` works in the HTML (the accessible version) but is lost in the PDF.

## Generated visuals

Every AI-generated visual carries a visible label on the slide (for example "AI-generated illustration", meeting the contrast and size criteria), alt text starting "AI-generated:", and a sidecar file beside it recording provider, model, prompt, and date. Diagrams and charts rendered from a spec are not generated in this sense.

## Outputs

- **HTML** is the accessible version: headings, reading order, and text alternatives.
- **PDF** is tagged, with an outline built from the slide headings.
- **Slide-picture PPTX** is neither editable nor accessible, and is always labelled so.

## Who checks what

| Checked by script (`rendering-slides`, on every render) | Judged by a person or `reviewing-presentation` |
|---|---|
| one visible heading per slide | headings are meaningful |
| alt text present, or the decorative marker | alt text says what matters |
| no content in background images | reading order makes sense |
| `lang` and `title` set | colour is not the only signal |
| table header rows | no images of text |
| link text is not a bare URL or "click here" | link text is clear in context |
| contrast pairs and 20 px minimum on rendered slides | |
| PDF tagged, with an outline | |
| generated images carry the label and alt prefix | |

For guidance on accessible presentations, see [Uutilsynet's PowerPoint guidance](https://www.uutilsynet.no/veiledning/powerpoint/229) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
