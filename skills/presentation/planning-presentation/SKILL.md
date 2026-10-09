---
name: planning-presentation
description: Plans a presentation with the person: interviews them until the audience, goal, and premises are clear, records the Brief, and builds an approved storyline from vetted sources. Use when someone wants to make, plan, or structure a talk, presentation, or slide deck, or needs help working out what to say.
metadata:
  version: "3.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/presentation/CHANGELOG.md"
---

# Planning a presentation

Find out what the person means, then agree the argument: the Brief, and from it the Storyline. The person owns both; you do the legwork and recommend.

The Deck Folder layout is in [references/deck-folder.md](references/deck-folder.md). Create the folder in the current directory unless the person names another, and name it after the talk.

## Workflow

```
- [ ] 1. Interview until nothing important is unclear
- [ ] 2. Brief confirmed
- [ ] 3. Sources vetted (or research waived)
- [ ] 4. Storyline drafted
- [ ] 5. Storyline approved
```

1. **Interview.** Ask in rounds, following [references/interview.md](references/interview.md): number every question, give a recommended answer for each, and ask all the questions you can answer now in one round. Skip anything the request already answers. Challenge unclear or shaky premises. Keep going round by round until nothing important is unclear; the number of rounds is not fixed. Never guess personal details such as the speaker's name or the event; leave a placeholder or ask.
2. **Brief.** Write `brief.md` in the format in [references/deck-folder.md](references/deck-folder.md) with `approved: false`, show it, and set `approved: true` only when the person confirms it.
3. **Sources.** Unless the Brief waives research, the Storyline rests on vetted sources:
   - If `researching-sources` is installed, use it with the Brief's question and `sources.md` as the output path. It returns an approved Source Set.
   - If it is not, do light research yourself: read the person's sources, check every factual claim the talk will make, judge each source's credibility, put conflicting claims to the person as questions, and write `sources.md` with numbered sources (`S1`, `S2`, …) for their approval.
   - Research is never skipped silently: when the person waives it, record the waiver and the date in the Brief.
4. **Storyline.** Draft `storyline.md` following [references/storyline.md](references/storyline.md): the key message, the narrative arc, sections, and one line per slide topic with the sources it rests on. Use only the vetted Source Set; when a slide needs a claim no source supports, go back to step 3 instead of inventing support. Fit the length in the Brief.
5. **Approval.** Show the Storyline and revise it until the person approves; then set `approved: true`.

When the person brings their own outline or brief, start from it: confirm what is there, ask only about what is missing, and continue from the right step.

When the Storyline is approved, the natural next step is drafting slides: `drafting-slides`, if installed, turns it into the Deck Source.

## Editing

When writing the Brief and Storyline, if `unslop` is installed, use it for the prose; if not, keep wording plain and specific in the person's voice. Record the person's tone, prefer, and avoid preferences in the Brief so later stages apply them.
