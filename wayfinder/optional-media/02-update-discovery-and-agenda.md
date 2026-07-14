## Question

Update `discover-presentation` and `structure-agenda` skills to prompt for visual preferences (Picture, Diagram, None) as a presentation default, and explicitly allow overriding to "None" (or other options) on a per-slide basis in `AGENDA.md`.

Labels: `wayfinder:task`
Status: Closed

## Resolution

- Added `Visual preference` (Picture / Diagram / None) question to `QUESTIONS.md` in `discover-presentation`.
- Added it to `DEFAULTS.md` and the confirmation step in `SKILL.md`.
- Updated `DRAFT_AGENDA.md` in `structure-agenda` to instruct the AI to specify `[Visual: Picture/Diagram/None]` per slide and explicitly offer the user the chance to override to "None".
