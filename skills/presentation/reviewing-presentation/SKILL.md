---
name: reviewing-presentation
description: Reviews a slide deck for factual accuracy and sourcing, language, legibility, accessibility, timing, and how the rendered slides look, and reports what to fix where. Use when someone asks to check, review, proofread, or critique a presentation or slide deck, in Marp, HTML, PDF, or PowerPoint.
metadata:
  version: "3.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/presentation/CHANGELOG.md"
---

# Reviewing a presentation

Find what would embarrass the speaker or exclude part of the audience, and say which stage fixes each problem. Review the deck as it is; change nothing unless the person asks.

Script paths below are relative to this skill's folder. Run each as one command with the folder's absolute path in front, never chained with `&&`, `$(…)`, or heredocs.

## What you can review

- **A Deck Folder** (see [references/deck-folder.md](references/deck-folder.md)): the full review, using `deck.md`, `sources.md`, `brief.md`, and the rendered `dist/`.
- **Any other deck** (Marp, HTML, PDF, or PowerPoint): review what the format exposes. Look at rendered pages as images. For a PPTX, read the slide and notes XML inside the file. Say which checks the format did not allow (for example: no speaker notes in a PDF, no sources to trace).

## Workflow

```
- [ ] 1. Scripted checks run
- [ ] 2. Facts and sources traced
- [ ] 3. Language read
- [ ] 4. Rendered slides looked at
- [ ] 5. Accessibility judged
- [ ] 6. Timing estimated
- [ ] 7. Findings reported
```

1. **Scripted checks.** If `rendering-slides` is installed, run its `check` command on the Deck Folder and include its findings. If it is not, check the Accessibility Bar's scripted rules yourself from [references/accessibility-bar.md](references/accessibility-bar.md).
2. **Facts and sources.** Every factual claim in the slides and notes cites a Source Set entry that actually supports it, with the same numbers and wording. Flag claims with no citation, citations that do not support the claim, and numbers that differ from the source. Opinions and personal experience must be labelled as such.
3. **Language.** Read every heading, body, and note. If `unslop` is installed, use it to find prose problems, with the Brief's tone, prefer, and avoid preferences. Otherwise look for filler, inflated claims, jargon the audience will not know, inconsistent terms, typos, and a voice that does not match the speaker.
4. **Rendered slides.** Look at every slide image (`dist/slides/`, or render them): text overflowing or too small to read, overlapping elements, unreadable contrast, a visual that does not make its point, a missing "AI-generated illustration" label.
5. **Accessibility judgement.** The scripts cannot judge these; you must: headings that say what the slide is about, alt text that says what matters in the image, a reading order that makes sense, colour never the only way to tell things apart, no text inside images, and link text that is clear in context.
6. **Timing.** Run `node scripts/reviewing-presentation.mjs timing --deck <folder>`. It estimates speaking time from the notes and compares it with the Brief's length.
7. **Report** the Findings in the conversation, using [references/findings.md](references/findings.md): grouped by the stage that owns each fix, most serious first, each with the slide, the problem, and the fix.

An unsupported claim goes back to Research: say what evidence is missing, and that `researching-sources` (if installed) can find it, rather than suggesting the claim simply be deleted.
