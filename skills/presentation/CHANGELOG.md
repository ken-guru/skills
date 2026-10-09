# Changelog

## 3.0.0

A full replacement of the 2.x suite with four suite skills and four general-purpose Standalone Skills. See [ADR 0001](docs/adr/0001-rebuild-as-skill-native-skills.md).

### What you need to do

This is a breaking release. Every 2.x skill is removed.

1. **Plugin users** (`presentation-skills`): update the plugin. The new skills replace the old ones automatically.
2. **`npx skills` users**: remove the eight 2.x skills, then install the new ones:

   ```bash
   npx skills@latest add ken-guru/skills \
     --skill planning-presentation --skill drafting-slides \
     --skill rendering-slides --skill reviewing-presentation \
     --skill researching-sources --skill creating-diagrams \
     --skill creating-charts --skill generating-images
   ```

3. **Install the tools once**, outside your harness's sandbox: run `setup` for `rendering-slides`, `creating-diagrams`, and `creating-charts` (each skill names the exact command when a tool is missing).
4. **Old Project Folders are not converted.** Start a new Deck Folder; you can paste an old Agenda into `planning-presentation` as your outline.
5. To stay on 2.x, pin the last 2.x commit: `npx skills@latest add ken-guru/skills#878e311` (2.x was never tagged).

| 2.x skill | 3.0.0 replacement |
|---|---|
| `build-presentation` | none: start with `planning-presentation`; each skill names the next one |
| `discover-presentation`, `structure-agenda` | `planning-presentation` (Interview and Storyline) |
| `generate-slides` | `drafting-slides` (the Deck Source) and `rendering-slides` (theme and export) |
| `generate-diagrams` | `creating-diagrams` |
| `generate-images` | `generating-images` |
| `proofread-presentation`, `presentation-validation` | `reviewing-presentation` (judgement) and `rendering-slides`' `check` (scripted rules) |

### Changes

- `rendering-slides`: installs a pinned Marp CLI and chrome-headless-shell into the shared tool cache, applies the Editorial theme to a Deck Folder, and renders HTML, a tagged PDF with an outline, and a speaker-notes script, with a slide-picture PPTX and PNG images on request. Explains sandbox failures per harness.
- `planning-presentation`: interviews in rounds of numbered questions with recommended answers until nothing important is unclear, challenges premises, writes a confirmed Brief, gets sources vetted (through `researching-sources` when installed, light research otherwise, never skipped silently), and builds an approved Storyline that fits the length.
- `drafting-slides`: writes the Deck Source with one Layout Class and one heading per slide, read-aloud speaker notes, Source Set citations, and Visual Intents; `plan` lists the visuals plan with each layout's slot for approval; places diagrams, charts, and generated images through the general-purpose skills when installed, and covers for them when not.
- `reviewing-presentation`: reviews facts and sourcing, language, rendered slides, accessibility judgement, and timing (`timing` estimates speaking time from the notes against the Brief's length), and reports Findings in the conversation grouped by the stage that owns each fix. Works on decks the suite did not build, as far as the format allows.
- `rendering-slides` ships Editorial Inverse (dark) beside Editorial, and builds brand themes from a brand file: colours, fonts from supplied files, and a title-slide logo, never layout or sizing. Brand colours that miss the Accessibility Bar are written as given and reported with a passing shade. `render` copies `media/` and `fonts/` into `dist/`, so the HTML deck works from there.
- The `presentation-skills` plugin bundles all eight skills. `claude plugin eval` cases cover the four baseline scenarios (a sourced team update, a diagram-heavy request flow, a lightning talk with notes, storyline first) and a should-not-fire case; `verification/smoke/run.sh` runs the same scenarios in Copilot CLI and Codex.
- `rendering-slides` checks every render against the Accessibility Bar: headings, alt text, background images, `lang` and `title`, table headers, link text, theme colour pairs (with a passing shade suggested), contrast and 20 px text measured on the rendered slides, overflow, a tagged PDF with an outline, marked generated images, and images missing from the Deck Folder. `check` runs them without rendering.
