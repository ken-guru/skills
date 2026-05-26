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

---

## Proofreading pass

Run after all slides are generated, before building HTML.

### Språk og grammatikk
- [ ] Ingen åpenbare stavefeil i norsk tekst
- [ ] Grammatisk kjønn konsistent (en/ei/et — følg Språkrådet bokmål)
- [ ] Ingen blandingsspråk-setninger (norsk tekst med engelsk setningsstruktur)
- [ ] Ingen kyrilliske tegn eller enkodingsfeil (søk: tegn utenfor Latin Extended)
- [ ] Korrekt mellomrom rundt tegnsetting (ingen doble mellomrom, riktig kolon-bruk)

### Terminologikonsistens
- [ ] Alle termer matcher `## Begreper og definisjoner` i AGENDA.md
- [ ] Ingen synonymer brukt om hverandre (f.eks. "agent" og "agenter" må brukes konsekvent)
- [ ] Forkortelser forklart ved første bruk

### Referanseintegritet
- [ ] Alle `src`-stier i `<img>`-tagger finnes som oppføringer i IMAGE_SPEC.md
- [ ] Alle `[Kilde](url)`-lenker i slides ble faktisk hentet (kryssjekk med Step 2-rapport)
- [ ] Ingen interne lenker som peker på ikke-eksisterende ankere

### Slide-antall
- [ ] Faktisk slide-antall samsvarer med estimat i DISCOVERY.json (± 10 %)

Report the proofreading result as part of the Step 8 summary:
```
📝 Korrekturlesing:
✅ Ingen kyrilliske tegn eller enkodingsfeil
✅ Terminologi konsistent med ordlisten
⚠️ X potensielle grammatikkfeil (se slide [liste])
✅ Bildereferanser validert mot IMAGE_SPEC.md
✅ X slides — innenfor estimert antall ([estimate] ± 10 %)
```
