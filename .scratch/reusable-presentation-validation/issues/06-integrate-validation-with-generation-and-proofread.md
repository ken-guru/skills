# 06 — Integrate validation with Generation and Proofread

**What to build:** `generate-slides` and `proofread-presentation` invoke the appropriate read-only validation profiles as completion gates, preserve the existing Restart Guards and Project Folder state contract, and update only their own phase state after every completion condition passes.

**Blocked by:**

- 02 — Validate Project Folder and slide structure
- 03 — Validate media contracts and SVG assets
- 04 — Validate Theme Package integrity
- 05 — Validate exports and source provenance

**Status:** ready-for-agent

- [ ] Generation invokes the `generation` profile after Markdown, HTML, and PDF generation and before marking Generation complete.
- [ ] Proofread invokes the `proofread` profile after media rendering and safe mechanical fixes and before marking Proofread complete.
- [ ] A zero validator exit status is required but is not treated as completion without the owning Skill’s approvals and artifact checks.
- [ ] Validation never updates `PROJECT.json`, `DISCOVERY.json`, phase timestamps, Media Specs, presentation outputs, or Theme Package snapshots.
- [ ] Generation state is updated only by `generate-slides`; Proofread state is updated only by `proofread-presentation`.
- [ ] Failed validation leaves the relevant phase pending, preserves generated artifacts, reports blocking findings, and does not roll back or repair state automatically.
- [ ] Unavailable `presentation-validation` is explained clearly under the complete-suite installation contract.
