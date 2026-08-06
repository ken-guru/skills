# Restart Guard

Run before revising an approved Agenda when a Media Spec or generated presentation
already exists.

Inventory both Media Specs, source summaries, Markdown, HTML, PDF, and files beneath
`images/` and `videos/`. Show only paths that exist and ask the user to choose:

- **Delete obsolete text (recommended):** remove Media Specs, source summaries, and
  presentation outputs while preserving generated media.
- **Delete everything:** list every media filename and require a second explicit
  `yes` before removing it.
- **Keep everything:** retain all files and warn that downstream content may be
  inconsistent.

After either deletion option, preserve Discovery and Structure state, set every
existing downstream phase (`generation`, `images`, `diagrams`, `proofread`) to
`pending`, and clear its completion timestamp. Do not modify project files until the
user confirms the inventory and choice.
