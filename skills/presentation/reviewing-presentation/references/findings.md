# Reporting Findings

Report in the conversation, not in a file. Group Findings by the stage that owns the fix, so the person knows where to go:

| Stage | Owns problems with | Fixed by |
|---|---|---|
| Brief | wrong audience, goal, or length | `planning-presentation` |
| Research | missing, weak, or contradicted evidence | `researching-sources` |
| Storyline | the argument's order, gaps, or key message | `planning-presentation` |
| Draft | slide wording, headings, notes, citations, alt text | `drafting-slides` |
| Visuals | diagrams, charts, and images | `creating-diagrams`, `creating-charts`, `generating-images` |
| Render | theme, layout, export | `rendering-slides` |

Within each group, put the most serious first:

1. **Blocking**: wrong facts, unsupported claims, missing alt text, unreadable text, a talk far over time.
2. **Important**: weak sourcing, confusing visuals, unclear headings, prose that does not sound like the speaker.
3. **Polish**: small wording and layout improvements.

Each Finding names the slide, the problem, and the fix, in one or two sentences:

```
### Draft
- **Blocking, slide 4**: "Incidents fell by 60 %" cites [S2], which reports 40 %. Change to 40 %, or find a source for 60 %.
- **Important, slide 7**: The heading "Results" does not say what the results were. Try "The pilot halved review time".

### Visuals
- **Important, slide 5**: The chart's two series differ only by colour. Label each line directly.
```

End with what the review could not cover (for example "PDF only: no speaker notes or sources to trace") and the timing estimate.
