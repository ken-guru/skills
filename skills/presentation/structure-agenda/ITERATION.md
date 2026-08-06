# Agenda Iteration Rules

## Feedback loop

When the user provides feedback on an agenda draft, categorise each piece of input before acting on it:

| Category | Description | Example |
|----------|-------------|---------|
| **Content** | Missing topics, inaccurate facts, wrong scope | "We're missing a slide on authentication" |
| **Framing** | Tone, emphasis, narrative angle | "The opening feels too technical — we need more context" |
| **Pacing** | Too long, too short, unbalanced sections | "Part 3 is twice as long as part 2" |

For each feedback round:
1. Categorise all input explicitly: `"I interpret this as content + pacing changes"`
2. Apply changes
3. Show a **diff summary** — not the full agenda, just what changed:
   ```
   Changes from v[N] → v[N+1]:
   + New slide: "Authentication with OAuth" (after slide 12)
   ~ Slide 3 renamed: "Introduction" → "Why this matters now"
   - Removed: "History and background" section (3 slides)
   ```
4. Ask explicitly: "Are you satisfied, or would you like to make further adjustments?"

Do not write `AGENDA.md` until the user answers "ja" or equivalent.

## Terminology discipline

When the user uses vague or conflicting terms:
- Flag it immediately: "You’re using ‘user’ and ‘person’ interchangeably — should we standardise to one term?"
- Agree on a canonical term
- Add it to the Glossary section in the agenda draft
- Use that term consistently in all slide topics and notes going forward
- Ensure terminology aligns with the language conventions of the chosen presentation language

When the user introduces domain-specific jargon or abbreviations:
- Ask for a definition if not obvious from context
- Add the definition to the glossary section
- Note that it should be explained in the relevant presenter notes at generation time

## Scope discipline

If a proposed change would exceed the discovered duration:
- Warn immediately: "This will extend the presentation to approximately [X] minutes — the presentation is planned for [duration]."
- Offer concrete options:
  1. Split into two presentations
  2. Extend the duration (update DISCOVERY.json)
  3. Remove another section to compensate

Do not silently make the change — wait for the user to choose.

## Image placeholder format

For each slide, include a descriptive placeholder with a sourcing hint:

```markdown
- [Image](images/intro-hero.png) <!-- Suggestion: Illustration of [topic]. Search: Unsplash "keyword" -->
```

Use descriptive filenames that hint at content (e.g., `images/security-shield.png`, not `images/img1.png`).

## Source URL convention

- `[Source](url)` — source material to auto-fetch and summarize during generation
- `(DO NOT FETCH)` — participant/demo links embedded in slides but never fetched by the agent
- Internal docs — referenced normally, no special tag

## Approval gate

Do **not** write `AGENDA.md` until the user explicitly says the agenda is approved. Phrases like "looks good", "go ahead", "generate", "approved", or equivalent count as approval.
