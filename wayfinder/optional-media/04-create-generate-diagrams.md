## Question

Create the new `generate-diagrams` skill. It should mirror the architecture of `generate-images` (supporting batch and interactive modes, prompting for scope if some files exist) but use **D2** (with the ELK layout engine) to generate SVG/PNG files.

Depends on: `01-research-mermaid-cli.md`, `03-update-generate-slides.md`
Labels: `wayfinder:task`
Status: Closed

## Resolution

- Created `generate-diagrams` skill in `skills/generate-diagrams/SKILL.md`.
- Implemented batch and interactive generation modes identical to `generate-images`.
- Documented usage of the `d2` CLI with ELK layout and theme support (light/dark mode based on `DISCOVERY.json`).
