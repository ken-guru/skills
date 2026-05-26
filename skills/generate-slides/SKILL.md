---
name: generate-slides
description: Generate PRESENTASJON.md and PRESENTASJON.html from an approved AGENDA.md. Fetches and summarizes sources, validates output, and builds final HTML. Requires DISCOVERY.json and AGENDA.md.
---

# Generate Slides

Renders the final presentation from an approved `AGENDA.md`.

## Startup

Run validation checks per [../shared/validation.md](../shared/validation.md). Abort if any errors are returned.

Check that `DISCOVERY.json` exists. If not:
> ❌ `DISCOVERY.json` ikke funnet. Kjør `discover-presentation` først.
Abort.

Check that `AGENDA.md` exists (path from `DISCOVERY.json`). If not:
> ❌ `AGENDA.md` ikke funnet. Kjør `structure-agenda` for å bygge agendaen.
Abort.

If the current project folder already has files, confirm with the user before writing new ones.

## Procedure

### Step 1: Scaffold project (new projects only)

Create all files and folders per [SCAFFOLD.md](SCAFFOLD.md) if they do not already exist.

### Step 2: Fetch and summarize sources

For every `[Kilde](url)` link in `AGENDA.md`:
- Fetch the URL
- Summarize to `docs/sources/<slug>.md` in concise markdown
- Include: key facts, statistics, quotes, and context useful for slides
- Note the original URL at the top of each summary file

Skip any URL marked `(IKKE BESØK)`.

**Error handling:** Collect all failed fetches. Do not halt generation. Report failures at the end.

### Step 3: Generate IMAGE_SPEC.md

Before writing any slides, produce `IMAGE_SPEC.md` — a structured specification for every image in the presentation.

For each slide that requires a visual, write an entry:

```markdown
## Slide [N] — [Slide Title]
- **Konsept:** [what the image must communicate]
- **Stil:** [mood, colour scheme, rendering style — e.g. "dark background, neon accent, technical diagram"]
- **Elementer:** [specific visual components — e.g. "file tree, threat arrow, padlock icon"]
- **Filnavn:** `images/[descriptive-name].png`
- **Prompt-forslag:** "[ready-to-use Midjourney / DALL-E prompt]"
```

Write the file to the project root (default: `IMAGE_SPEC.md`).

Present a summary to the user:
> "IMAGE_SPEC.md er generert med [X] bildespesifikasjoner. Du kan bruke disse direkte med Midjourney, DALL-E eller annet bildegenereringsverktøy. Vil du se gjennom dem før vi genererer slides?"

Wait for the user to approve or adjust specs before proceeding.

### Step 4: Generate PRESENTASJON.md

- Read the full approved `AGENDA.md`
- Read all `docs/sources/*.md` files for factual content
- Use the exact inline CSS front matter from [SCAFFOLD.md](SCAFFOLD.md#presentasjonmd-front-matter)
- Apply all content rules:
  - Max 5–6 bullet points per slide; split if exceeded
  - No code blocks in slides
  - No progressive reveal syntax
  - Images: `<img src="images/filename.png" alt="..." class="img-right">` beside text
  - Videos: dedicated blank slide only, only when explicitly requested
  - Presenter notes: always generated in bullet format (2–3 sentences each)
  - Paginate: always on
  - **Norwegian content:** Follow [Språkrådet guidelines](https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/) for spelling, grammar, and terminology

### Step 5: Validate and proofread

Run all checks from [QUALITY.md](QUALITY.md) — both the auto-fix pass and the proofreading pass. Auto-fix where possible; report remaining issues with slide numbers.

### Step 6: Build HTML

```bash
marp PRESENTASJON.md --html --allow-local-files -o PRESENTASJON.html
```

### Step 7: Update state

Mark `phases.generation.status = "done"` in `PROJECT.json`.

### Step 8: Report to user

```
✅ X lysbilde(r) generert
🖼️  Bildespesifikasjoner: IMAGE_SPEC.md ([X] bilder)
📝 Korrekturlesing: [sammendrag fra QUALITY.md proofreading-pass]
⚠️  Kvalitetsadvarsler: [liste eller "ingen"]
❌  Kilder som feilet: [url liste eller "ingen"]
▶️  Neste steg:
    1. Generer bilder fra IMAGE_SPEC.md og legg dem i images/-mappen
    2. Åpne PRESENTASJON.html for forhåndsvisning
    3. Kjør `marp -s .` for live presentasjon
```
