# 02 — Validate Project Folder and slide structure

**What to build:** Generation and Proofread profiles validate project identity, declared paths, phase-relevant required artifacts, front matter, slide boundaries, Semantic Slide Markup, Content Slots, Content Capacity, and structural consistency, with findings expressed through the dispatcher contract.

**Blocked by:** 01 — Bootstrap the read-only validation dispatcher

**Status:** ready-for-agent

- [ ] `PROJECT.json` and `DISCOVERY.json` are validated as the authoritative project and phase contracts.
- [ ] The applicable profile requires the correct Project Folder artifacts and explains missing or inapplicable artifacts.
- [ ] Presentation front matter, slide separators, slide count, language, theme identity, sizing, and pagination are validated.
- [ ] Each slide's archetype, variation, tonal state, Semantic Slide Markup, and populated Content Slots are checked.
- [ ] Content Capacity and agreed slide-budget heuristics produce the correct blocking or warning severity.
- [ ] Findings include stable check IDs, severity, context, evidence, and remediation in both supported output formats.
- [ ] Fixture cases cover valid structure, malformed state, missing required artifacts, and over-capacity content without unintended writes.
