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

Use `--format json` when another agent or process needs structured findings. Use `--report <path>` only when a persistent report is explicitly requested.

Full validation is supported as part of the complete Presentation Skill Suite. A consumer Skill may explain that this Skill is unavailable, but focused installation is not a supported full-validation mode.
