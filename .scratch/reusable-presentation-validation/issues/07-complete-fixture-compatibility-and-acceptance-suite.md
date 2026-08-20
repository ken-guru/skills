# 07 — Complete the fixture, compatibility, and acceptance suite

**What to build:** A canonical verification suite proves the validator across successful and failing Project Folders, supported environments, output formats, version behavior, and the complete approval-reduction scenario without weakening safety or state-machine guarantees.

**Blocked by:** 06 — Integrate validation with Generation and Proofread

**Status:** ready-for-agent

- [ ] Canonical fixtures cover successful Generation and Proofread runs and every blocking, warning, informational, and skipped outcome.
- [ ] Fixtures cover missing required artifacts, optional artifacts, invalid Theme Packages, broken references, invalid SVG, source gaps, missing tools, and paths containing spaces.
- [ ] Human output and JSON output are stable, deterministic, and schema-versioned.
- [ ] Runtime version behavior and complete-suite installation behavior are verified.
- [ ] The validator performs no unintended writes and explicit reports are the only permitted generated validation artifacts.
- [ ] Existing routing evals remain focused on routing, while validator behavior is tested at the dispatcher seam against Project Folder fixtures.
- [ ] One approved `check all` invocation demonstrates equivalent coverage to the former exploratory shell and Python checks.
- [ ] The acceptance suite confirms that phase state remains unchanged until the owning Skill explicitly records completion.
