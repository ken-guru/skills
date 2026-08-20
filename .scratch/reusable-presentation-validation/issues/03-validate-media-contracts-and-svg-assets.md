# 03 — Validate media contracts and SVG assets

**What to build:** The validator matches Agenda and presentation media references against `IMAGE_SPEC.md`, `DIAGRAM_SPEC.md`, and existing assets, and validates media metadata, orientation, alternative text, provenance, and SVG structure for the applicable profile.

**Blocked by:** 01 — Bootstrap the read-only validation dispatcher

**Status:** ready-for-agent

- [ ] Picture references match the canonical image specification and existing assets when pictures are declared.
- [ ] Diagram references match the canonical diagram specification and existing assets when diagrams are declared.
- [ ] Missing media specifications are not applicable when the media type is absent, but block when declared or referenced.
- [ ] Orphaned specifications, broken asset references, orientation mismatches, missing or unsuitable alternative text, and media-legibility issues are reported with the agreed severity.
- [ ] SVG files are checked for valid structure and a valid viewBox without requiring a rendering mutation.
- [ ] Fixture cases cover no-media projects, complete media, missing specs, missing assets, orphan entries, invalid SVG, and orientation mismatch.
