# Deck Folder

One folder per presentation, in the current directory unless the person names another. The files are the only state: there is no JSON state file and no record of which stage ran. This file is the single statement of the contract; suite skills carry an identical copy in their `references/` folder, kept in step by CI.

```
<deck-name>/
  brief.md        Brief
  sources.md      Source Set
  storyline.md    Storyline
  deck.md         Deck Source
  theme.css       the deck's theme
  fonts/          brand font files, only when supplied
  media/          diagrams (.d2 + .svg), charts (spec + data + .svg), images with sidecars
  dist/           deck.html, deck.pdf, deck-notes.md (+ deck.pptx, PNGs on request)
```

## Rules

- **Read only what you need.** When a file is missing, work from what the person gives you in the conversation, or ask. Never refuse to run because an earlier stage did not.
- **Approvals** live in frontmatter: `brief.md`, `sources.md`, and `storyline.md` carry `approved: true` only after the person approves. A file without it is a draft: say so and offer to continue; never block.
- **The Deck Source is the source of truth.** Everything in `dist/` is regenerated from `deck.md`, `theme.css`, and `media/`. Rendering again is always safe.
- **Citations** in `deck.md` point at Source Set entries by their number, for example `[S2]`, in the speaker notes.
- **Visual Intents** sit in `deck.md` as `<!-- Visual intent: … -->` comments where the visual goes. They form the visuals plan and are left out of the speaker-notes script. (Marp's presenter view shows them, as it shows every comment.)
- **Never edit `dist/` by hand.** Change the source and render again.

## brief.md

```markdown
---
approved: false
---

# Brief: <working title>

- Audience: …
- Goal: what the audience should think, feel, or do afterwards
- Occasion: event, date, and setting
- Length: minutes, and time for questions
- Language: e.g. en, nb
- Constraints: …
- Look: Editorial | Editorial Inverse | brand (colours, fonts, logo)
- Editorial preferences: tone …; prefer …; avoid …
- Sources in hand: …
- Research: needed | light | waived (with the date and reason)
```

## sources.md

The Source Set: numbered sources (`S1`, `S2`, …) with reference, credibility note, and the claims each supports; numbered conflicts (`C1`, …) with the person's ruling; gaps; waivers. `approved: false` until the person approves.

## storyline.md

```markdown
---
approved: false
---

# Storyline: <title>

Key message: one sentence.

## 1. <Section>
- Slide: <topic> — claim and the sources it rests on [S1]
- Slide: …
```
