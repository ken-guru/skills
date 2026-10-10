# Source Set format

Write the Source Set as Markdown. The entries in the example below are illustrative; check every reference you write. Number sources `S1`, `S2`, … and conflicts `C1`, `C2`, … so other work can cite them (for example a slide's speaker notes say "[S2]").

```markdown
---
question: Do four-day work weeks improve productivity?
approved: false
---

# Source Set: Do four-day work weeks improve productivity?

Scale: full research for a 20-minute talk to managers.

## Sources

### S1. The results are in: the UK's four-day week pilot
- Reference: Autonomy, with Cambridge and Boston College researchers, February 2023, https://autonomy.work/portfolio/uk4dwpilotresults/
- Credibility: Moderate: large pilot (61 companies) with a described method; caveat: companies volunteered, and the organiser campaigns for the policy.
- Supports:
  - 56 of 61 companies continued the four-day week after the trial.
  - Revenue stayed broadly the same over the trial period.

### S2. …

## Conflicts

### C1. Does productivity rise or merely hold steady?
- S1 reports revenue "broadly the same"; S3 reports a 20 % productivity rise.
- Ruling: present both: "held steady in the largest pilot; one smaller study saw gains".

## Gaps

- No source covers manufacturing or shift work.

## Waivers

- None.
```

## Rules for the file

- `approved` stays `false` until the person approves the whole Source Set, including every conflict ruling. Change it to `true` only on their explicit approval.
- A conflict without a ruling has `Ruling: open`. Open conflicts are listed back to the person before approval.
- When the person waives research, write the waiver and the date under `## Waivers` instead of leaving the file empty.
- Each "Supports" bullet is a claim as the source states it, not your interpretation.
