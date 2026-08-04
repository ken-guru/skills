# ADR 0007: Optional Media and D2 Diagrams

## Context
Our presentation generation pipeline originally assumed that every slide might need an AI-generated image (using `generate-images` from an `IMAGE_SPEC.md`). However, presentations frequently require either no visuals for certain slides or precise technical diagrams rather than stylistic AI art.

We needed a way to:
1. Allow users to specify a visual preference (Picture, Diagram, or None) at the presentation level and override it per slide.
2. Support generating diagrams locally from textual representations.

## Decision
We decided to:
1. Introduce a "Visual preference" question in the `discover-presentation` phase.
2. Instruct the `structure-agenda` drafting phase to embed `[Visual: Picture/Diagram/None]` on each slide. Diagram entries also carry a complete, agenda-time `Diagram brief` with the intended message, content to show, and audience takeaway.
3. Update `generate-slides` to parse these preferences and emit either an `IMAGE_SPEC.md` or a `DIAGRAM_SPEC.md`, dropping "None" entirely. Diagram briefs are preserved explicitly in `DIAGRAM_SPEC.md`; generation fails before changing output if a Diagram entry has no complete brief.
4. Adopt **D2** (with the ELK layout engine) over Mermaid for diagram generation. Mermaid requires Puppeteer/Chromium, which adds significant overhead for automated scripting, whereas D2 is a lightweight, standalone native binary with excellent styling features.
5. Create a new phase skill, `generate-diagrams`, mirroring the interactive and batch workflow of `generate-images`, to execute the local `d2` compiler.
6. Integrate the media generation steps explicitly into the `build-presentation` orchestrator (running before the proofreading phase).

## Consequences
- **Positive:** Users have fine-grained control over slide visuals. Technical presentations can heavily leverage D2 diagrams without needing to battle AI image generators.
- **Positive:** By maintaining two separate specs (`IMAGE_SPEC.md` and `DIAGRAM_SPEC.md`), we decouple the tools required for rendering (e.g. D2 vs. Gemini APIs).
- **Negative:** Users must install `d2` locally to render diagrams. However, this is far lighter than a full Chromium instance required by Mermaid CLI.
