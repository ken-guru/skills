# 05 — Validate exports and source provenance

**What to build:** The validator checks the applicable HTML and PDF outputs for existence, dimensions, slide counts, content/media/pagination parity, and rendering consistency, while matching source references to successful summaries or explicitly reported fetch failures.

**Blocked by:** 01 — Bootstrap the read-only validation dispatcher

**Status:** ready-for-agent

- [ ] The Generation and Proofread profiles apply the correct export requirements for their phase.
- [ ] HTML and PDF slide counts and 16:9 dimensions are compared.
- [ ] Text, media, pagination, layout shift, clipping, missing decoration, materially different color, and illegible media are reported when detectable.
- [ ] Source references from the Agenda and presentation are matched to source summaries or explicit fetch-failure records.
- [ ] Optional absent exports are distinguished from required missing exports according to the active profile.
- [ ] Fixture cases cover valid parity, missing exports, mismatched counts, dimension mismatch, source gaps, and reported fetch failures.
