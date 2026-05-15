# Phase Instructions

## Phase 1: Discovery

Ask these questions conversationally. Extract structured data from free-form answers. Accept partial answers and fill the rest with defaults.

### Questions to resolve

1. **Topic** — What is the presentation about?
2. **Audience** — Who will attend? (default: mixed technical — developers + some management)
3. **Duration** — How long? (default: 45 minutes)
4. **Occasion** — What type of event? (e.g., intern fagdag, konferanse, workshop, all-hands)
5. **Language** — Norwegian (bokmål) unless otherwise specified

### Defaults summary

After gathering topic and audience, present a one-shot confirmation before proceeding. The user corrects whatever doesn't fit — everything else is accepted as-is.

```
📋 Standardantagelser — korriger det som ikke stemmer:

- Språk: Norsk (bokmål)
- Varighet: 45 minutter
- Målgruppe: [inferred from input]
- Presentasjonsstil: Informativ med tydelig narrativ bue
- Fortellermønster: [se DEFAULTS.md for alternativer]
- Mørk modus: Ja (class: invert)
- Sidenummerering: Ja
- Maks kulepunkter per lysbilde: 5–6

Er dette riktig, eller vil du justere noe?
```

### Folder and file names

Present defaults and let the user override before any files are created:

| File / Folder | Default |
|---|---|
| Presentation | `PRESENTASJON.md` |
| Agenda | `AGENDA.md` |
| Images | `images/` |
| Videos | `videos/` |
| Docs | `docs/` |
| Sources | `docs/sources/` |
| Themes | `themes/` |

Ask: "Vil du bruke standardnavn, eller ønsker du å justere noen?"

---

## Phase 2: Agenda Refinement

### Building AGENDA.md

1. Propose a full agenda outline based on Discovery inputs — sections, slide topics, logical flow
2. Infer a narrative structure from the topic (see [DEFAULTS.md](DEFAULTS.md#narrative-structures))
3. Include a `## Begreper og definisjoner` section with all key terms defined precisely
4. For each slide topic: include an image placeholder reference and `[Kilde](url)` for source material
5. Iterate with the user — do **not** proceed to Phase 3 without explicit approval

### Terminology discipline

When the user uses vague or conflicting terms:
- Flag it immediately: "Du bruker 'bruker' og 'person' om hverandre — skal vi standardisere til ett begrep?"
- Agree on a canonical term
- Add it to `## Begreper og definisjoner` in `AGENDA.md`
- Use that term consistently in all generated slides and presenter notes

When the user introduces domain-specific jargon or abbreviations:
- Ask for a definition if not obvious from context
- Add the definition to the glossary section
- Include a brief explanation in the relevant presenter notes

### Image placeholder format

For each slide, add a descriptive placeholder with a sourcing hint:

```markdown
- [Bilde](images/intro-hero.png) <!-- Forslag: Illustrasjon av [emne]. Søk: Unsplash "artificial intelligence abstract" -->
```

Use descriptive filenames that hint at content (e.g., `images/security-shield.png`, not `images/img1.png`).

### Source URL convention

- `[Kilde](url)` — source material to auto-fetch and summarize to `docs/sources/`
- `(IKKE BESØK)` — participant/demo links embedded in slides but never fetched
- Internal docs — referenced normally, no special tag

---

## Phase 3: Generation

### Step 1: Scaffold project (new projects only)

Create all files and folders per [SCAFFOLD.md](SCAFFOLD.md).

> ⚠️ If the current directory already has files, confirm with the user before writing.

### Step 2: Fetch and summarize sources

For every `[Kilde](url)` link in `AGENDA.md`:
- Fetch the URL
- Summarize to `docs/sources/<slug>.md` in concise markdown
- Include: key facts, statistics, quotes, and context useful for slides
- Note the original URL at the top of each summary file

Skip any URL marked `(IKKE BESØK)`.

### Step 3: Generate PRESENTASJON.md

- Read the full approved `AGENDA.md`
- Read all `docs/sources/*.md` files for factual content
- Use the exact inline CSS front matter from [SCAFFOLD.md](SCAFFOLD.md#presentasjonmd-front-matter)
- Apply all content rules from SKILL.md
- For each image placeholder: embed as `<img src="images/filename.png" alt="..." class="img-right">`
- For each video reference: create a dedicated blank slide with `<video src="videos/filename.mp4" controls></video>`
- Generate presenter notes as bullet points for every slide

### Step 4: Validate

Run all checks from [QUALITY.md](QUALITY.md). Auto-fix where possible; report remaining issues with slide numbers.

### Step 5: Build HTML

```bash
marp PRESENTASJON.md --html --allow-local-files -o PRESENTASJON.html
```

### Step 6: Report to user

```
✅ X lysbilde(r) generert
🖼️  Bildefilholderplasser å erstatte: [filnavn liste]
⚠️  Kvalitetsadvarsler: [liste eller "ingen"]
▶️  Neste steg:
    1. Legg til bilder i images/-mappen
    2. Åpne PRESENTASJON.html for forhåndsvisning
    3. Kjør `marp -s .` for live presentasjon
```
