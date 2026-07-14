## Destination

Update the presentation pipeline to support optional AI images or Mermaid diagrams per slide. The visual choice (Picture, Diagram, or None) will have a presentation-level default but can be overridden per slide. The orchestrator will explicitly manage `generate-images` and a new `generate-diagrams` skill, which will mirror the batch and interactive modes of image generation.

## Notes

- Domain: Agentic skills for presentation generation (`discover-presentation`, `structure-agenda`, `generate-slides`, `build-presentation`).
- Preferences: Maintain the existing state machine and restart guards. Keep AI image generation and local diagram rendering as separate skills (`generate-images` and `generate-diagrams`) and separate specs (`IMAGE_SPEC.md` and `DIAGRAM_SPEC.md`). Diagrams will be pre-rendered to SVG/PNG for reliable embedding in Marp.

## Decisions so far

- [01-research-mermaid-cli.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/optional-media/01-research-mermaid-cli.md) — Mermaid requires Puppeteer/Chromium; best run via Docker or system Chromium for automation. Native alternatives like D2 exist but require syntax changes.
- Decision: Use **D2** (with the ELK layout engine) instead of Mermaid for diagram generation, as it is a lightweight native binary and supports good styling options.
- [02-update-discovery-and-agenda.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/optional-media/02-update-discovery-and-agenda.md) — Implemented: `discover-presentation` and `structure-agenda` now prompt for visual preferences, defaulting to Picture but explicitly supporting Diagram and None per slide.
- [03-update-generate-slides.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/optional-media/03-update-generate-slides.md) — Implemented: `generate-slides` now reads `[Visual: ...]` and generates `IMAGE_SPEC.md` and `DIAGRAM_SPEC.md` with D2 syntax, skipping "None" slides.
- [04-create-generate-diagrams.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/optional-media/04-create-generate-diagrams.md) — Implemented: Created the `generate-diagrams` skill using the `d2` CLI, mirroring the interactive and batch workflow of `generate-images`.
- [05-update-orchestrator-and-schema.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/optional-media/05-update-orchestrator-and-schema.md) — Implemented: Updated `shared/state-schema.md` and `build-presentation` to natively sequence and track diagram/image generation phases before proofreading.
## Not yet specified

## Out of scope
