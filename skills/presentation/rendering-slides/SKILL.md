---
name: rendering-slides
description: Renders a Marp slide deck to HTML, a tagged PDF, and a speaker-notes script with a polished theme, installing the pinned tools it needs and checking the result. Use when a deck needs exporting, a look applied or changed, or a PDF, PowerPoint, or slide images made from Marp Markdown.
metadata:
  version: "3.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/presentation/CHANGELOG.md"
---

# Rendering slides

Turn a Deck Folder's `deck.md` into the Rendered Deck, in the deck's theme, and prove the result is readable and accessible.

Script paths below are relative to this skill's folder. Run each as one command with the folder's absolute path in front, never chained with `&&`, `$(…)`, or heredocs. The Deck Folder layout is in [references/deck-folder.md](references/deck-folder.md).

## Workflow

```
- [ ] 1. Tools installed
- [ ] 2. Theme in place
- [ ] 3. Rendered
- [ ] 4. Slides looked at
```

1. **Tools.** Run `node scripts/rendering-slides.mjs setup --status`. If anything is missing, ask the person to run `node scripts/rendering-slides.mjs setup` once, outside the sandbox: it installs a pinned Marp CLI and browser with verified checksums into a shared cache. On Linux it may print one package-install command for the person to run; never run `sudo` yourself.
2. **Theme.** If the Deck Folder has no `theme.css`, apply the look from the Brief: `node scripts/rendering-slides.mjs theme --deck <folder> --name editorial` (light) or `--name editorial-inverse` (dark). `deck.md` must say `theme: deck` in its front matter. To change the look later, run `theme` again.
3. **Render.** Run `node scripts/rendering-slides.mjs render --deck <folder>`. It writes `dist/deck.html` (to present from, and the accessible version), `dist/deck.pdf` (tagged, with an outline), and `dist/deck-notes.md` (the speaker-notes script). Add `--pptx` only when the person asks for PowerPoint, and say it is made of slide pictures, so it is neither editable nor accessible. Add `--images` for PNG slide images.
4. **Look.** Render with `--images` and look at every slide: text overflowing its slot, overlapping elements, unreadable contrast, a visual that misses its caption. Fix the source (`deck.md`, `theme.css`, or `media/`), never `dist/`, and render again.

## The Accessibility Bar

Every `render` ends with the scripted checks of the [Accessibility Bar](references/accessibility-bar.md): one visible heading per slide, alt text or a decorative marker on every image, no content in background images, `lang` and `title` set, table headers, descriptive link text, the theme's colour pairs, contrast and 20 px minimum text measured on the rendered slides, a tagged PDF with an outline, and the label and alt prefix on generated images. A finding names the slide and the fix; correct the source and render again. Run `node scripts/rendering-slides.mjs check --deck <folder>` to check without rendering.

The checks cannot judge whether headings and alt text are meaningful, whether the reading order makes sense, or whether colour is the only signal in a picture. Say so when reporting, and leave those to a review.

## When the render fails

- **The sandbox blocks the browser.** The error says so and explains how to allow that one render command outside the sandbox for the harness in use. Pass this on to the person; never change their harness settings yourself.
- **A tool is missing.** The error names the exact `setup` command.

## Theme values for visuals

Diagrams and charts do not inherit the deck's CSS. Run `node scripts/rendering-slides.mjs theme-values --deck <folder>` and save its JSON output as the theme values file passed to `creating-diagrams` and `creating-charts`, together with the slot of the slide's Layout Class (`--slot-split`, `--slot-visual`, `--slot-default`).

When the deck is rendered and checked, the natural next step is a review: `reviewing-presentation`, if installed, checks facts, timing, and the rendered result.
