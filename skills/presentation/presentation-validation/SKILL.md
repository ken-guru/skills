---
name: presentation-validation
description: "Validate a Presentation Project Folder with deterministic generation and proofread profiles."
---

# Presentation Validation

Run the bundled read-only dispatcher against the explicit Project Folder:

```text
presentation-validation check all --project-dir <project> --profile generation
presentation-validation check all --project-dir <project> --profile proofread
```

The dispatcher never installs tools, acquires credentials, changes project files, or updates `PROJECT.json`. The phase-owning Skill remains responsible for state changes after validation succeeds.

## Output voice

Apply a lightweight human-voice pass to human-readable validation reports. Name
the failing check, affected artifact, and remediation without puffery. Preserve
JSON output, exact paths, commands, error identifiers, and machine-readable
report contracts. Presentation-copy generation must already have completed the
required standalone `unslop` pass; validation does not substitute for it.

Use `--format json` when another agent or process needs structured findings. Use `--report <path>` only when a persistent report is explicitly requested.

Full validation is supported as part of the complete Presentation Skill Suite. A consumer Skill may explain that this Skill is unavailable, but focused installation is not a supported full-validation mode.

## Maintenance

If resolving a real validation failure takes more than one ad hoc diagnostic/fix command, that's a signal, not a one-off: either the check is a false positive (failing for a reason unrelated to real presentation content) or the fix belongs in this Skill, not improvised against the Project Folder's output files each time it recurs. Promote it — fix the detector, or build the fixer in.

Worked example: [Wayfinder: Fix presentation-validation's false-positive export detectors](https://github.com/ken-guru/skills/issues/82). `exports.parity`'s PDF page counter and `exports.media-parity`'s HTML reference scan were both false-positiving on Marp/Bespoke export artifacts (a compressed PDF object stream, a JS string literal inside `<script>`) after a proofread run needed several manual grep/node/ghostscript commands to work around them. Both detectors were fixed directly instead.
