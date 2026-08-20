# 04 — Validate Theme Package integrity

**What to build:** The validator confirms that the project’s locked Presentation Theme is internally consistent, compatible with the generated Semantic Slide Markup, and intact according to its manifest, CSS, and recorded fingerprints.

**Blocked by:** 01 — Bootstrap the read-only validation dispatcher

**Status:** ready-for-agent

- [ ] The selected Theme Package and Theme Manifest resolve from the project’s lock rather than from an inferred installed path.
- [ ] Theme identity, package version, markup version, required files, declared classes, and CSS entry point are checked.
- [ ] SHA-256 fingerprints for locked theme files are recomputed and compared with the recorded lock.
- [ ] Missing, modified, incompatible, or ambiguous Theme Packages produce blocking findings with actionable context.
- [ ] Valid locked themes pass consistently in both Generation and Proofread profiles.
- [ ] Fixture cases cover valid locks, missing locks, modified files, version incompatibility, missing CSS, and manifest/lock disagreement.
