## Question

Update the `build-presentation` orchestrator and `shared/state-schema.md` to officially track and sequence the `generate-images` and `generate-diagrams` phases after slide generation and before proofreading.

Depends on: `04-create-generate-diagrams.md`
Labels: `wayfinder:task`
Status: Closed

## Resolution

- Updated `shared/state-schema.md` to track `images` and `diagrams` in `PROJECT.json` phases, and registered `DIAGRAM_SPEC.md` in paths.
- Updated `build-presentation/SKILL.md` orchestrator to insert the media generation phases (`generate-images` and `generate-diagrams`) right after slide generation and before the proofreading pass.
