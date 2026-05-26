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
| Code fences (` ``` `) in slides | "⚠️ Slide X: Kodeblokk oppdaget — vurder å bruke bilde/video i stedet" |
| More than 6 bullet points on a slide | "⚠️ Slide X: X kulepunkter — vurder å dele opp sliden" |
| Progressive reveal syntax (`* `) | "⚠️ Slide X: Progressiv avsløring oppdaget — fjern `* ` prefix" |
| Slide with no presenter notes | "⚠️ Slide X: Mangler presentatørnotat" |
| Video not on its own slide (other content present) | "⚠️ Slide X: Video skal alltid være på en dedikert blank slide" |
| Image using `![bg left]` or `![bg right]` | "⚠️ Slide X: Bakgrunnsbilder støttes ikke — bruk `<img class='img-right'>` i stedet" |

## Content checks (report if issues found)

- All slides have a heading (H1 or H2) — warn if any slide has only bullet points and no heading
- Slides reference image files that don't exist yet — list placeholders in the final report (expected)
- Front matter contains `marp: true`, `paginate: true`, `class: invert`, and `style:` block

## Checklist summary (output at end)

```
✅ Ingen kodeblokker
✅ Alle slides innenfor viewport
✅ Presentatørnotater i kulepunktformat
✅ Riktig front matter
⚠️ X advarsler å gjennomgå (se over)
```
