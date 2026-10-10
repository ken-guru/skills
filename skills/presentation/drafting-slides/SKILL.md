---
name: drafting-slides
description: Drafts a slide deck as one editable Marp Markdown file, with a heading and speaker notes on every slide, citations for every factual claim, and a plan for each visual. Use when turning an approved storyline, an outline, or notes into slides, or when rewriting the slides of an existing Marp deck.
metadata:
  version: "3.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/presentation/CHANGELOG.md"
---

# Drafting slides

Write the Deck Source, `deck.md`: the single editable file every rendered output comes from. The Deck Folder layout is in [references/deck-folder.md](references/deck-folder.md).

Script paths below are relative to this skill's folder. Run each as one command with the folder's absolute path in front, never chained with `&&`, `$(…)`, or heredocs.

## Inputs

- **The argument**: `storyline.md` when it exists, or an outline or notes the person gives. If `storyline.md` lacks `approved: true`, say it is still a draft and offer to continue.
- **The Brief** (`brief.md`), when it exists: audience, length, language, look, and editorial preferences.
- **The Source Set** (`sources.md`), when it exists: every factual claim cites it.

## Workflow

```
- [ ] 1. Slides drafted with notes and citations
- [ ] 2. Prose edited
- [ ] 3. Visuals plan approved
- [ ] 4. Visuals made and placed
- [ ] 5. Deck checked
```

1. **Draft `deck.md`** in the format in [references/deck-source-format.md](references/deck-source-format.md): one slide per storyline topic, each with one Layout Class, one visible heading that states the slide's point, a short body, speaker notes written to be read aloud, and a `<!-- Visual intent: … -->` comment wherever a visual would help. See [references/writing-slides.md](references/writing-slides.md) for slide copy, timing, and notes.
2. **Edit the prose.** If `unslop` is installed, use it on headings, bodies, and notes with the Brief's tone, prefer, and avoid preferences. If not, apply the same care yourself: plain words, no filler, no inflated claims, the person's own voice, and every citation, number, and term left exactly as it is.
3. **Get the visuals plan approved.** Run `node scripts/drafting-slides.mjs plan --deck <folder>` and show the person the table: one row per Visual Intent with its layout and slot. Include the cost of any generated images in the same approval. Make nothing costly or slow before they approve.
4. **Make the visuals**, passing each one the `media/` path, the theme values, and the slot of its layout:
   - Diagrams: `creating-diagrams`, if installed. Otherwise, describe the diagram in the slide body as a short list and say a diagram is missing.
   - Charts: `creating-charts`, if installed, with data only from the person or the Source Set. Otherwise, show the data as a table.
   - Illustrations: `generating-images`, if installed. Otherwise, leave the Visual Intent in place and say no image was made.

   Theme values come from `rendering-slides theme-values` (see that skill). Then place each visual with ordinary image syntax and its alt text, followed by its caption. Put a chart's data table in the slide's speaker notes. Give every generated image a visible "AI-generated illustration" caption and alt text starting "AI-generated:".
5. **Check the deck.** Every slide has one visible heading, speaker notes, and a citation for every factual claim; every image has alt text or a `<!-- decorative -->` marker; the front matter has `title` and `lang`. If `rendering-slides` is installed, its `check` command verifies the scripted rules.

When the deck is drafted, the natural next step is rendering it: `rendering-slides`, if installed, applies the theme, exports the formats, and checks the Accessibility Bar ([references/accessibility-bar.md](references/accessibility-bar.md)).
