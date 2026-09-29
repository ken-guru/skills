# Project Instructions

This repository is a Collection.

- Standalone Skills live at `skills/<name>/SKILL.md`.
- Skill Suite members live at `skills/<suite>/<name>/SKILL.md`.
- A suite root has `README.md` and no `SKILL.md`.
- Nesting stops at one suite level beneath `skills/`.
- Keep runtime instructions and supporting files inside their owning Skill.

Read [CONTEXT-MAP.md](CONTEXT-MAP.md) before changing domain terminology and
[CONTRIBUTING.md](CONTRIBUTING.md) before changing ownership or distribution.

## Commits

Commit types decide releases: read "Versions and releases" in
[CONTRIBUTING.md](CONTRIBUTING.md) before committing. A change to a `SKILL.md`, or
to anything it loads, is never `docs`; a breaking change carries a
`BREAKING CHANGE:` footer that says what consumers must do.

## Pull requests

When creating a pull request, pass its title and body through a real multiline
file or equivalent multiline input. Preserve actual newline characters in the
PR title/body; never send shell-escaped `\\n` text that renders as literal
backslash-n sequences.
