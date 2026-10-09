# Changelog

## 3.0.0

A full replacement of the 2.x suite with four suite skills and four general-purpose Standalone Skills. See [ADR 0001](docs/adr/0001-rebuild-as-skill-native-skills.md).

- `rendering-slides`: installs a pinned Marp CLI and chrome-headless-shell into the shared tool cache, applies the Editorial theme to a Deck Folder, and renders HTML, a tagged PDF with an outline, and a speaker-notes script, with a slide-picture PPTX and PNG images on request. Explains sandbox failures per harness.
- `drafting-slides`: writes the Deck Source with one Layout Class and one heading per slide, read-aloud speaker notes, Source Set citations, and Visual Intents; `plan` lists the visuals plan with each layout's slot for approval; places diagrams, charts, and generated images through the general-purpose skills when installed, and covers for them when not.
- `rendering-slides` checks every render against the Accessibility Bar: headings, alt text, background images, `lang` and `title`, table headers, link text, theme colour pairs (with a passing shade suggested), contrast and 20 px text measured on the rendered slides, overflow, a tagged PDF with an outline, and marked generated images. `check` runs them without rendering.
