## Question

Update the `generate-slides` skill to parse the visual preference from `AGENDA.md` for each slide and output the corresponding entries into `IMAGE_SPEC.md` and/or `DIAGRAM_SPEC.md`. If "None" is chosen for a slide, it should not appear in either spec.

Depends on: `02-update-discovery-and-agenda.md`
Labels: `wayfinder:task`
Status: Closed

## Resolution

- Updated `generate-slides/SKILL.md` Step 3 to output `IMAGE_SPEC.md` or `DIAGRAM_SPEC.md` based on `[Visual: Picture/Diagram]`.
- Added instructions for D2 syntax generation.
- Added instructions to skip slides marked `[Visual: None]`.
- Updated diff reporting step to run against both spec files.
