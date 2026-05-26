# Agenda Iteration Rules

## Terminology discipline

When the user uses vague or conflicting terms:
- Flag it immediately: "Du bruker 'bruker' og 'person' om hverandre — skal vi standardisere til ett begrep?"
- Agree on a canonical term
- Add it to `## Begreper og definisjoner` in the agenda draft
- Use that term consistently in all slide topics and notes going forward
- Ensure terminology aligns with [Språkrådet conventions](https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/) for Norwegian (bokmål)

When the user introduces domain-specific jargon or abbreviations:
- Ask for a definition if not obvious from context
- Add the definition to the glossary section
- Note that it should be explained in the relevant presenter notes at generation time

## Scope discipline

If a proposed change would exceed the discovered duration:
- Warn immediately: "Dette vil utvide presentasjonen til ca. [X] minutter — presentasjonen er planlagt for [duration]."
- Offer concrete options:
  1. Split into two presentations
  2. Extend the duration (update DISCOVERY.json)
  3. Remove another section to compensate

Do not silently make the change — wait for the user to choose.

## Image placeholder format

For each slide, include a descriptive placeholder with a sourcing hint:

```markdown
- [Bilde](images/intro-hero.png) <!-- Forslag: Illustrasjon av [emne]. Søk: Unsplash "keyword" -->
```

Use descriptive filenames that hint at content (e.g., `images/security-shield.png`, not `images/img1.png`).

## Source URL convention

- `[Kilde](url)` — source material to auto-fetch and summarize during generation
- `(IKKE BESØK)` — participant/demo links embedded in slides but never fetched by the agent
- Internal docs — referenced normally, no special tag

## Approval gate

Do **not** write `AGENDA.md` until the user explicitly says the agenda is approved. Phrases like "looks good", "go ahead", "generate" or "godkjent" count as approval.
