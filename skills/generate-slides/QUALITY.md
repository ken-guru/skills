# Quality Validation

Run this validation pass after generating `PRESENTASJON.md` and before building HTML.

## Auto-fixable issues (fix silently)

| Check | Fix |
|---|---|
| Background image directives `![bg` | Replace with `<img class="img-right">` equivalent |
| Centered images with `![alt](path)` on non-title slides | Wrap as `<img class="img-right">` |
| Missing `alt` attribute on `<img>` tags | Add descriptive alt text from context |
| Trailing whitespace in presenter notes | Strip |

## Issues to report with slide number (do not auto-fix)

| Check | Warning message |
|---|---|
| Code fences (` ``` `) in slides | "⚠️ Slide X: Code block detected — consider using an image/video instead" |
| More than 6 bullet points on a slide | "⚠️ Slide X: X bullet points — consider splitting the slide" |
| Progressive reveal syntax (`* `) | "⚠️ Slide X: Progressive reveal detected — remove the `* ` prefix" |
| Slide with no presenter notes | "⚠️ Slide X: Missing presenter note" |
| Video not on its own slide (other content present) | "⚠️ Slide X: Video must always be on a dedicated blank slide" |
| Image using `![bg left]` or `![bg right]` | "⚠️ Slide X: Background images are not supported — use `<img class='img-right'>` instead" |

## Content checks (report if issues found)

- All slides have a heading (H1 or H2) — warn if any slide has only bullet points and no heading
- Slides reference image files that don't exist yet — list placeholders in the final report (expected)
- Front matter contains `marp: true`, `paginate: true`, `class: invert`, and `style:` block

## Checklist summary (output at end)

```
✅ No code blocks
✅ All slides within viewport
✅ Presenter notes in bullet format
✅ Correct front matter
⚠️ X warnings to review (see above)
```

---

## Proofreading pass

Run after all slides are generated, before building HTML.

### Language and grammar
- [ ] No obvious spelling errors in the presentation language
- [ ] Grammar consistent throughout (follow conventions of the presentation language)
- [ ] No mixed-language sentences (content language mixed with different language sentence structure)
- [ ] No encoding errors or unexpected characters (look for characters outside expected range)
- [ ] Correct spacing around punctuation (no double spaces, correct colon usage)

### Terminology consistency
- [ ] All terms match the Glossary section in AGENDA.md
- [ ] No synonyms used interchangeably (e.g. "agent" and "agents" must be used consistently)
- [ ] Abbreviations explained on first use

### Reference integrity
- [ ] All `src` paths in `<img>` tags exist as entries in IMAGE_SPEC.md
- [ ] All `[Source](url)` links in slides were actually fetched (cross-check with Step 2 report)
- [ ] No internal links pointing to non-existent anchors

### Slide count
- [ ] Actual slide count matches the estimate in DISCOVERY.json (± 10%)

Report the proofreading result as part of the Step 8 summary:
```
📝 Proofreading:
✅ No encoding errors or unexpected characters
✅ Terminology consistent with glossary
⚠️ X potential grammar issues (see slide [list])
✅ Image references validated against IMAGE_SPEC.md
✅ X slides — within estimated count ([estimate] ± 10%)
```
